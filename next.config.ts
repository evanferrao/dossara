import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for @xenova/transformers to work in Node.js API routes
  serverExternalPackages: ["@xenova/transformers", "sharp", "onnxruntime-node"],
  allowedDevOrigins: ["172.20.181.144"],

  // Turbopack is the default bundler in Next.js 16
  turbopack: {},
};

export default nextConfig;
