#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
// Integrity check (exits process if tampered)
import { verifyIntegrity } from './lib/hashCheck.js';
// import meow from 'meow';
import App from './app.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Environment Variable Loading ---
// Get the directory of the current module.
// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

// Construct the path to the root of the cxmpute-core project.
// This assumes the CLI is in /clis/cxmpute-provider/dist (or source).
const projectRoot = path.resolve(__dirname, '..', '..', '..');

// Load the .env file from the project root.
dotenv.config({ path: path.join(projectRoot, '.env') });
// --- End Environment Variable Loading ---

// const cli = meow(
// 	`// 	Usage
// 	  $ cxmpute-provider

// 	Description
// 	  Starts the Cxmpute Provider CLI to connect your device to the network.

// 	Options
// 	  --help     Show this help message
// 	  --version  Show version information

// 	Examples
// 	  $ cxmpute-provider
// `,
// 	{
// 		importMeta: import.meta,
// 		flags: {
//             // Remove name flag if not used
// 			// name: {
// 			// 	type: 'string',
// 			// },
// 		},
// 	},
// );

// Perform integrity verification before continuing
verifyIntegrity();

// Pass flags if App component expects them, otherwise, just <App />
render(<App /* name={cli.flags.name} */ />);
