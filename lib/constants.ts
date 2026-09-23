export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 384);

/** Maximum sequence length supported by Xenova/all-MiniLM-L6-v2 */
export const EMBEDDING_MAX_TOKENS = 256;

/** Target maximum tokens per chunk (bounded by EMBEDDING_MAX_TOKENS = 256) */
export const CHUNK_MAX_TOKENS = Number(process.env.CHUNK_MAX_TOKENS ?? 256);
/** Overlap in tokens between consecutive chunks (≈ 10 % of CHUNK_MAX_TOKENS) */
export const CHUNK_TOKEN_OVERLAP = Number(process.env.CHUNK_TOKEN_OVERLAP ?? 25);

/** Approximate max characters per chunk (≈ 4 chars/token heuristic for 256 tokens → ~1000 chars) */
export const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 1000);
/** Overlap between consecutive chunks (≈ 10 % of CHUNK_SIZE) */
export const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP ?? 100);

/** Number of PDF pages to process per batch */
export const PAGES_PER_BATCH = Number(process.env.PAGES_PER_BATCH ?? 10);

/** Number of chunks to retrieve for context */
export const TOP_K_CHUNKS = Number(process.env.TOP_K_CHUNKS ?? 5);
export const TOP_K_LOCAL = TOP_K_CHUNKS;
export const TOP_K_WEB = Number(process.env.TOP_K_WEB ?? 5);
export const MAX_WEB_CONTENT_CHARS_PER_RESULT = Number(
  process.env.MAX_WEB_CONTENT_CHARS_PER_RESULT ?? 2500
);
/** Maximum character budget for combined retrieved context (local + web) to stay within LLM TPM limits */
export const MAX_TOTAL_CONTEXT_CHARS = Number(
  process.env.MAX_TOTAL_CONTEXT_CHARS ?? 14000
);
export const WEB_MIN_SCORE = Number(process.env.WEB_MIN_SCORE ?? 0.5);

/** Number of chat history messages to include */
export const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT ?? 10);

export const MODELS = (
  process.env.NEXT_PUBLIC_MODELS ?? "openai/gpt-oss-20b,openai/gpt-oss-120b"
)
  .split(",")
  .map((m) => m.trim());

export type ModelKey = string;
export const DEFAULT_MODEL: ModelKey = MODELS[0];

/** Maximum character budget for direct Groq / worker prompts to stay within free-tier TPM limits (≈ 4,000 tokens) */
export const MAX_GROQ_PROMPT_CHARS = Number(process.env.MAX_GROQ_PROMPT_CHARS ?? 16000);
export const PROMPT_TRUNCATION_NOTE =
  "\n\n[Note: Input truncated to fit model token limits. For analyzing long documents, please upload them to the Document panel for full RAG retrieval.]";

