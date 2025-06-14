import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with", deployer.address, "to", network.name);

  // 1. CXPT token
  const CXPT = await ethers.getContractFactory("CXPTToken");
  const cxpt = await CXPT.deploy(deployer.address);
  await cxpt.waitForDeployment();
  console.log("CXPT", await cxpt.getAddress());

  // 2. RewardDistributor
  const RD = await ethers.getContractFactory("RewardDistributor");
  const rd = await RD.deploy(await cxpt.getAddress());
  await rd.waitForDeployment();
  console.log("RewardDistributor", await rd.getAddress());

  // 3. Vault
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(await cxpt.getAddress());
  await vault.waitForDeployment();
  console.log("Vault", await vault.getAddress());
  await (await vault.setRewardDistributor(await rd.getAddress())).wait();

  // 4. CommunityVester (paused for testnet by setting start far future)
  const nowTs = await blockTimestamp();
  const start = network.name === "agung" ? nowTs + 31536000 : nowTs;
  const CV = await ethers.getContractFactory("CommunityVester");
  const comm = await CV.deploy(await cxpt.getAddress(), await rd.getAddress(), start);
  await comm.waitForDeployment();
  console.log("CommunityVester", await comm.getAddress());

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