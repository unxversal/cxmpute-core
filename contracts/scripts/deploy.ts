// /Users/rizzytwizzy/prod/cxmpute-core/contracts/scripts/deploy.ts
import { ethers } from "hardhat";
import hre from "hardhat"; // Hardhat Runtime Environment

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
  const adminAddress = deployer.address; // Deployer will be admin for contracts where applicable

  if (!ethers.isAddress(coreAddress)) {
      throw new Error("CORE_SIGNER_ADDRESS must be a valid address in .env or environment");
  }

  // For mainnet or testnet deployments, USDC_ADDRESS must be set in your .env file
  const usdcAddress = process.env.USDC_ADDRESS || "";
  if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
      throw new Error(`CRITICAL: USDC_ADDRESS env var must be set and be a valid address for network: ${hre.network.name}.`);
  }
  console.log(`Using USDC address for ${hre.network.name}:`, usdcAddress);

  console.log("Deploying CXPTToken...");
  const CXPTTokenFactory = await ethers.getContractFactory("CXPTToken");
  // Constructor for CXPTToken is now `constructor(address initialAdmin)`
  // Name "Cxmpute Token", Symbol "CXPT" are hardcoded in CXPTToken.sol's ERC20 base call.
  // Decimals are 18 by default in OZ ERC20, matching earlier intent.
  const cxptToken = await CXPTTokenFactory.deploy(adminAddress);
  await cxptToken.waitForDeployment();
  const cxptTokenAddress = await cxptToken.getAddress();
  console.log("CXPTToken deployed to:", cxptTokenAddress);

  console.log("Deploying Vault...");
  const VaultFactory = await ethers.getContractFactory("Vault");
  const vault = await VaultFactory.deploy(
    usdcAddress,
    cxptTokenAddress,
    coreAddress,
    deployer.address // Initial GATEWAY_ROLE holder (deployer), will be granted to SynthFactory later.
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
  await tx.wait(1); // Wait for 1 confirmation
  console.log("MINTER_ROLE granted to Vault on CXPTToken.");

  console.log(`Granting GATEWAY_ROLE on Vault (${vaultAddress}) to SynthFactory (${synthFactoryAddress})...`);
  tx = await vault.grantRole(await vault.GATEWAY_ROLE(), synthFactoryAddress);
  await tx.wait(1); // Wait for 1 confirmation
  console.log("GATEWAY_ROLE granted to SynthFactory on Vault.");
  
  const initialSynthsToDeploy: SynthDetail[] = [
    { name: "Synthetic Bitcoin", symbol: "sBTC",  decimals: 8,  baseAsset: "BTC" },
    { name: "Synthetic Ethereum", symbol: "sETH",  decimals: 8,  baseAsset: "ETH" },
    { name: "Synthetic PEAQ",    symbol: "sPEAQ", decimals: 18, baseAsset: "PEAQ" },
    { name: "Synthetic Avalanche",symbol: "sAVAX",decimals: 8, baseAsset: "AVAX" },
    { name: "Synthetic Solana",  symbol: "sSOL",  decimals: 9,  baseAsset: "SOL" },
    { name: "Synthetic BNB",     symbol: "sBNB",  decimals: 8,  baseAsset: "BNB" },
    // NEAR typically uses 24 decimals. Your SynthERC20 supports up to 18 via `uint8 decimals_`.
    // If you need >18 decimals, SynthERC20 and SynthFactory might need `uint256 decimals_`.
    // For now, assuming 18 is the max, or NEAR's synth will also use up to 18.
    // The original script had 24 for sNEAR, but SynthFactory restricts to 1-18.
    // Let's adjust sNEAR to 18 to match current contract constraints or note this.
    { name: "Synthetic NEAR",    symbol: "sNEAR", decimals: 18, baseAsset: "NEAR" }, // Max 18 decimals due to SynthFactory uint8 constraint
    { name: "Synthetic Optimism",symbol: "sOP",   decimals: 18, baseAsset: "OP" },
    { name: "Synthetic Polkadot",symbol: "sDOT",  decimals: 10, baseAsset: "DOT" },
  ];

  console.log("\n--- Deploying Initial Synthetic Assets ---");
  const deployedSynthAddresses: Record<string, string> = {};

  for (const synth of initialSynthsToDeploy) {
    console.log(`Processing synth for ${synth.baseAsset} (Symbol: ${synth.symbol}, Decimals: ${synth.decimals})...`);
    
    // Check SynthFactory constraints for decimals
    if (synth.decimals <= 0 || synth.decimals > 18) {
        console.warn(`  WARNING: Decimal ${synth.decimals} for ${synth.symbol} is outside the factory's allowed range (1-18). Skipping or adjusting might be needed if this is an issue.`);
        // Potentially skip or throw error: throw new Error(`Invalid decimals for ${synth.symbol}`);
    }

    let sAssetAddress = await synthFactory.getSynthBySymbol(synth.symbol);

    if (sAssetAddress && sAssetAddress !== ethers.ZeroAddress) {
      console.log(`  ${synth.symbol} already exists at: ${sAssetAddress}.`);
      // Assuming if it exists, it was correctly set up.
    } else {
      console.log(`  Deploying new ${synth.symbol} via SynthFactory...`);
      const createTx = await synthFactory.createSynth(synth.name, synth.symbol, synth.decimals);
      const receipt = await createTx.wait(1); // Wait for 1 confirmation
      
      // Correctly parse the event log
      const createdEvent = receipt?.logs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.map((log: any) => { try { return synthFactory.interface.parseLog(log); } catch { return null; }})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .find((eventLog: any) => eventLog?.name === "SynthCreated");

      // Event argument name in SynthFactory.sol is 'synthContract'
      if (createdEvent?.args?.synthContract) {
        sAssetAddress = createdEvent.args.synthContract;
        console.log(`  ${synth.symbol} deployed to: ${sAssetAddress}`);
      } else {
        console.error(`  ERROR: Could not find SynthCreated event or synthContract arg for ${synth.symbol} in transaction ${createTx.hash}`);
        // Try logging all events if debugging is needed
        // console.error("All parsed events in receipt:", receipt?.logs?.map((log: any) => { try { return synthFactory.interface.parseLog(log); } catch { return null; }}).filter(e => e));
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
  console.log("Core Signer Address used for Vault's CORE_ROLE:", coreAddress);
  console.log("---------------------------");
  console.log("Deployed sASSETs:");
  for (const [symbol, address] of Object.entries(deployedSynthAddresses)) {
    console.log(`  ${symbol}: ${address}`);
  }
  console.log("---------------------------");
  console.log("Assigned Roles:");
  console.log(`  Vault (${vaultAddress}) has MINTER_ROLE on CXPTToken (${cxptTokenAddress})`);
  console.log(`  SynthFactory (${synthFactoryAddress}) has GATEWAY_ROLE on Vault (${vaultAddress})`);
  console.log(`  Vault (${vaultAddress}) has MINTER_ROLE & BURNER_ROLE on all deployed sASSETs (granted by SynthERC20 constructor via SynthFactory)`);
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