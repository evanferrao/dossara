import { EMBEDDING_MODEL } from "./constants";

// Lazy-loaded singleton pipeline
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;

/**
 * Returns a cached feature-extraction pipeline.
 * Model is downloaded on first call and reused afterwards.
 * Runs entirely in the browser via WebAssembly.
 */
async function getPipeline() {
  if (!pipelineInstance) {
    // Dynamically import the pre-bundled web version to avoid SSR and Turbopack issues
    // @ts-ignore
    const transformers = await import("@xenova/transformers/dist/transformers.min.js");
    transformers.env.allowLocalModels = false;
    
    pipelineInstance = await transformers.pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  return pipelineInstance;
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
