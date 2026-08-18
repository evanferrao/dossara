export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 384);

/** Approximate max tokens per chunk (≈ 4 chars/token heuristic → 2000 chars) */
export const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 2000);
/** Overlap between consecutive chunks (≈ 10 % of CHUNK_SIZE) */
export const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP ?? 200);

/** Number of PDF pages to process per batch */
export const PAGES_PER_BATCH = Number(process.env.PAGES_PER_BATCH ?? 10);

/** Number of chunks to retrieve for context */
export const TOP_K_CHUNKS = Number(process.env.TOP_K_CHUNKS ?? 5);
/** Number of chat history messages to include */
export const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT ?? 10);

export const MODELS = (
  process.env.NEXT_PUBLIC_MODELS ?? "openai/gpt-oss-20b,openai/gpt-oss-120b"
)
  .split(",")
  .map((m) => m.trim());

export type ModelKey = string;
export const DEFAULT_MODEL: ModelKey = MODELS[0];
