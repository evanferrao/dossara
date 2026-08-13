import "./polyfills";
import { EMBEDDING_MODEL } from "./constants";

// Lazy-loaded singleton pipeline
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;

/**
 * Returns a cached feature-extraction pipeline.
 * Model is downloaded on first call and reused afterwards.
 */
async function getPipeline() {
  if (!pipelineInstance) {
    // Dynamic import to avoid issues with Next.js bundling
    const { pipeline } = await import("@xenova/transformers");
    pipelineInstance = await pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  return pipelineInstance;
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
