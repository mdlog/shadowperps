import { expect } from "chai";
import { ethers } from "hardhat";

describe("ShadowPool", function () {
  it("mints LP tokens against pool value before the new deposit", async function () {
    const [owner, provider] = await ethers.getSigners();

    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();
    await usdc.waitForDeployment();

    const poolFactory = await ethers.getContractFactory("ShadowPool");
    const pool = await poolFactory.deploy(await usdc.getAddress());
    await pool.waitForDeployment();

    await usdc.mint(owner.address, 100_000_000n);
    await usdc.mint(provider.address, 100_000_000n);

    await usdc.approve(await pool.getAddress(), 5_000_000n);
    await pool.deposit(5_000_000n);

    // Simulate pool gains so the next LP should mint fewer than a 1:1 amount,
    // but still receive fair value for their deposit.
    await usdc.mint(owner.address, 110_000n);
    await usdc.transfer(await pool.getAddress(), 110_000n);

    const supplyBefore = await pool.totalSupply();
    const poolValueBefore = await pool.getPoolValue();
    const expectedMint = (5_000_000n * supplyBefore) / poolValueBefore;

    await usdc.connect(provider).approve(await pool.getAddress(), 5_000_000n);
    await pool.connect(provider).deposit(5_000_000n);

    const providerLpBalance = await pool.balanceOf(provider.address);
    expect(providerLpBalance).to.equal(expectedMint);

    const totalSupply = await pool.totalSupply();
    const poolValue = await pool.getPoolValue();
    const providerValue = (providerLpBalance * poolValue) / totalSupply;

    expect(providerValue).to.equal(5_000_000n);
  });
});
