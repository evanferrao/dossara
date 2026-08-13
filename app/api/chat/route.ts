import { NextRequest } from "next/server";
import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { getServiceSupabase } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings";
import { getWorkspaceId } from "@/lib/workspace";
import {
  MODELS,
  TOP_K_CHUNKS,
  HISTORY_LIMIT,
} from "@/lib/constants";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();

  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    return new Response("x-workspace-id header is required", { status: 400 });
  }

  const body = await req.json();

  // Extract model key from request body
  // The AI SDK v7 sends messages inside the body
  const modelKey = body.model;
  const messages = body.messages ?? [];

  // Determine which Groq model to use
  const modelId =
    modelKey === "versatile" ? MODELS.versatile : MODELS.fast;

  // Get the latest user message text from parts
  const lastMessage = messages[messages.length - 1];
  let userMessage = "";
  if (lastMessage?.parts) {
    userMessage = lastMessage.parts
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join(" ");
  } else if (lastMessage?.content) {
    userMessage = lastMessage.content;
  }

  if (!userMessage) {
    return new Response("No user message provided", { status: 400 });
  }

  // 1. Embed the user's query
  const queryEmbedding = await embed(userMessage);

  // 2. Retrieve top-K relevant chunks via cosine similarity
  const { data: relevantChunks, error: chunksError } = await supabase.rpc(
    "match_chunks",
    {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_workspace_id: workspaceId,
      match_count: TOP_K_CHUNKS,
    }
  );

  // If the RPC doesn't exist, fall back to a direct query
  let contextChunks = relevantChunks;
  if (chunksError) {
    console.warn("RPC match_chunks not found, using direct query:", chunksError.message);
    const { data: directChunks } = await supabase
      .from("chunks")
      .select("content, page_number, document_id")
      .eq("workspace_id", workspaceId)
      .limit(TOP_K_CHUNKS);
    contextChunks = directChunks;
  }

  // 3. Get document filenames for citations
  const docIds = [
    ...new Set(
      (contextChunks ?? []).map(
        (c: { document_id: string }) => c.document_id
      )
    ),
  ];
  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename")
    .in("id", docIds.length > 0 ? docIds : ["00000000-0000-0000-0000-000000000000"]);

  const docMap = new Map(
    (docs ?? []).map((d: { id: string; filename: string }) => [d.id, d.filename])
  );

  // 4. Build context block
  const contextBlock = (contextChunks ?? [])
    .map(
      (
        chunk: { content: string; page_number: number; document_id: string },
        i: number
      ) => {
        const filename = docMap.get(chunk.document_id) ?? "Unknown";
        return `[Source ${i + 1}] Document: "${filename}" | Page: ${chunk.page_number}\n${chunk.content}`;
      }
    )
    .join("\n\n---\n\n");

  // 5. Fetch chat history from database
  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = (historyRows ?? [])
    .reverse()
    .map((r: { role: string; content: string }) => ({
      role: r.role as "user" | "assistant",
      content: r.content,
    }));

  // 6. Build the system prompt
  const systemPrompt = `You are DocuMind, an intelligent document assistant. You answer questions based on the provided document context.

## Instructions
- Answer the user's question using ONLY the provided source context below.
- If the context doesn't contain enough information, say so honestly.
- Reference specific sources by their number (e.g., "According to Source 1...").
- Be concise but thorough.
- At the very end of your response, on a new line, include a citation block in this exact format:
  <!-- CITATIONS: [{"documentId": "...", "filename": "...", "page": N}, ...] -->
  Include ONLY the sources you actually referenced in your answer.

## Document Context
${contextBlock || "No documents have been uploaded yet. Let the user know they need to upload a PDF first."}`;

  // 7. Build the messages array for the LLM (no system messages — use instructions instead)
  const llmMessages = [
    ...history,
    { role: "user" as const, content: userMessage },
  ];

  // 8. Stream the response via Groq
  const result = streamText({
    model: groq(modelId),
    instructions: systemPrompt,
    messages: llmMessages,
    onFinish: async ({ text }) => {
      // Parse citations from the response
      let citations = null;
      let cleanContent = text;

      const citationMatch = text.match(
        new RegExp("<!-- CITATIONS:\\s*(\\[.*?\\])\\s*-->", "s")
      );
      if (citationMatch) {
        try {
          citations = JSON.parse(citationMatch[1]);
          cleanContent = text
            .replace(new RegExp("<!-- CITATIONS:\\s*\\[.*?\\]\\s*-->", "s"), "")
            .trim();
        } catch {
          console.warn("Failed to parse citations JSON");
        }
      }

      // Insert user message
      await supabase.from("chat_messages").insert({
        workspace_id: workspaceId,
        role: "user",
        content: userMessage,
      });

      // Insert assistant message with citations
      await supabase.from("chat_messages").insert({
        workspace_id: workspaceId,
        role: "assistant",
        content: cleanContent,
        citations,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
