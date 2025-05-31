// source/server/index.ts
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import portfinder from 'portfinder';
import { tunnelmole } from 'tunnelmole';
import http from 'http'; // For server instance type

// Import your API route handlers
import baseApiRouter from './api/index.js'; // Assuming this is your main '/api/v1' router
import embeddingsRouter from './api/embeddings.js';
import ttsRouter from './api/tts.js';
import scrapeRouter from './api/scrape.js';
import ollamaManagerRouter from './api/ollamaManager.js';

import * as middlewares from './middlewares.js';
import MessageResponse from './interfaces/MessageResponse.js';

// Load environment variables (if not already loaded at app entry point)
// import dotenv from 'dotenv';
// dotenv.config();

type EnabledServerType = 'ollama' | 'embeddings' | 'tts' | 'scrape'; // 'ollama' implies chat completions

interface StartServerParams {
    port?: number;
    enabledServices: EnabledServerType[];
    // llmModels: string[]; // These are managed by ollamaManager.ts or used by chat.ts
    // embeddingsModels: string[]; // Managed by ollamaManager.ts or used by embeddings.ts
}

interface StartServerResult {
    url: string; // tunnelmole URL
    localPort: number;
    serverInstance: http.Server;
}

let currentServerInstance: http.Server | null = null;

export async function startLocalServer(params: StartServerParams): Promise<StartServerResult> {
    if (currentServerInstance) {
        // Consider how to handle this - maybe return existing info or throw error
        // For now, let's assume App.tsx prevents calling start if already running.
        throw new Error('Server is already running.');
    }

    const app = express();

    // Express middleware
    app.use(morgan('dev'));
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    // Base routes
    app.get<{}, MessageResponse>('/', (_req, res) => {
        res.json({ message: '🐬 Cxmpute Provider Node Active 🌈' });
    });
    app.get('/heartbeat', (_req, res) => res.sendStatus(200));

    // Ollama management routes are always available if server runs
    app.use('/ollama', ollamaManagerRouter);

    // Conditionally add routes based on enabledServices
    if (params.enabledServices) {
        for (const service of params.enabledServices) {
            switch (service) {
                case 'ollama': // This typically means chat completions endpoint
                    app.use('/api/v1', baseApiRouter); // baseApiRouter includes /chat/completions
                    break;
                case 'embeddings':
                    app.use('/api/v1/embeddings', embeddingsRouter);
                    break;
                case 'tts':
                    app.use('/api/v1/tts', ttsRouter);
                    break;
                case 'scrape':
                    app.use('/api/v1/scrape', scrapeRouter);
                    break;
                default:
                    console.warn(`Unknown service type in startLocalServer: ${service}`);
            }
        }
    }

    // Error handling middleware (should be last)
    app.use(middlewares.notFound);
    app.use(middlewares.errorHandler);

    const portToUse = params.port || await portfinder.getPortPromise({ port: 12000 });

    return new Promise<StartServerResult>((resolve, reject) => {
        currentServerInstance = app.listen(portToUse, async () => {
            try {
                const tunnelUrl = await tunnelmole({ port: portToUse });
                // console.log(`Server started locally on port ${portToUse}, public URL: ${tunnelUrl}`);
                resolve({
                    url: tunnelUrl,
                    localPort: portToUse,
                    serverInstance: currentServerInstance!,
                });
            } catch (tunnelError) {
                console.error("Tunnelmole failed:", tunnelError);
                currentServerInstance?.close(); // Close local server if tunnel fails
                currentServerInstance = null;
                reject(new Error(`Failed to create public tunnel: ${(tunnelError as Error).message}`));
            }
        });

        currentServerInstance.on('error', (err) => {
            console.error('Local server error:', err);
            currentServerInstance = null;
            reject(new Error(`Local server failed to start: ${err.message}`));
        });
    });
}

export async function stopLocalServer(): Promise<void> {
    return new Promise((resolve) => {
        if (currentServerInstance) {
            currentServerInstance.close((err) => {
                if (err) {
                    console.error('Error stopping local server:', err);
                    // Don't reject here, as we still want to mark it as stopped
                }
                currentServerInstance = null;
                // console.log('Local server stopped.');
                resolve();
            });
        } else {
            // console.log('Local server was not running.');
            resolve();
        }
        // Note: Tunnelmole itself doesn't have a direct 'stop' API from client side.
        // It stops when the local server it's pointing to stops responding or process exits.
    });
}

// Removed old CLI command parsing logic (switch block)
// This file now only exports startLocalServer and stopLocalServer