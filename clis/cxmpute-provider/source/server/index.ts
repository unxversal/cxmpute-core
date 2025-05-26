/* eslint-disable import/no-extraneous-dependencies */
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';

import * as middlewares from './middlewares.js';
import api from './api/index.js';
import MessageResponse from './interfaces/MessageResponse.js';
import portfinder from 'portfinder';
import embeddings from './api/embeddings.js';
import tts from './api/tts.js';
import scrape from './api/scrape.js';
import ollamaManager from './api/ollamaManager.js'; 
import { tunnelmole } from 'tunnelmole';
import { ChildProcess } from 'child_process';
import os from 'os';
import fs from 'fs';

require('dotenv').config();

type Server = 'ollama' | 'embeddings' | 'tts' | 'scrape' ;

const app = express();

// Express middleware
app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

// A simple test route
app.get<{}, MessageResponse>('/', (_req, res) => {
  res.json({
    message: '🐬🌈✨👋🌎🌍🌏✨🌈🐬',
  });
});

// Health check for orchestration heartbeat
app.get('/heartbeat', (_req, res) => {
  // simple 200 OK signals "I’m alive"
  res.sendStatus(200);
});

// Not Found / Error handler
app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

app.use('/ollama', ollamaManager);

// CLI command and optional params
const command = process.argv[2];
const paramsArg = process.argv[3];

// The main HTTP server reference
let server: any = null;

// Moondream process + model path references
let moondreamProcess: ChildProcess | null = null;
let moondreamModelPath: string | null = null;

/**
 * Stop the Moondream server process if it's running, and delete the model file if we downloaded it.
 */
function stopMoondreamServer() {
  if (moondreamProcess) {
    moondreamProcess.kill();
    moondreamProcess = null;
    console.log(JSON.stringify({ status: 'moondream_stopped' }));
  }

  // If we have a moondreamModelPath in a temp directory, remove it
  if (moondreamModelPath && moondreamModelPath.startsWith(os.tmpdir()) && fs.existsSync(moondreamModelPath)) {
    try {
      fs.unlinkSync(moondreamModelPath);
      console.log(JSON.stringify({ status: 'moondream_model_deleted', path: moondreamModelPath }));
    } catch (err) {
      console.error('Error deleting Moondream model file:', err);
    }
  }

  moondreamModelPath = null;
}

/**
 * Start the Express server on the specified or found port,
 * plus optionally start other services like Moondream.
 */
const startServer = async (params?: any) => {
  let port = params?.port

  if (!port) {
    port = await portfinder.getPortPromise({
      port: 12000,
    });
  }

  // Use tunnelmole to expose the server publicly
  const url = await tunnelmole({ port });

  if (server) {
    console.log(JSON.stringify({ status: 'already_running', url }));
    return;
  }

  const serversToStart = params?.servers;

  // Conditionally add routes / start services based on params.servers
  if (serversToStart) {
    for (const serve of params.servers as Server[]) {
      switch (serve) {
        case 'ollama':
          app.use('/api/v1/', api);
          break;
        case 'embeddings':
          app.use('/api/v1/embeddings', embeddings);
          break;
        case 'tts':
          app.use('/api/v1/tts', tts);
          break;
        case 'scrape':
          app.use('/api/v1/scrape', scrape);
          break;
        default:
          console.error(
            JSON.stringify({ status: 'error', message: `Unknown server type: ${serve}` }),
          );
      }
    }
  }

  // Start Express
  server = app.listen(port, () => {
    console.log(JSON.stringify({ status: 'started', url, params }));
  });
};

/**
 * Stop the Express server, plus any additional services (like Moondream).
 */
const stopServer = (params?: any) => {
  if (!server) {
    console.log(JSON.stringify({ status: 'not_running' }));
    return;
  }

  // Stop Moondream if it was started
  stopMoondreamServer();

  server.close(() => {
    server = null;
    console.log(JSON.stringify({ status: 'stopped', params }));
  });
};

// Parse the `paramsArg` if provided
let params = {};
if (paramsArg) {
  try {
    params = JSON.parse(paramsArg);
  } catch (e) {
    console.error(JSON.stringify({ status: 'error', message: 'Invalid params JSON' }));
    process.exit(1);
  }
}

// Handle commands from CLI
switch (command) {
  case 'start':
    startServer(params);
    break;
  case 'stop':
    stopServer(params);
    break;
  case 'status':
    console.log(JSON.stringify({ status: server ? 'running' : 'stopped' }));
    break;
  case undefined:
    // If no command is provided, start the server (backward compatibility)
    startServer(params);
    break;
  default:
    console.error(JSON.stringify({ status: 'error', message: `Unknown command: ${command}` }));
    process.exit(1);
}