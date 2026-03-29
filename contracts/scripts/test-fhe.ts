import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Deploy FHETest
  console.log("\n--- Deploying FHETest ---");
  const FHETest = await ethers.getContractFactory("FHETest");
  const test = await FHETest.deploy();
  await test.waitForDeployment();
  const addr = await test.getAddress();
  console.log("FHETest deployed:", addr);

  // 2. Test trivial encrypt
  console.log("\n--- Test: FHE.asEuint64(42) ---");
  try {
    const tx = await test.testTrivialEncrypt(42);
    const receipt = await tx.wait();
    console.log("SUCCESS! Gas used:", receipt?.gasUsed?.toString());

    const success = await test.lastSuccess();
    console.log("lastSuccess:", success);

    const encrypted = await test.lastEncrypted();
    console.log("lastEncrypted (handle):", encrypted.toString());
  } catch (e: any) {
    console.log("FAILED:", e.message?.slice(0, 300));
  }

  // 3. Test encrypted add
  console.log("\n--- Test: FHE.add(100, 200) ---");
  try {
    const tx2 = await test.testAdd(100, 200);
    const receipt2 = await tx2.wait();
    console.log("SUCCESS! Gas used:", receipt2?.gasUsed?.toString());

    const encrypted2 = await test.lastEncrypted();
    console.log("lastEncrypted (handle):", encrypted2.toString());
  } catch (e: any) {
    console.log("FAILED:", e.message?.slice(0, 300));
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
