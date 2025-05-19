// dex/onchain/vaultHelper.ts
import { ethers } from "ethers";
import { Resource } from "sst";
const { PEAQ_RPC_URL = "https://peaq.api.onfinality.io/public", CHAIN_ID = "3338" } = process.env;
const VAULT_ADDR = Resource.CoreVaultAddress.value;
const CORE_PK = Resource.CoreWalletPk.value;
const abi = [
  // Functions from original vaultHelper + matchEngine
  "function mintSynth(address synth, address to, uint256 amount) external",
  "function burnSynth(address synth, address from, uint256 amount) external",
  "function recordFees(uint256 amount) external",

  // Functions for deposits
  "function deposit(address user, uint256 amount) external",
  "function depositSynthToVault(address userAddress, address synthContract, uint256 amount) external",

  // Functions for withdrawals
  "function withdraw(address userWallet, uint256 amount, bool withdrawAsCxpt) external",
  "function withdrawSynthFromVault(address userWallet, address synthContract, uint256 amount) external",
  "function withdrawFees(address to, uint256 amount) external",

  // Functions for synth registration (typically by SynthFactory/GATEWAY_ROLE or ADMIN_ROLE)
  "function registerSynth(address synthContract) external",
  "function isRegisteredSynth(address synthContract) external view returns (bool)",
];

const provider = new ethers.JsonRpcProvider(PEAQ_RPC_URL!, +CHAIN_ID);
export const vault = new ethers.Contract(
  VAULT_ADDR!,
  abi,
  new ethers.Wallet(CORE_PK!, provider)   // CORE_ROLE signer
);