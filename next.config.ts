import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    // Exclude contracts and cli directories from the build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/contracts/**', '**/cli/**', '**/node_modules/**'],
    };
    return config;
  },
};

export default nextConfig;
