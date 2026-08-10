import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["sharp", "@prisma/client", "exceljs"],
  experimental: {
    // Subidas grandes (fotos/comprobante); default 10MB corta el FormData.
    proxyClientMaxBodySize: "32mb",
  },
};

export default nextConfig;
