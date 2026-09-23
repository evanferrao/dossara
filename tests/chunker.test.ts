import test from "node:test";
import assert from "node:assert/strict";
import { splitText, chunkPages, estimateTokenCount, createTokenCounter } from "../lib/chunker";
import {
  CHUNK_MAX_TOKENS,
  CHUNK_TOKEN_OVERLAP,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  EMBEDDING_MAX_TOKENS,
} from "../lib/constants";
import { getTokenizer } from "../lib/embeddings";

test("Constants - Token and character limits match Xenova 256 context window", () => {
  assert.equal(EMBEDDING_MAX_TOKENS, 256);
  assert.equal(CHUNK_MAX_TOKENS, 256);
  assert.equal(CHUNK_TOKEN_OVERLAP, 25);
  // Default character limit (~4 chars per token: 256 * 4 ≈ 1000)
  assert.equal(CHUNK_SIZE, 1000);
  assert.equal(CHUNK_OVERLAP, 100);
});

test("estimateTokenCount - counts words, punctuation, and subwords", () => {
  assert.equal(estimateTokenCount(""), 0);
  assert.equal(estimateTokenCount("   \n\t  "), 0);

  const short = "Hello world!";
  // "Hello" (1), "world" (1), "!" (1)
  assert.equal(estimateTokenCount(short), 3);

  const punctuationDense = "Item #102: $49.99 (Discount: 15% off).";
  const count = estimateTokenCount(punctuationDense);
  assert.ok(count >= 10, `Expected at least 10 tokens for dense punctuation, got ${count}`);
});

test("splitText - Empty or whitespace inputs return empty array", () => {
  assert.deepEqual(splitText(""), []);
  assert.deepEqual(splitText("   \n\n\t  \r\n"), []);
});

test("splitText - Short text remains a single chunk with preserved casing", () => {
  const text = "Dossara is an intelligent assistant capable of answering questions.";
  const chunks = splitText(text);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

test("splitText - Long text (2000+ characters) is split into chunks <= 256 tokens", () => {
  const sentence = "Artificial intelligence and machine learning transform information retrieval. ";
  const longText = sentence.repeat(35); // ~2700 chars
  assert.ok(longText.length > 2000, "Text should exceed 2000 characters");

  const chunks = splitText(longText, { maxTokens: 256, maxChars: 1000 });
  assert.ok(chunks.length >= 3, `Expected at least 3 chunks, got ${chunks.length}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tokens = estimateTokenCount(chunk);
    assert.ok(
      tokens <= 256,
      `Chunk ${i + 1} has ${tokens} tokens, exceeding max limit of 256!`
    );
    assert.ok(
      chunk.length <= 1000,
      `Chunk ${i + 1} has length ${chunk.length}, exceeding max limit of 1000 chars!`
    );
  }
});

test("splitText - Overlap preserves context between consecutive chunks", () => {
  const sentences = [
    "First sentence introduces the document.",
    "Second sentence explains the methodology.",
    "Third sentence provides experimental details.",
    "Fourth sentence summarizes the observed findings.",
    "Fifth sentence discusses implications.",
    "Sixth sentence outlines future research directions.",
  ];
  const text = sentences.join(" ");

  // Force small chunks to trigger overlap
  const chunks = splitText(text, { maxTokens: 20, overlapTokens: 8 });
  assert.ok(chunks.length >= 2, "Should create multiple chunks");

  // Verify that chunk 2 shares content from chunk 1
  for (let i = 0; i < chunks.length - 1; i++) {
    const current = chunks[i];
    const next = chunks[i + 1];

    // Find if any word or sentence from the end of current exists at the start of next
    const currentWords = current.split(/\s+/);
    const nextWords = next.split(/\s+/);
    const overlapWord = currentWords[currentWords.length - 1];
    assert.ok(
      nextWords.slice(0, 10).some((w) => w.toLowerCase().includes(overlapWord.toLowerCase().replace(/[^\w]/g, ""))),
      `Expected overlap between chunk ${i} and ${i + 1}`
    );
  }
});

test("splitText - Pathological unbroken string does not crash or loop infinitely", () => {
  const unbroken = "X".repeat(2500);
  const chunks = splitText(unbroken, { maxTokens: 100, maxChars: 400 });
  assert.ok(chunks.length > 1, "Should split unbroken string");
  for (const c of chunks) {
    assert.ok(c.length <= 400, "Chunk should be within maxChars");
  }
});

test("chunkPages - Produces chunks with accurate page numbers and token counts", () => {
  const pages = [
    "Page 1: Introduction to local retrieval architectures.",
    "", // Empty page should be skipped
    "   ", // Whitespace page should be skipped
    "Page 4: Detailed benchmarks across multiple document collections. ".repeat(15),
  ];

  const chunks = chunkPages(pages, 1, { maxTokens: 256, maxChars: 1000 });
  assert.ok(chunks.length >= 2, "Should produce chunks");

  const pageNumbers = chunks.map((c) => c.pageNumber);
  assert.ok(pageNumbers.includes(1), "Should include page 1");
  assert.ok(!pageNumbers.includes(2), "Page 2 was empty and should be skipped");
  assert.ok(!pageNumbers.includes(3), "Page 3 was empty and should be skipped");
  assert.ok(pageNumbers.includes(4), "Should include page 4");

  for (const chunk of chunks) {
    assert.ok(typeof chunk.tokenCount === "number" && chunk.tokenCount > 0);
    assert.ok(chunk.tokenCount <= 256);
  }
});

test("Xenova Integration - Real AutoTokenizer confirms no chunks exceed 256 tokens", async () => {
  const tokenizer = await getTokenizer();
  assert.ok(tokenizer, "Tokenizer should be loaded");

  const sampleDocument = `
# Executive Summary
The rapid evolution of retrieval-augmented generation (RAG) systems necessitates robust local indexing mechanisms.
In traditional architectures, client documents are transmitted to remote cloud endpoints for vector embedding generation.
However, this approach introduces privacy risks, external latency overhead, and recurring API expenses.

## Technical Architecture
To address these limitations, our application implements an entirely client-side embedding pipeline utilizing WebAssembly.
The model weights are fetched once and cached in browser storage using the Cache API and IndexedDB.
Each uploaded document is parsed into discrete page representations before being ingested by the token-aware chunker.

## Chunking Constraints & Token Alignment
Previous implementations relied on fixed character slices of 2000 characters.
Because Xenova/all-MiniLM-L6-v2 is trained with a maximum sequence limit of 256 tokens (~1024 characters),
approximately half of every large chunk was silently truncated by the model tokenizer during vector generation.
With token-aware chunking, the text is subdivided into semantic segments that strictly adhere to the 256 token limit.
`.trim();

  // Test with real tokenizer
  const countReal = createTokenCounter(tokenizer);
  const chunks = splitText(sampleDocument, {
    tokenizer,
    maxTokens: 256,
    overlapTokens: 25,
    maxChars: 1000,
    overlapChars: 100,
  });

  assert.ok(chunks.length >= 1);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const estimated = countReal(chunk);
    assert.ok(estimated <= 256, `countReal tokens (${estimated}) exceeds 256`);

    // Exact tokenization with tokenizer.encode
    const encoded = tokenizer.encode(chunk);
    // Note: tokenizer.encode adds [CLS] and [SEP] (2 special tokens)
    const tokenLength = encoded.length;
    assert.ok(
      tokenLength <= 256,
      `Chunk ${i + 1} with ${tokenLength} tokens exceeds Xenova 256 token limit!`
    );
  }
});
