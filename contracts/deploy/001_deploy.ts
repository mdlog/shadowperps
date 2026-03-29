import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying with account:", deployer);

  // 1. Deploy MockPriceOracle
  const oracle = await deploy("MockPriceOracle", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
  console.log("MockPriceOracle deployed at:", oracle.address);

  // 2. Deploy ShadowPerps with oracle address
  const shadowPerps = await deploy("ShadowPerps", {
    from: deployer,
    args: [oracle.address],
    log: true,
    waitConfirmations: 1,
  });
  console.log("ShadowPerps deployed at:", shadowPerps.address);

  // 3. Initialize markets on oracle
  const oracleContract = await hre.ethers.getContractAt("MockPriceOracle", oracle.address);

  const markets = ["BTC-PERP", "ETH-PERP", "SOL-PERP"];
  const initialPrices = [
    6784250000000n,  // $67,842.50 (8 decimals)
    352180000000n,   // $3,521.80
    17845000000n,    // $178.45
  ];

  for (let i = 0; i < markets.length; i++) {
    await oracleContract.addMarket(markets[i]);
    await oracleContract.updatePrice(markets[i], initialPrices[i]);
    console.log(`Market ${markets[i]} added with price ${initialPrices[i]}`);
  }

  // 4. Add markets to ShadowPerps
  const perpsContract = await hre.ethers.getContractAt("ShadowPerps", shadowPerps.address);
  for (const market of markets) {
    await perpsContract.addMarket(market);
    console.log(`Market ${market} added to ShadowPerps`);
  }

  console.log("\n=== Deployment Complete ===");
  console.log("MockPriceOracle:", oracle.address);
  console.log("ShadowPerps:", shadowPerps.address);
  console.log("Markets:", markets.join(", "));
};

func.tags = ["ShadowPerps"];
export default func;
