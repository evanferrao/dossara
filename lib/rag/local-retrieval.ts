import { embed } from "../embeddings";
import { searchChunks } from "../vectorSearch";
import { getDocuments, type StoredDocument } from "../indexeddb";
import type { LocalRetrievalResult } from "./types";
import { TOP_K_CHUNKS } from "../constants";

export async function retrieveLocal(
  query: string,
  chatId: string,
  topK: number = TOP_K_CHUNKS
): Promise<{
  results: LocalRetrievalResult[];
  readyDocs: StoredDocument[];
}> {
  const trimmed = query.trim();
  if (!trimmed || !chatId) {
    return { results: [], readyDocs: [] };
  }

  // 1. Get ready documents for this chat
  const allDocs = await getDocuments(chatId);
  const readyDocs = allDocs.filter((d) => d.status === "ready");
  const readyDocIds = readyDocs.map((d) => d.id);

  if (readyDocIds.length === 0) {
    return { results: [], readyDocs: [] };
  }

  // 2. Embed the query client-side
  const queryEmbedding = await embed(trimmed);

  // 3. Search chunks with cosine similarity
  const rawResults = await searchChunks(queryEmbedding, readyDocIds, topK);

  // 4. Map doc id to doc name
  const docMap = new Map(readyDocs.map((d) => [d.id, d.filename]));

  // 5. Build standardized local retrieval results
  const results: LocalRetrievalResult[] = rawResults.map((r, index) => ({
    id: r.chunk.id ? String(r.chunk.id) : `chunk-${r.chunk.document_id}-${index}`,
    content: r.chunk.content,
    similarity: Number(r.similarity.toFixed(4)),
    documentId: r.chunk.document_id,
    documentName: docMap.get(r.chunk.document_id) || "Unknown Document",
    pageNumber: r.chunk.page_number,
    chunkIndex: index,
  }));

  return { results, readyDocs };
}
