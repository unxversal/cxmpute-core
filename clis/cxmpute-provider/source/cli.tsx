#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
// import meow from 'meow';
import App from './app.js';

// const cli = meow(
// 	`
// 	Usage
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

// Pass flags if App component expects them, otherwise, just <App />
render(<App /* name={cli.flags.name} */ />);