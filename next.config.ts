import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Required for @xenova/transformers to work in Node.js API routes
  serverExternalPackages: ["@xenova/transformers", "sharp", "onnxruntime-node"],
  allowedDevOrigins: ["172.20.181.144"],

  // Ensure native binaries are included in the standalone trace
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**/*",
      "node_modules/sharp/**/*",
    ],
  },

  // Strip binaries for platforms not used in Docker (linux/x64 only)
  outputFileTracingExcludes: {
    "/*": [
      // onnxruntime: macOS, Windows, and ARM64 binaries
      "node_modules/onnxruntime-node/bin/napi-v3/darwin/**/*",
      "node_modules/onnxruntime-node/bin/napi-v3/win32/**/*",
      "node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**/*",
      // @xenova/transformers: WASM fallbacks (using native onnxruntime-node)
      "node_modules/@xenova/transformers/dist/ort-wasm*",
      // sharp: WASM fallback (using native linux-x64)
      "node_modules/@img/sharp-wasm32/**/*",
      // pdfjs-dist: legacy build (unpdf uses modern build)
      "node_modules/pdfjs-dist/legacy/**/*",
    ],
  },

  // Turbopack is the default bundler in Next.js 16
  turbopack: {},
};

export default nextConfig;
