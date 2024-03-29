// test for the BitwiseOperationsTester contract
import { ethers } from "hardhat";
import { expect } from "chai";

describe("BitwiseOperations", () => {
  async function deployFixture() {
    const [owner, otherAccount, minter] = await ethers.getSigners();
    const BitwiseOperationsTester = await ethers.getContractFactory(
      "BitwiseOperationsTester"
    );
    const bitwiseOperationsTester = await BitwiseOperationsTester.deploy();
    return { owner, otherAccount, minter, bitwiseOperationsTester };
  }

  it("should return the correct value", async () => {
    const { bitwiseOperationsTester } = await deployFixture();
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        for (let k = 0; k < 10; k++) {
          const joined =
            await bitwiseOperationsTester.joinSeriesEditionAndVariant(i, j, k);
          const [splitI, splitJ, splitK] =
            await bitwiseOperationsTester.splitSeriesEditionAndVariant(joined);
          expect(i).to.equal(splitI);
          expect(j).to.equal(splitJ);
          expect(k).to.equal(splitK);
        }
      }
    }
  });
});
