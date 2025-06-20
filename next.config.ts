import type { NextConfig } from "next";
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer, dev }) => {
    // Exclude contracts and cli directories from the build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/contracts/**', '**/cli/**', '**/node_modules/**'],
    };

    // Handle Node.js modules that don't exist in browser environment
    // This is needed for replicad-opencascadejs compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        url: false,
        querystring: false,
        assert: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        zlib: false,
      };

      // Copy WASM files from replicad-opencascadejs to public directory
      if (!dev) {
        try {
          const publicDir = join(process.cwd(), 'public');
          if (!existsSync(publicDir)) {
            mkdirSync(publicDir, { recursive: true });
          }

          // Try to find and copy the WASM file from replicad-opencascadejs
          const nodeModulesPath = join(process.cwd(), 'node_modules');
          const replicadPath = join(nodeModulesPath, 'replicad-opencascadejs');
          
          if (existsSync(replicadPath)) {
            const wasmFile = join(replicadPath, 'replicad_single.wasm');
            const targetWasm = join(publicDir, 'replicad_single.wasm');
            
            if (existsSync(wasmFile) && !existsSync(targetWasm)) {
              copyFileSync(wasmFile, targetWasm);
              console.log('✅ Copied replicad WASM file to public directory');
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to copy WASM files:', error);
        }
      }
    }

    // Ensure proper handling of WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add rule for WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Configure proper WASM loading for replicad
    config.resolve.alias = {
      ...config.resolve.alias,
    };

    return config;
  },
};

export default nextConfig;
