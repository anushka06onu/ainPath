import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "unpdf", "pdfkit", "@neondatabase/serverless"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
