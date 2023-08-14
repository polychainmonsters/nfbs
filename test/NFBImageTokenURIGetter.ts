import { ethers } from "hardhat";
import { expect } from "chai";

describe("NFBImageTokenURIGetter", () => {
  async function deployFixture() {
    const [deployer] = await ethers.getSigners();

    const MockNFB = await ethers.getContractFactory("MockNFB");
    const mockNFB = await MockNFB.deploy();
    await mockNFB.initialize("Mock Name", "MOCK", deployer.address);
    await mockNFB.setSeries(1, "Mock Series", "Mock Description");

    const NFBImageTokenURIGetter = await ethers.getContractFactory(
      "NFBImageTokenURIGetter"
    );
    const nfbImageTokenURIGetter = await NFBImageTokenURIGetter.deploy(
      mockNFB.address,
      "Mock Name",
      "https://mock-server.com/mock-image.png",
      false
    );
    return { mockNFB, nfbImageTokenURIGetter };
  }

  it("should not return the edition description if flag is set to false", async () => {
    const expectedJson = {
      id: "0",
      name: "Mock Name #0",
      description: "Mock Description",
      image: "https://mock-server.com/mock-image.png",
      attributes: [
        {
          trait_type: "Series",
          value: "Mock Series",
        },
        {
          trait_type: "Series ID",
          display_type: "number",
          value: 1,
        },
        {
          trait_type: "Edition ID",
          display_type: "number",
          value: 1,
        },
        {
          trait_type: "NFB Number",
          display_type: "number",
          value: 0,
        },
      ],
    };

    const { nfbImageTokenURIGetter } = await deployFixture();
    const tokenURI = await nfbImageTokenURIGetter.tokenURI(0, 1, 1, 0);
    // decode the tokenURI
    const decodedTokenURI = Buffer.from(
      tokenURI.split(",")[1],
      "base64"
    ).toString("utf-8");
    expect(decodedTokenURI).to.equal(JSON.stringify(expectedJson));
  });
});
