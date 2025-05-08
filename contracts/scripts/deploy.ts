// /Users/rizzytwizzy/prod/cxmpute-core/contracts/scripts/deploy.ts
import { ethers } from "hardhat"; // Use Hardhat's ethers instance

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // --- Addresses needed for deployment (Update these based on your setup) ---
  // You'll need the addresses of your backend components that need roles.
  // Get these from your SST output or environment variables.
  const coreAddress = process.env.CORE_SIGNER_ADDRESS || "0xReplaceWithCoreSignerAddress"; // Matcher Lambda Signer
  const gatewayAddress = process.env.GATEWAY_SIGNER_ADDRESS || "0xReplaceWithGatewaySignerAddress"; // API Gateway Lambda Signer
  const adminAddress = deployer.address; // Often the deployer starts as admin

  if (!ethers.isAddress(coreAddress) || !ethers.isAddress(gatewayAddress)) {
      throw new Error("CORE_SIGNER_ADDRESS and GATEWAY_SIGNER_ADDRESS must be valid addresses in .env or environment");
  }

  // --- 1. Deploy USDC Mock (ONLY FOR TESTING - Replace with actual Peaq USDC address for Agung/Mainnet) ---
  // IMPORTANT: For real deployment, get the OFFICIAL Peaq USDC address for the target network!
  let usdcAddress: string;
  if (process.env.HARDHAT_NETWORK === 'hardhat' || process.env.HARDHAT_NETWORK === 'localhost') {
       console.log("Deploying MockUSDC for local testing...");
       const MockUSDC = await ethers.getContractFactory("CXPTToken"); // Re-using ERC20 for mock
       const mockUsdc = await MockUSDC.deploy(deployer.address); // Deployer can mint mock tokens
       await mockUsdc.waitForDeployment();
       usdcAddress = await mockUsdc.getAddress();
       console.log("MockUSDC deployed to:", usdcAddress);
       // Optionally mint some mock USDC to the deployer for testing deposits
       // await mockUsdc.mint(deployer.address, ethers.parseUnits("1000000", 6)); // Mint 1M mock USDC (assuming 6 decimals)
       // console.log("Minted 1M MockUSDC to deployer");
  } else {
      usdcAddress = process.env.USDC_ADDRESS || "0xReplaceWithActualPeaqUsdcAddress"; // Get actual address for Peaq/Agung
      if (!ethers.isAddress(usdcAddress)) {
          throw new Error("USDC_ADDRESS environment variable must be set to the official Peaq USDC contract address for this network.");
      }
      console.log("Using existing USDC address:", usdcAddress);
  }


  // --- 2. Deploy CXPTToken ---
  // The Vault address isn't known yet, so we deploy CXPT first,
  // and the Vault constructor will get MINTER_ROLE later implicitly if needed,
  // OR we grant it manually after Vault deployment. Let's grant it manually.
  console.log("Deploying CXPTToken...");
  const CXPTTokenFactory = await ethers.getContractFactory("CXPTToken");
  // Pass deployer as initial admin, vault address will be granted role later
  const cxptToken = await CXPTTokenFactory.deploy(adminAddress); // Pass *something* valid, we'll grant role later
  await cxptToken.waitForDeployment();
  const cxptTokenAddress = await cxptToken.getAddress();
  console.log("CXPTToken deployed to:", cxptTokenAddress);


  // --- 3. Deploy Vault ---
  // Vault needs USDC, CXPT, CORE, and GATEWAY addresses
  console.log("Deploying Vault...");
  const VaultFactory = await ethers.getContractFactory("Vault");
  const vault = await VaultFactory.deploy(
    usdcAddress,
    cxptTokenAddress,
    coreAddress,
    gatewayAddress
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Vault deployed to:", vaultAddress);


  // --- 4. Deploy SynthFactory ---
  // Factory needs the Vault address
  console.log("Deploying SynthFactory...");
  const SynthFactoryFactory = await ethers.getContractFactory("SynthFactory");
  const synthFactory = await SynthFactoryFactory.deploy(vaultAddress);
  await synthFactory.waitForDeployment();
  const synthFactoryAddress = await synthFactory.getAddress();
  console.log("SynthFactory deployed to:", synthFactoryAddress);


  // --- 5. Grant Roles (Post-Deployment) ---
  // Grant MINTER_ROLE on CXPTToken to the deployed Vault
  console.log(`Granting MINTER_ROLE on CXPTToken (${cxptTokenAddress}) to Vault (${vaultAddress})...`);
  const grantTx = await cxptToken.grantRole(await cxptToken.MINTER_ROLE(), vaultAddress);
  await grantTx.wait(1); // Wait for confirmation
  console.log("MINTER_ROLE granted to Vault on CXPTToken.");

  // Optional: Grant ADMIN_ROLE, CORE_ROLE, GATEWAY_ROLE on Vault to other addresses if needed
  // Example: Grant ADMIN_ROLE to another admin multisig
  // const anotherAdmin = "0x...";
  // console.log(`Granting ADMIN_ROLE on Vault to ${anotherAdmin}...`);
  // const grantAdminTx = await vault.grantRole(await vault.ADMIN_ROLE(), anotherAdmin);
  // await grantAdminTx.wait(1);
  // console.log("ADMIN_ROLE granted.");

  console.log("\n--- Deployment Summary ---");
  console.log("Deployer:", deployer.address);
  console.log("USDC Address:", usdcAddress);
  console.log("CXPTToken Address:", cxptTokenAddress);
  console.log("Vault Address:", vaultAddress);
  console.log("SynthFactory Address:", synthFactoryAddress);
  console.log("CORE_ROLE Address:", coreAddress);
  console.log("GATEWAY_ROLE Address:", gatewayAddress);
  console.log("------------------------\n");
  console.log("✅ Deployment complete!");

  // TODO: Save these addresses to your SST config/secrets or a deployment info file
  // for your backend application to use.
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });