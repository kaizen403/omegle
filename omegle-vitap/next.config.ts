import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'export', // Static export for static hosting
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
