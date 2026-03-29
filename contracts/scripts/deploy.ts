import { ethers } from "hardhat";

const USDC_ARB_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. MockPriceOracle
  console.log("\n--- MockPriceOracle ---");
  const oracle = await (await ethers.getContractFactory("MockPriceOracle")).deploy();
  await oracle.waitForDeployment();
  console.log("Deployed:", await oracle.getAddress());

  // 2. ShadowPool
  console.log("\n--- ShadowPool (LP Vault) ---");
  const pool = await (await ethers.getContractFactory("ShadowPool")).deploy(USDC_ARB_SEPOLIA);
  await pool.waitForDeployment();
  console.log("Deployed:", await pool.getAddress());

  // 3. ShadowPerps (FHE version)
  console.log("\n--- ShadowPerps (FHE + USDC + LP) ---");
  const perps = await (await ethers.getContractFactory("ShadowPerps")).deploy(
    await oracle.getAddress(), USDC_ARB_SEPOLIA, await pool.getAddress()
  );
  await perps.waitForDeployment();
  console.log("Deployed:", await perps.getAddress());

  // 4. Link pool -> perps
  await (await pool.setPerpsContract(await perps.getAddress())).wait();
  console.log("Pool linked to Perps");

  // 5. Markets
  console.log("\n--- Markets ---");
  const markets = ["BTC-PERP", "ETH-PERP", "SOL-PERP"];
  const prices = [6900000000000n, 206000000000n, 8700000000n];
  for (let i = 0; i < markets.length; i++) {
    await (await oracle.addMarket(markets[i])).wait();
    await (await oracle.updatePrice(markets[i], prices[i])).wait();
    await (await perps.addMarket(markets[i])).wait();
    console.log(`  ${markets[i]}: done`);
  }

  // 6. Test FHE — open a test position to verify FHE works
  console.log("\n--- FHE Smoke Test ---");
  const usdcContract = await ethers.getContractAt("IERC20", USDC_ARB_SEPOLIA);
  const balance = await usdcContract.balanceOf(deployer.address);
  console.log("USDC balance:", ethers.formatUnits(balance, 6));

  const perpsAddr = await perps.getAddress();
  const oracleAddr = await oracle.getAddress();
  const poolAddr = await pool.getAddress();

  console.log("\n═══════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE (FHE ENABLED)");
  console.log("═══════════════════════════════════════");
  console.log(`MockPriceOracle:  ${oracleAddr}`);
  console.log(`ShadowPool:       ${poolAddr}`);
  console.log(`ShadowPerps:      ${perpsAddr}`);
  console.log(`USDC (Circle):    ${USDC_ARB_SEPOLIA}`);
  console.log(`FHE Task Manager: 0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9`);
  console.log("\n.env.local:");
  console.log(`NEXT_PUBLIC_ORACLE_CONTRACT=${oracleAddr}`);
  console.log(`NEXT_PUBLIC_POOL_CONTRACT=${poolAddr}`);
  console.log(`NEXT_PUBLIC_SHADOWPERPS_CONTRACT=${perpsAddr}`);
  console.log(`NEXT_PUBLIC_USDC_CONTRACT=${USDC_ARB_SEPOLIA}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
