// ── Embedding ──────────────────────────────────────────────────────────────────
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = parseInt(
  process.env.EMBEDDING_DIMENSIONS ?? "384",
  10
);

// ── Chunking ───────────────────────────────────────────────────────────────────
/** Approximate max tokens per chunk (≈ 4 chars/token heuristic → 2000 chars) */
export const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE ?? "2000", 10);
/** Overlap between consecutive chunks (≈ 10 % of CHUNK_SIZE) */
export const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP ?? "200", 10);

// ── Processing ─────────────────────────────────────────────────────────────────
/** Number of PDF pages to process per API invocation */
export const PAGES_PER_BATCH = parseInt(
  process.env.PAGES_PER_BATCH ?? "10",
  10
);

// ── RAG ────────────────────────────────────────────────────────────────────────
/** Number of chunks to retrieve for context */
export const TOP_K_CHUNKS = parseInt(process.env.TOP_K_CHUNKS ?? "5", 10);
/** Number of chat history messages to include */
export const HISTORY_LIMIT = parseInt(process.env.HISTORY_LIMIT ?? "10", 10);

// ── LLM Models ─────────────────────────────────────────────────────────────────
// Uses NEXT_PUBLIC_ prefix so model names are accessible in client components
export const MODELS = {
  fast: process.env.NEXT_PUBLIC_MODEL_FAST ?? "llama-3.1-8b-instant",
  versatile:
    process.env.NEXT_PUBLIC_MODEL_VERSATILE ?? "llama-3.3-70b-versatile",
} as const;

export type ModelKey = keyof typeof MODELS;
export const DEFAULT_MODEL: ModelKey =
  (process.env.DEFAULT_MODEL as ModelKey) ?? "fast";
