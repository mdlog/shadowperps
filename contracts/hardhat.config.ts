import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "cofhe-hardhat-plugin";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    // Arbitrum Sepolia — recommended for lower gas
    arbSepolia: {
      url: process.env.ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    // Ethereum Sepolia
    sepolia: {
      url: process.env.SEPOLIA_RPC || "https://ethereum-sepolia.publicnode.com",
      chainId: 11155111,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  namedAccounts: {
    deployer: { default: 0 },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
