import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  allowedDevOrigins: ["172.20.181.144"],

  serverExternalPackages: ["sharp", "onnxruntime-node"],

  // Turbopack is the default bundler in Next.js 16
  turbopack: {},
};

export default nextConfig;
