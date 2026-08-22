import test from "node:test";
import assert from "node:assert/strict";
import { buildHybridContext } from "../lib/rag/context-builder";
import { buildSystemPrompt } from "../lib/prompt";
import type { LocalRetrievalResult } from "../lib/rag/types";
import type { WebSearchResult } from "../lib/web-search/types";
import type { StoredDocument } from "../lib/indexeddb";


test("Mode A - Local RAG context assembly", () => {
  const readyDocs: StoredDocument[] = [
    {
      id: "doc-1",
      chat_id: "chat-1",
      filename: "research.pdf",
      page_count: 5,
      status: "ready",
      cursor: null,
      error_message: null,
      created_at: new Date().toISOString(),
    },
  ];

  const localResults: LocalRetrievalResult[] = [
    {
      id: "1",
      content: "Attention is all you need paper summary.",
      similarity: 0.89,
      documentId: "doc-1",
      documentName: "research.pdf",
      pageNumber: 2,
    },
  ];

  const result = buildHybridContext({
    localResults,
    webResults: [],
    readyDocs,
  });

  assert.equal(result.docCount, 1);
  assert.equal(result.chunkCount, 1);
  assert.equal(result.webSourceCount, 0);
  assert.match(result.context, /### LOCAL DOCUMENT PASSAGES/);
  assert.doesNotMatch(result.context, /### EXTERNAL WEB SOURCES/);
  assert.match(result.context, /\[LOCAL SOURCE 1\] Document: "research.pdf" \(ID: doc-1\) \| Page: 2 \| Similarity: 0.89/);
});

test("Mode B - Hybrid RAG context assembly and truncation", () => {
  const readyDocs: StoredDocument[] = [
    {
      id: "doc-1",
      chat_id: "chat-1",
      filename: "notes.pdf",
      page_count: 3,
      status: "ready",
      cursor: null,
      error_message: null,
      created_at: new Date().toISOString(),
    },
  ];

  const localResults: LocalRetrievalResult[] = [
    {
      id: "1",
      content: "Local notes on machine learning.",
      similarity: 0.85,
      documentId: "doc-1",
      documentName: "notes.pdf",
      pageNumber: 1,
    },
  ];

  const longWebContent = "A".repeat(8000);
  const webResults: WebSearchResult[] = [
    {
      title: "Latest Transformer Architecture",
      url: "https://arxiv.org/abs/2401.00000",
      content: longWebContent,
      score: 0.92,
      publishedDate: "2024-01-15",
      source: "tavily",
    },
  ];

  const result = buildHybridContext({
    localResults,
    webResults,
    readyDocs,
    maxWebContentChars: 6000,
  });

  assert.equal(result.docCount, 1);
  assert.equal(result.chunkCount, 1);
  assert.equal(result.webSourceCount, 1);

  // Checks that both sections are distinctly present
  assert.match(result.context, /### LOCAL DOCUMENT PASSAGES/);
  assert.match(result.context, /### EXTERNAL WEB SOURCES/);
  assert.match(result.context, /\[WEB SOURCE 1\] Title: Latest Transformer Architecture/);
  assert.match(result.context, /URL: https:\/\/arxiv.org\/abs\/2401.00000/);

  // Verifies truncation to 6000 chars
  assert.match(result.context, /... \[content truncated\]/);
});

test("System Prompt - includes dual source rules when web sources exist", () => {
  // Web search enabled prompt
  const hybridPrompt = buildSystemPrompt({
    docCount: 1,
    docInventory: '1. "paper.pdf" (5 pages)',
    referencedDocCount: 1,
    chunkCount: 2,
    webSourceCount: 3,
    context: "Context body",
  });

  assert.match(hybridPrompt, /Source Provenance/);
  assert.match(hybridPrompt, /1\. LOCAL DOCUMENTS/);
  assert.match(hybridPrompt, /2\. WEB SOURCES/);
  assert.match(hybridPrompt, /<!-- CITATIONS:/);
  assert.match(hybridPrompt, /<!-- WEB_CITATIONS:/);
  assert.match(hybridPrompt, /Never invent or fabricate URLs/);

  // Local only prompt
  const localPrompt = buildSystemPrompt({
    docCount: 1,
    docInventory: '1. "paper.pdf" (5 pages)',
    referencedDocCount: 1,
    chunkCount: 2,
    webSourceCount: 0,
    context: "Context body",
  });

  assert.doesNotMatch(localPrompt, /<!-- WEB_CITATIONS:/);
});
