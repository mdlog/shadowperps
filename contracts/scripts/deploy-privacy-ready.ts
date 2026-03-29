import { ethers } from "hardhat";

const DEFAULT_USDC_ARB_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const usdcAddress =
    process.env.NEXT_PUBLIC_USDC_CONTRACT ||
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    DEFAULT_USDC_ARB_SEPOLIA;
  const futurePerpsAddress = process.env.PRIVACY_POOL_V2_PERPS_CONTRACT;

  console.log("Network:", network.name, `(${network.chainId})`);
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );
  console.log("Settlement asset:", usdcAddress);

  console.log("\n--- ConfidentialAssetVault ---");
  const vault = await (
    await ethers.getContractFactory("ConfidentialAssetVault")
  ).deploy(usdcAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Deployed:", vaultAddress);

  console.log("\n--- ShadowPoolV2 ---");
  const pool = await (await ethers.getContractFactory("ShadowPoolV2")).deploy(
    vaultAddress
  );
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("Deployed:", poolAddress);

  console.log("\n--- Wiring ---");
  await (await vault.setController(poolAddress, true)).wait();
  console.log("Vault controller granted to ShadowPoolV2");

  if (futurePerpsAddress && ethers.isAddress(futurePerpsAddress)) {
    await (await pool.setPerpsContract(futurePerpsAddress)).wait();
    console.log("ShadowPoolV2 linked to perps:", futurePerpsAddress);
  } else {
    console.log(
      "Perps link skipped. Set PRIVACY_POOL_V2_PERPS_CONTRACT later when ShadowPerpsV2 is ready."
    );
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  PRIVACY-READY LP DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`ConfidentialAssetVault: ${vaultAddress}`);
  console.log(`ShadowPoolV2:           ${poolAddress}`);
  console.log(`USDC:                   ${usdcAddress}`);
  console.log("\nOptional .env.local snippet:");
  console.log(`CONFIDENTIAL_ASSET_VAULT_CONTRACT=${vaultAddress}`);
  console.log(`SHADOWPOOL_V2_CONTRACT=${poolAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
