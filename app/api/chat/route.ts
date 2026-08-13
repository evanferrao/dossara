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

  // 3. Fetch ALL documents in the workspace (for document awareness)
  const { data: allDocs } = await supabase
    .from("documents")
    .select("id, filename, status, page_count")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  const readyDocs = (allDocs ?? []).filter(
    (d: { status: string }) => d.status === "ready"
  );

  // Build document inventory for system prompt
  const docInventory = readyDocs
    .map(
      (d: { filename: string; page_count: number | null }, i: number) =>
        `${i + 1}. "${d.filename}" (${d.page_count ?? "?"} pages)`
    )
    .join("\n");

  // Build a map of doc id → filename (from ALL docs, not just matched ones)
  const docMap = new Map(
    (allDocs ?? []).map((d: { id: string; filename: string }) => [d.id, d.filename])
  );

  // 4. Build context block from retrieved passages
  const contextBlock = (contextChunks ?? [])
    .map(
      (
        chunk: { content: string; page_number: number; document_id: string },
        i: number
      ) => {
        const filename = docMap.get(chunk.document_id) ?? "Unknown";
        return `[Passage ${i + 1}] Document: "${filename}" | Page: ${chunk.page_number}\n${chunk.content}`;
      }
    )
    .join("\n\n---\n\n");

  // Count unique documents referenced in the retrieved passages
  const referencedDocIds = new Set(
    (contextChunks ?? []).map((c: { document_id: string }) => c.document_id)
  );

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
  const noDocsMessage = "No documents have been uploaded yet. Let the user know they need to upload a PDF first.";

  const systemPrompt = `You are DocuMind, an intelligent document assistant. You answer questions based on the user's uploaded documents.

## Instructions
- Answer the user's question using the provided document context below.
- If the retrieved passages don't contain enough information, say so honestly, but mention which documents are available for the user to ask about.
- When referencing specific information, cite the passage number and document name (e.g., "According to Passage 1 from \\"filename.pdf\\"...").
- Be concise but thorough.
- When the user asks how many documents or sources you have access to, refer to the "Your Documents" section — NOT the number of retrieved passages.
- At the very end of your response, on a new line, include a citation block in this exact format:
  <!-- CITATIONS: [{"documentId": "...", "filename": "...", "page": N}, ...] -->
  Include ONLY the documents you actually referenced in your answer.

## Your Documents
${readyDocs.length > 0
    ? `You have access to ${readyDocs.length} document(s) uploaded by the user:\n${docInventory}`
    : noDocsMessage}

## Retrieved Passages (${referencedDocIds.size} document(s), ${(contextChunks ?? []).length} passage(s))
${contextBlock || "No matching passages found for this query."}`;

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
