import { EMBEDDING_MODEL } from "./constants";

// Lazy-loaded singleton pipeline and tokenizer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenizerInstance: any = null;

async function loadTransformers() {
  if (typeof window !== "undefined" || typeof self !== "undefined") {
    // Dynamically import the pre-bundled web version to avoid SSR and Turbopack issues
    // @ts-expect-error - dist file doesn't have dedicated TS declarations
    return await import("@xenova/transformers/dist/transformers.min.js");
  } else {
    return await import("@xenova/transformers");
  }
}

/**
 * Returns a cached feature-extraction pipeline.
 * Model is downloaded on first call and reused afterwards.
 * Runs entirely in the browser via WebAssembly.
 */
async function getPipeline() {
  if (!pipelineInstance) {
    const transformers = await loadTransformers();
    transformers.env.allowLocalModels = false;
    pipelineInstance = await transformers.pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  return pipelineInstance;
}

/**
 * Returns a cached tokenizer instance for token-aware chunking.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTokenizer(): Promise<any> {
  if (pipelineInstance?.tokenizer) {
    return pipelineInstance.tokenizer;
  }
  if (!tokenizerInstance) {
    const transformers = await loadTransformers();
    transformers.env.allowLocalModels = false;
    tokenizerInstance = await transformers.AutoTokenizer.from_pretrained(EMBEDDING_MODEL);
  }
  return tokenizerInstance;
}

/**
 * Precache the embedding model by forcing it to download and initialize.
 * This is useful for caching the model for offline usage before processing any document.
 */
export async function precacheEmbeddingModel(): Promise<void> {
  await getPipeline();
}

/**
 * Embed a single text string → float array of EMBEDDING_DIMENSIONS length.
 */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed a batch of texts → array of float arrays.
 * Processes sequentially to keep memory bounded.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}
