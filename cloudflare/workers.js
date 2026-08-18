import { streamText, convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";

function buildSystemPrompt(params) {
  const { docCount, docInventory, referencedDocCount, chunkCount, context } = params;
  
  const noDocsMessage =
    "No documents have been uploaded yet. Let the user know they need to upload a PDF first.";

  return `You are Dossara, an intelligent document assistant. You answer questions based on the user's uploaded documents.

## Instructions
- Answer the user's question using the provided document context below.
- If the retrieved passages don't contain enough information, say so honestly, but mention which documents are available for the user to ask about.
- When referencing specific information, cite the passage number and document name (e.g., "According to Passage 1 from \\"filename.pdf\\"...").
- Be concise but thorough.
- When the user asks how many documents or sources you have access to, refer to the "Your Documents" section — NOT the number of retrieved passages.
- CRITICAL: At the very end of your response, on a new line, you MUST include a citation block in this exact JSON format if you referenced any passages:
  <!-- CITATIONS: [{"documentId": "<ID>", "filename": "<filename>", "page": <page>}] -->
  Use the exact ID, filename, and page number provided in the passage headers.

## Your Documents
${
  docCount > 0
    ? `You have access to ${docCount} document(s) uploaded by the user:\n${docInventory}`
    : noDocsMessage
}

## Retrieved Passages (${referencedDocCount} document(s), ${chunkCount} passage(s))
${context || "No matching passages found for this query."}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const store = new Map();

function getNextDayResetMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const maxRequests = parseInt(env.MAX_CHAT_PER_IP_PER_DAY || "5", 10);
      
      if (maxRequests > 0) {
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        const now = Date.now();
        let entry = store.get(ip);
        
        if (!entry || now >= entry.resetAt) {
          entry = { count: 0, resetAt: getNextDayResetMs() };
          store.set(ip, entry);
        }
        
        entry.count++;
        
        if (entry.count > maxRequests) {
          const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);
          return new Response(
            JSON.stringify({
              error: "Rate limit exceeded",
              message: `Daily usage limit reached — This demo project allows up to ${maxRequests} chat messages per day to manage API costs. The limit resets at midnight UTC. Thank you for checking out the project!`,
              retryAfter: retryAfterSecs,
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Retry-After": String(retryAfterSecs),
                "X-RateLimit-Limit": String(maxRequests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
              },
            }
          );
        }
      }

      const body = await request.json();

      // Ensure GROQ_API_KEY is set in Cloudflare environment variables
      const groq = createGroq({ apiKey: env.GROQ_API_KEY });
      const modelId = body.model || "llama-3.1-8b-instant";

      const systemPrompt = buildSystemPrompt({
        docCount: body.docCount ?? 0,
        docInventory: body.docInventory ?? "",
        referencedDocCount: body.referencedDocCount ?? 0,
        chunkCount: body.chunkCount ?? 0,
        context: body.context ?? "",
      });

      const llmMessages = await convertToModelMessages(body.messages ?? []);

      const result = streamText({
        model: groq(modelId),
        instructions: systemPrompt,
        messages: llmMessages,
      });

      const streamResponse = result.toUIMessageStreamResponse();
      
      const newHeaders = new Headers(streamResponse.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(streamResponse.body, {
        status: streamResponse.status,
        statusText: streamResponse.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
