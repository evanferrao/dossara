/**
 * Client-side vector similarity search using cosine similarity.
 * Replaces the Supabase `match_chunks` RPC.
 *
 * For the expected scale (hundreds of chunks per user),
 * brute-force search is <10ms — no need for HNSW indexing.
 */

import { getChunksByDocumentId, type StoredChunk } from "./indexeddb";

export interface SearchResult {
  chunk: StoredChunk;
  similarity: number;
}

/**
 * Cosine similarity between two vectors of equal length.
 * Returns a value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Search stored chunks of target documents for the most similar to the query embedding.
 * Returns the top-K results sorted by descending similarity.
 */
export async function searchChunks(
  queryEmbedding: number[],
  documentIds: string[],
  topK: number = 5
): Promise<SearchResult[]> {
  if (documentIds.length === 0 || !queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  // Fetch only chunks belonging to the specified documents using IndexedDB index
  const chunkArrays = await Promise.all(
    documentIds.map((id) => getChunksByDocumentId(id))
  );
  const validChunks = chunkArrays.flat();

  if (validChunks.length === 0) {
    return [];
  }

  // Score every chunk
  const scored: SearchResult[] = validChunks.map((chunk) => ({
    chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort descending by similarity, take top-K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
