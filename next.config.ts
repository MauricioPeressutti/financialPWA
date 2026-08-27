import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera .next/standalone para una imagen Docker mínima (deploy en Cloud Run).
  output: "standalone",
};

export default nextConfig;
