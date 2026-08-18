/**
 * Client-side vector similarity search using cosine similarity.
 * Replaces the Supabase `match_chunks` RPC.
 *
 * For the expected scale (hundreds of chunks per user),
 * brute-force search is <10ms — no need for HNSW indexing.
 */

import { getAllChunks, type StoredChunk } from "./indexeddb";

export interface SearchResult {
  chunk: StoredChunk;
  similarity: number;
}

/**
 * Cosine similarity between two vectors of equal length.
 * Returns a value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
 * Search all stored chunks for the most similar to the query embedding.
 * Returns the top-K results sorted by descending similarity.
 */
export async function searchChunks(
  queryEmbedding: number[],
  topK: number = 5
): Promise<SearchResult[]> {
  const allChunks = await getAllChunks();

  if (allChunks.length === 0) {
    return [];
  }

  // Score every chunk
  const scored: SearchResult[] = allChunks.map((chunk) => ({
    chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort descending by similarity, take top-K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
