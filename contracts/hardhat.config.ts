import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const { PRIVATE_KEY, AGUNG_RPC, PEAQ_RPC } = process.env;

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    agung: {
      url: AGUNG_RPC,
      chainId: 9990,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    peaq: {
      url: PEAQ_RPC,
      chainId: 3338,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
