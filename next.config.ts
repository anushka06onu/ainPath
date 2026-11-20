import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "unpdf"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
