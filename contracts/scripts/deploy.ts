// /Users/rizzytwizzy/prod/cxmpute-core/contracts/scripts/deploy.ts
import { ethers } from "hardhat";
import hre from "hardhat"; // <<< ADD THIS IMPORT for Hardhat Runtime Environment

// Define an interface for the synth details to improve type safety
interface SynthDetail {
  name: string;       // e.g., "Synthetic Bitcoin"
  symbol: string;     // e.g., "sBTC"
  decimals: number;   // e.g., 8
  baseAsset: string;  // e.g., "BTC" (used for logging/reference)
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const coreAddress = process.env.CORE_SIGNER_ADDRESS || deployer.address;
  // const gatewayAddressForVault = process.env.GATEWAY_SIGNER_ADDRESS || deployer.address; // Not strictly needed for Vault constructor if role granted later
  const adminAddress = deployer.address;

  // if (!ethers.isAddress(coreAddress) || !ethers.isAddress(gatewayAddressForVault)) { // gatewayAddressForVault removed from this check
  if (!ethers.isAddress(coreAddress)) {
      throw new Error("CORE_SIGNER_ADDRESS must be a valid address in .env or environment");
  }

  let usdcAddress: string;
  // Use hre.network.name for checking the current network
  if (hre.network.name === 'hardhat' || hre.network.name === 'localhost') {
       console.log("Deploying MockUSDC (as CXPTToken contract type) for local testing...");
       const MockUSDCFactory = await ethers.getContractFactory("CXPTToken");
       // constructor(string memory name, string memory symbol, uint8 decimals_, address initialAdmin)
       const mockUsdc = await MockUSDCFactory.deploy("Mock USDC", "mUSDC", 6, adminAddress);
       await mockUsdc.waitForDeployment();
       usdcAddress = await mockUsdc.getAddress();
       console.log("MockUSDC deployed to:", usdcAddress);
  } else {
      usdcAddress = process.env.USDC_ADDRESS || "";
      if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
          throw new Error(`CRITICAL: USDC_ADDRESS env var must be set for network: ${hre.network.name}.`);
      }
      console.log(`Using existing USDC address for ${hre.network.name}:`, usdcAddress);
  }

  console.log("Deploying CXPTToken...");
  const CXPTTokenFactory = await ethers.getContractFactory("CXPTToken");
  const cxptToken = await CXPTTokenFactory.deploy("Cxmpute Token", "CXPT", 18, adminAddress);
  await cxptToken.waitForDeployment();
  const cxptTokenAddress = await cxptToken.getAddress();
  console.log("CXPTToken deployed to:", cxptTokenAddress);

  console.log("Deploying Vault...");
  const VaultFactory = await ethers.getContractFactory("Vault");
  const vault = await VaultFactory.deploy(
    usdcAddress,
    cxptTokenAddress,
    coreAddress,
    deployer.address // Initial GATEWAY_ROLE holder (can be deployer, will be granted to SynthFactory)
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Vault deployed to:", vaultAddress);

  console.log("Deploying SynthFactory...");
  const SynthFactoryFactory = await ethers.getContractFactory("SynthFactory");
  // constructor(address initialOwner, address vaultAddress)
  const synthFactory = await SynthFactoryFactory.deploy(adminAddress, vaultAddress);
  await synthFactory.waitForDeployment();
  const synthFactoryAddress = await synthFactory.getAddress();
  console.log("SynthFactory deployed to:", synthFactoryAddress);

  console.log(`Granting MINTER_ROLE on CXPTToken (${cxptTokenAddress}) to Vault (${vaultAddress})...`);
  let tx = await cxptToken.grantRole(await cxptToken.MINTER_ROLE(), vaultAddress);
  await tx.wait(1);
  console.log("MINTER_ROLE granted to Vault on CXPTToken.");

  console.log(`Granting GATEWAY_ROLE on Vault (${vaultAddress}) to SynthFactory (${synthFactoryAddress})...`);
  tx = await vault.grantRole(await vault.GATEWAY_ROLE(), synthFactoryAddress);
  await tx.wait(1);
  console.log("GATEWAY_ROLE granted to SynthFactory on Vault.");
  
  const initialSynthsToDeploy: SynthDetail[] = [
    { name: "Synthetic Bitcoin", symbol: "sBTC",  decimals: 8,  baseAsset: "BTC" },
    { name: "Synthetic Ethereum", symbol: "sETH",  decimals: 8,  baseAsset: "ETH" },
    { name: "Synthetic PEAQ",    symbol: "sPEAQ", decimals: 18, baseAsset: "PEAQ" },
    { name: "Synthetic Avalanche",symbol: "sAVAX",decimals: 8, baseAsset: "AVAX" },
    { name: "Synthetic Solana",  symbol: "sSOL",  decimals: 9,  baseAsset: "SOL" },
    { name: "Synthetic BNB",     symbol: "sBNB",  decimals: 8,  baseAsset: "BNB" },
    { name: "Synthetic NEAR",    symbol: "sNEAR", decimals: 24, baseAsset: "NEAR" }, // NEAR uses 24 decimals typically
    { name: "Synthetic Optimism",symbol: "sOP",   decimals: 18, baseAsset: "OP" },  // OP uses 18 decimals
    { name: "Synthetic Polkadot",symbol: "sDOT",  decimals: 10, baseAsset: "DOT" }, // DOT uses 10 decimals
  ];

  console.log("\n--- Deploying Initial Synthetic Assets ---");
  const deployedSynthAddresses: Record<string, string> = {};

  for (const synth of initialSynthsToDeploy) {
    console.log(`Processing synth for ${synth.baseAsset} (Symbol: ${synth.symbol})...`);
    let sAssetAddress = await synthFactory.getSynthBySymbol(synth.symbol);

    if (sAssetAddress && sAssetAddress !== ethers.ZeroAddress) {
      console.log(`  ${synth.symbol} already exists at: ${sAssetAddress}.`);
      // Roles are granted by SynthERC20 constructor to the Vault.
      // SynthFactory's createSynth calls vault.registerSynth.
      // If it already exists, we assume it was correctly set up before or by a previous run.
      // We could add a check here: vault.isRegisteredSynth(sAssetAddress)
      // And if not, and this deployer has GATEWAY_ROLE on vault, register it.
      // However, if factory created it, it should be registered.
    } else {
      console.log(`  Deploying new ${synth.symbol} via SynthFactory...`);
      const createTx = await synthFactory.createSynth(synth.name, synth.symbol, synth.decimals);
      const receipt = await createTx.wait(1);
      
      const createdEvent = receipt?.logs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.map((log: any) => { try { return synthFactory.interface.parseLog(log); } catch { return null; }})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .find((eventLog: any) => eventLog?.name === "SynthCreated");

      if (createdEvent?.args?.synthContractAddress) { // Updated to match event arg name in revised SynthFactory
        sAssetAddress = createdEvent.args.synthContractAddress;
        console.log(`  ${synth.symbol} deployed to: ${sAssetAddress}`);
      } else {
        console.error(`  ERROR: Could not find SynthCreated event or synthContractAddress arg for ${synth.symbol} in transaction ${createTx.hash}`);
        throw new Error(`Synth creation event not found for ${synth.symbol}`);
      }
    }
    deployedSynthAddresses[synth.symbol] = sAssetAddress;
  }
  console.log("--- Initial Synthetic Assets Deployed/Verified ---");

  console.log("\n--- Deployment Summary ---");
  console.log("Deployer Account:", deployer.address);
  console.log("USDC Address (IMPORTANT! Verify for non-local):", usdcAddress);
  console.log("CXPTToken Address:", cxptTokenAddress);
  console.log("Vault Address:", vaultAddress);
  console.log("SynthFactory Address:", synthFactoryAddress);
  console.log("---------------------------");
  console.log("Deployed sASSETs:");
  for (const [symbol, address] of Object.entries(deployedSynthAddresses)) {
    console.log(`  ${symbol}: ${address}`);
  }
  console.log("---------------------------");
  console.log("Assigned Roles:");
  console.log(`  Vault (${vaultAddress}) has MINTER_ROLE on CXPTToken (${cxptTokenAddress})`);
  console.log(`  SynthFactory (${synthFactoryAddress}) has GATEWAY_ROLE on Vault (${vaultAddress})`);
  console.log(`  Vault (${vaultAddress}) has MINTER_ROLE & BURNER_ROLE on all deployed sASSETs (granted by SynthERC20 constructor)`);
  console.log("------------------------\n");
  console.log("✅ Deployment and initial synth setup complete!");
  console.log("➡️ Next Steps: Update backend config (e.g., SST secrets) with Vault and SynthFactory addresses.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });