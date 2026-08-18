import { NextRequest } from "next/server";
import { streamText, convertToModelMessages } from "ai";
import { groq } from "@ai-sdk/groq";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Thin Groq proxy — receives pre-assembled context from the client,
 * builds the system prompt, and streams the LLM response.
 *
 * The client handles: query embedding, similarity search, context assembly.
 * This route handles: API key protection, rate limiting, LLM streaming.
 */

export const maxDuration = 60;

import { MODELS, DEFAULT_MODEL } from "@/lib/constants";
import { buildSystemPrompt } from "@/lib/prompt";

export async function POST(req: NextRequest) {
  // Rate limit check
  const rateLimitResponse = checkRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();

  const modelKey: string = body.model ?? DEFAULT_MODEL;
  const messages: any[] = body.messages ?? [];
  const context: string = body.context ?? "";
  const docInventory: string = body.docInventory ?? "";
  const docCount: number = body.docCount ?? 0;
  const chunkCount: number = body.chunkCount ?? 0;
  const referencedDocCount: number = body.referencedDocCount ?? 0;

  const modelId = modelKey || DEFAULT_MODEL;

  // Get the latest user message
  const lastMessage = messages[messages.length - 1];
  let userMessage = "";
  
  if (lastMessage?.parts) {
    userMessage = lastMessage.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  } else if (lastMessage?.content) {
    userMessage = lastMessage.content;
  }

  if (!userMessage) {
    return new Response("No user message provided", { status: 400 });
  }

  const systemPrompt = buildSystemPrompt({
    docCount,
    docInventory,
    referencedDocCount,
    chunkCount,
    context
  });

  // Build messages array for LLM
  const llmMessages = await convertToModelMessages(messages);

  // Stream the response via Groq
  const result = streamText({
    model: groq(modelId),
    instructions: systemPrompt,
    messages: llmMessages,
  });

  return result.toUIMessageStreamResponse();
}
