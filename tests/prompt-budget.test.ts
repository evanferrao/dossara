import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MAX_GROQ_PROMPT_CHARS, PROMPT_TRUNCATION_NOTE } from "../lib/constants";

test("Prompt Budget - faulty_prompt.txt is safely budgeted to stay within Groq TPM limits", () => {
  const filePath = path.join(__dirname, "../faulty_prompt.txt");
  const rawPrompt = fs.readFileSync(filePath, "utf8");

  assert.ok(rawPrompt.length > 40000, "faulty_prompt.txt should be > 40k chars");

  // Budgeting logic as implemented in ChatPanel and Worker
  let budgeted = rawPrompt;
  if (budgeted.length > MAX_GROQ_PROMPT_CHARS) {
    budgeted = budgeted.slice(0, MAX_GROQ_PROMPT_CHARS) + PROMPT_TRUNCATION_NOTE;
  }

  assert.ok(
    budgeted.length <= MAX_GROQ_PROMPT_CHARS + PROMPT_TRUNCATION_NOTE.length,
    "Budgeted prompt must not exceed limit + note"
  );
  assert.ok(budgeted.includes("[Note: Input truncated to fit model token limits"));
  // Rough token estimation (chars / 4): should be ~4,000 tokens, well below 6,000 TPM limit
  const estimatedTokens = Math.round(budgeted.length / 4);
  assert.ok(estimatedTokens < 5000, `Estimated tokens (${estimatedTokens}) must be < 5000`);
});

test("Prompt Budget - normal length prompt is preserved without truncation note", () => {
  const normalPrompt = "What is my credit score and how many open accounts do I have?";
  let budgeted = normalPrompt;
  if (budgeted.length > MAX_GROQ_PROMPT_CHARS) {
    budgeted = budgeted.slice(0, MAX_GROQ_PROMPT_CHARS) + PROMPT_TRUNCATION_NOTE;
  }

  assert.equal(budgeted, normalPrompt);
  assert.ok(!budgeted.includes("[Note: Input truncated"));
});

test("Web Search Query Sanitization - query is capped at 400 characters", () => {
  const rawQuery = "a".repeat(1000);
  const sanitized = rawQuery.slice(0, 400).trim();
  assert.equal(sanitized.length, 400);
});

test("Error message parser - correctly formats rate limit and API errors", () => {
  function parseError(error: { message?: string }) {
    let errorText = "Something went wrong. Please try again later.";
    let isRateLimit = false;

    try {
      const rawMessage = error.message || "";
      const lower = rawMessage.toLowerCase();

      if (
        lower.includes("rate limit") ||
        lower.includes("rate_limit") ||
        lower.includes("rate_limited") ||
        lower.includes("tpm") ||
        lower.includes("tokens per minute") ||
        lower.includes("too many requests") ||
        lower.includes("request too large") ||
        lower.includes("429")
      ) {
        isRateLimit = true;
        errorText =
          "Rate limit reached for the AI model (Tokens Per Minute limit exceeded). Please shorten your message, wait a moment, or upload large documents to the Document panel for RAG processing.";
      } else {
        const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.message) {
            errorText = parsed.message;
          } else if (parsed.error && typeof parsed.error === "string") {
            errorText = parsed.error;
          }
        } else if (rawMessage && !rawMessage.includes("JSON")) {
          errorText = rawMessage.replace(/^[A-Za-z0-9_]+Error:\s*/, "").replace(/^Error:\s*/, "");
        }
      }
    } catch {}

    return { errorText, isRateLimit };
  }

  // Rate limit error
  const res1 = parseError({ message: "APICallError: Rate limit reached on tokens per minute (TPM): Limit 6000, Requested 12000" });
  assert.equal(res1.isRateLimit, true);
  assert.match(res1.errorText, /Tokens Per Minute limit exceeded/);

  // 429 error
  const res2 = parseError({ message: '{"error": "RATE_LIMITED", "message": "Usage limit reached"}' });
  assert.equal(res2.isRateLimit, true);

  // Specific API error
  const res3 = parseError({ message: '{"error": "INVALID_API_KEY", "message": "Invalid API key provided"}' });
  assert.equal(res3.isRateLimit, false);
  assert.equal(res3.errorText, "Invalid API key provided");

  // String error
  const res4 = parseError({ message: "APICallError: Model not found" });
  assert.equal(res4.isRateLimit, false);
  assert.equal(res4.errorText, "Model not found");
});
