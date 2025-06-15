import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Deployment script now deploys:
 * 1. CXPTToken
 * 2. MultisigControl (with deployer + 2 placeholder addresses for example, threshold 2)
 * 3. RewardDistributor owned by MultisigControl
 * 4. Vault + wiring to distributor
 * 5. CommunityVester
 * 6. SubscriptionManager owned by Peaq admin (deployer for now)
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with", deployer.address, "to", network.name);

  // 1. CXPT token
  const CXPT = await ethers.getContractFactory("CXPTToken");
  const cxpt = await CXPT.deploy(deployer.address);
  await cxpt.waitForDeployment();
  console.log("CXPT", await cxpt.getAddress());

  // 2. MultisigControl (placeholder owners & threshold)
  const extra = [process.env.UNXVERSAL_ONE, process.env.UNXVERSAL_TWO, process.env.UNXVERSAL_THREE].filter(Boolean) as string[];
  const owners = Array.from(new Set([deployer.address, ...extra]));
  const Multisig = await ethers.getContractFactory("MultisigControl");
  const multisig = await Multisig.deploy(owners, 2);
  await multisig.waitForDeployment();
  console.log("MultisigControl", await multisig.getAddress());

  // 3. RewardDistributor (owner = multisig)
  const RD = await ethers.getContractFactory("RewardDistributor");
  const rd = await RD.deploy(await cxpt.getAddress(), await multisig.getAddress());
  await rd.waitForDeployment();
  console.log("RewardDistributor", await rd.getAddress());

  // 4. Vault
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(await cxpt.getAddress());
  await vault.waitForDeployment();
  console.log("Vault", await vault.getAddress());
  await (await vault.setRewardDistributor(await rd.getAddress())).wait();

  // 5. CommunityVester (paused for testnet by setting start far future)
  const nowTs = await blockTimestamp();
  const start = network.name === "agung" ? nowTs + 31536000 : nowTs;
  const CV = await ethers.getContractFactory("CommunityVester");
  const comm = await CV.deploy(await cxpt.getAddress(), await rd.getAddress(), start);
  await comm.waitForDeployment();
  console.log("CommunityVester", await comm.getAddress());

  // 6. SubscriptionManager (base URI blank for now)
  const Sub = await ethers.getContractFactory("SubscriptionManager");
  const sm = await Sub.deploy("", deployer.address);
  await sm.waitForDeployment();
  console.log("SubscriptionManager", await sm.getAddress());

  // Timelock & escrow omitted for brevity
}

async function blockTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block?.timestamp ?? Math.floor(Date.now() / 1000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}); 