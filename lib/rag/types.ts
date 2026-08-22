import type { WebSearchResult } from "../web-search/types";

export interface LocalRetrievalResult {
  id: string;
  content: string;
  similarity: number;
  documentId: string;
  documentName: string;
  pageNumber?: number;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface HybridRetrievalResult {
  localResults: LocalRetrievalResult[];
  webResults: WebSearchResult[];
}

export interface HybridContextPayload {
  context: string;
  docInventory: string;
  docCount: number;
  chunkCount: number;
  referencedDocCount: number;
  webSourceCount: number;
  localResults: LocalRetrievalResult[];
  webResults: WebSearchResult[];
}
