// dex/onchain/vaultHelper.ts
import { ethers } from "ethers";
import { Resource } from "sst";
const { PEAQ_RPC_URL, CHAIN_ID = "3338" } = process.env;
const VAULT_ADDR = Resource.CoreVaultAddress.value;
const CORE_PK = Resource.CoreWalletPk.value;
const abi = [
  "function mintSynth(address synth,address to,uint256 amt)",
  "function burnSynth(address synth,address from,uint256 amt)",
];

const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL!, +CHAIN_ID);
export const vault = new ethers.Contract(
  VAULT_ADDR!,
  abi,
  new ethers.Wallet(CORE_PK!, provider)   // CORE_ROLE signer
);