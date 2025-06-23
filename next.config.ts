import type { NextConfig } from "next";
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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

      // Copy WASM file from replicad-opencascadejs to the public directory so
      // it is always available at runtime (both `next dev` and production
      // builds). The file is small (~4-5 MB) so the cost of copying during dev
      // compilation is negligible compared to having a working CAD engine.
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
        console.warn('⚠️ Failed to copy WASM file:', error);
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

  // Relax CSP only for the CAD playground (it needs `new Function` and WASM)
  async headers() {
    return [
      {
        // Apply to the CAD root page ("/c3d/cad")
        source: '/c3d/cad',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob:; " +
              "worker-src 'self' blob:; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data:; " +
              "connect-src 'self' https:; " +
              "font-src 'self';",
          },
        ],
      },
      {
        // Apply to all nested CAD routes and assets
        source: '/c3d/cad/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob:; " +
              "worker-src 'self' blob:; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data:; " +
              "connect-src 'self' https:; " +
              "font-src 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
