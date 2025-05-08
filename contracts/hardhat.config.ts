// /Users/rizzytwizzy/prod/cxmpute-core/contracts/hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Ensure necessary environment variables are set
const PEAQ_RPC_URL = process.env.PEAQ_RPC_URL || "";
const AGUNG_RPC_URL = process.env.AGUNG_RPC_URL || "https://rpcpc1-qa.agung.peaq.network"; // Default Agung RPC
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || ""; // Your deployment wallet private key

if (!DEPLOYER_PRIVATE_KEY) {
  console.warn("⚠️ DEPLOYER_PRIVATE_KEY environment variable not set. Deployment transactions will fail.");
}
 if (!PEAQ_RPC_URL) {
    console.warn("⚠️ PEAQ_RPC_URL environment variable not set. Deployment to Peaq mainnet will fail.");
 }


const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24", // Match your contract pragma
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Standard optimization setting
      },
    },
  },
  networks: {
    // Peaq Mainnet Configuration
    peaq: {
      url: PEAQ_RPC_URL,
      chainId: 3338, // Peaq Mainnet Chain ID
      accounts: DEPLOYER_PRIVATE_KEY !== '' ? [DEPLOYER_PRIVATE_KEY] : [],
      // gasPrice: 100000000000, // Optional: Set gas price (e.g., 100 Gwei) if needed
    },
    // Peaq Agung Testnet Configuration
    agung: {
      url: AGUNG_RPC_URL,
      chainId: 9990, // Agung Testnet Chain ID
      accounts: DEPLOYER_PRIVATE_KEY !== '' ? [DEPLOYER_PRIVATE_KEY] : [],
       // gasPrice: 100000000000, // Optional: Set gas price (e.g., 100 Gwei)
    },
    // Local Hardhat Network (for testing)
    hardhat: {
      chainId: 31337, // Default Hardhat network chain ID
    },
    // localhost: { // Optional: If running a local node like Anvil/Ganache
    //   url: "http://127.0.0.1:8545",
    //   chainId: 31337, // Match your local node's chain ID
    // }
  },
  paths: {
    sources: "./contracts",   // Where your .sol files are
    tests: "./test",          // Where your test files will go
    cache: "./cache",         // Hardhat cache files
    artifacts: "./artifacts", // Compiled contract output (ABI, bytecode)
  },
  mocha: {
    timeout: 40000 // Increase timeout for tests if needed
  },
  // Optional: Etherscan/Blockscout verification config (Peaqscan might need custom setup)
  // etherscan: {
  //   apiKey: {
  //      peaq: "YOUR_PEAQSCAN_API_KEY", // Placeholder - Peaqscan might not use API keys like Etherscan
  //      agung: "YOUR_AGUNG_EXPLORER_API_KEY" // Placeholder
  //   },
  //   customChains: [
  //     {
  //       network: "peaq",
  //       chainId: 3338,
  //       urls: {
  //         apiURL: "https://peaq.subscan.io/api/scan", // Adjust if Peaqscan has a different API endpoint
  //         browserURL: "https://peaq.subscan.io"
  //       }
  //     },
  //     {
  //       network: "agung",
  //       chainId: 9990,
  //       urls: {
  //         apiURL: "https://agung.subscan.io/api/scan", // Adjust if Agung explorer has a different API endpoint
  //         browserURL: "https://agung.subscan.io"
  //       }
  //     }
  //   ]
  // }
};

export default config;