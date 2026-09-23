import test from "node:test";
import assert from "node:assert/strict";
import { splitTextIntoPages, CHARS_PER_SIMULATED_PAGE } from "../lib/extractors";
import { cosineSimilarity, searchChunks } from "../lib/vectorSearch";
import { buildHybridContext } from "../lib/rag/context-builder";
import { getTokenizer } from "../lib/embeddings";
import { EMBEDDING_MAX_TOKENS, MAX_TOTAL_CONTEXT_CHARS } from "../lib/constants";
import type { LocalRetrievalResult } from "../lib/rag/types";
import type { WebSearchResult } from "../lib/web-search/types";

test("splitTextIntoPages - Empty and short text handling", () => {
  assert.deepEqual(splitTextIntoPages(""), []);
  assert.deepEqual(splitTextIntoPages("   \n\t  "), []);

  const short = "This is a single short page of text.";
  const pages = splitTextIntoPages(short);
  assert.equal(pages.length, 1);
  assert.equal(pages[0], short);
});

test("splitTextIntoPages - Splits long text along paragraph boundaries into simulated pages", () => {
  const paragraph = "This is a standard paragraph with detailed explanations. ".repeat(10); // ~570 chars
  // 10 paragraphs ≈ 5700 chars, should produce ~3 simulated pages with 2500 charsPerPage
  const fullText = Array(10).fill(paragraph).join("\n\n");
  assert.ok(fullText.length > 5000);

  const pages = splitTextIntoPages(fullText, CHARS_PER_SIMULATED_PAGE);
  assert.ok(pages.length >= 2, `Expected at least 2 pages, got ${pages.length}`);

  for (let i = 0; i < pages.length; i++) {
    assert.ok(pages[i].length > 0, `Page ${i + 1} should not be empty`);
    // Each page except possibly the last should be roughly <= CHARS_PER_SIMULATED_PAGE
    // (a single paragraph is 570 chars, so page should not excessively exceed)
    assert.ok(
      pages[i].length <= CHARS_PER_SIMULATED_PAGE + 1000,
      `Page ${i + 1} length (${pages[i].length}) exceeded allowed threshold`
    );
  }
});

test("cosineSimilarity - Handles edge cases and mismatched vector lengths safely", () => {
  // Empty vectors
  assert.equal(cosineSimilarity([], []), 0);

  // Mismatched vector dimensions
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0]), 0);
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);

  // Normal identical vectors
  const sim = cosineSimilarity([1, 0], [1, 0]);
  assert.equal(Math.round(sim), 1);

  // Orthogonal vectors
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("searchChunks - Returns empty array on empty inputs without throwing", async () => {
  assert.deepEqual(await searchChunks([], ["doc-1"]), []);
  assert.deepEqual(await searchChunks([0.1, 0.2], []), []);
});

test("buildHybridContext - Enforces overall context character budget", () => {
  assert.equal(MAX_TOTAL_CONTEXT_CHARS, 14000);

  const localResults: LocalRetrievalResult[] = [
    {
      id: "chunk-1",
      content: "Important local passage details. ".repeat(200), // ~6600 chars
      similarity: 0.95,
      documentId: "doc-1",
      documentName: "report.pdf",
      pageNumber: 1,
    },
  ];

  const webResults: WebSearchResult[] = [
    {
      title: "Extensive Web Documentation",
      url: "https://example.com/docs",
      content: "External web content details. ".repeat(400), // ~12000 chars
      score: 0.88,
      source: "tavily",
    },
  ];

  const result = buildHybridContext({
    localResults,
    webResults,
    readyDocs: [],
    maxTotalContextChars: 8000, // Explicitly cap combined context at 8000
  });

  // Verify that combined context was bounded
  assert.ok(
    result.context.length <= 8000 + 150,
    `Context length ${result.context.length} exceeded budget of 8000 + note`
  );
  assert.match(result.context, /Additional retrieved context truncated/);
});

test("Tokenizer - model_max_length is strictly locked to EMBEDDING_MAX_TOKENS (256)", async () => {
  const tokenizer = await getTokenizer();
  assert.equal(tokenizer.model_max_length, EMBEDDING_MAX_TOKENS);
  assert.equal(EMBEDDING_MAX_TOKENS, 256);
});
