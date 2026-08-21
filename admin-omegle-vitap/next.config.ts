import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactCompiler: true,

  // Optimize build
  poweredByHeader: false,
  generateEtags: true,
  compress: true,

  // TypeScript configuration
  typescript: {
    // Set to true only for emergency deployments - fix type errors instead
    ignoreBuildErrors: false,
  },

  // Image optimization for static export
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        // Uploaded files are served from S3 (S3_PUBLIC_BASE_URL on the backend)
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Experimental features
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion"],
  },
};

export default nextConfig;
