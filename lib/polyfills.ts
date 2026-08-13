/**
 * Polyfill for Math.sumPrecise (TC39 Stage 2.7 proposal).
 * Required by @xenova/transformers ONNX runtime on Node < 23.
 * This is a simple fallback — not the full precision algorithm,
 * but sufficient for embedding computations.
 */
// @ts-expect-error — checking for a proposal-stage API
if (typeof Math.sumPrecise !== "function") {
  // @ts-expect-error — polyfilling a proposal-stage API
  Math.sumPrecise = function sumPrecise(values: Iterable<number>): number {
    let sum = 0;
    for (const v of values) {
      sum += v;
    }
    return sum;
  };
}

export {};
