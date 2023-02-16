import { expect } from "chai";
import { ethers } from "hardhat";
import { parseTokenUri, deployFixture } from "./utils";

describe("NFBAndPurchaser", function () {
  async function deployFixture() {
    const [owner, otherAccount, minter] = await ethers.getSigners();
    const NFB = await ethers.getContractFactory("NFB");
    const nfb = await NFB.deploy("Test NFB", "TNFB");
    await nfb.grantRole(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")),
      minter.address
    );

    const MockNFBTokenURIGetter = await ethers.getContractFactory(
      "MockNFBTokenURIGetter"
    );
    const mockNFBTokenURIGetter = await MockNFBTokenURIGetter.deploy(
      nfb.address
    );

    await nfb.setSeries(1, "Series 1", "Test description for series 1");
    await nfb.setSeries(2, "Series 2", "Test description for series 2");

    const latestBlock = await ethers.provider.getBlock("latest");

    // we set them all available
    await nfb.setEdition(
      1,
      1,
      latestBlock.timestamp - 100,
      latestBlock.timestamp + 100,
      "Test Edition 1"
    );
    await nfb.setEdition(
      2,
      1,
      latestBlock.timestamp - 100,
      latestBlock.timestamp + 100,
      "Test Edition 1"
    );
    await nfb.setEdition(
      1,
      2,
      latestBlock.timestamp - 100,
      latestBlock.timestamp + 100,
      "Test Edition 2"
    );

    // deploy the image token URI getter
    const NFBImageTokenURIGetter = await ethers.getContractFactory(
      "NFBImageTokenURIGetter"
    );
    const nfbImageTokenURIGetter = await NFBImageTokenURIGetter.deploy(
      nfb.address,
      "Test NFB",
      "ipfs://QmeqjYUz5eUHqxZFzQuvYtUCm7yvSY1TYCbxUPzv5UEidm"
    );
    await nfb.setTokenURIGetter(1, 1, nfbImageTokenURIGetter.address);
    await nfb.setTokenURIGetter(1, 2, nfbImageTokenURIGetter.address);
    await nfb.setTokenURIGetter(2, 1, nfbImageTokenURIGetter.address);

    return {
      minter,
      mockNFBTokenURIGetter,
      owner,
      otherAccount,
      nfb,
    };
  }

  describe("Interface", async () => {
    it("should implement ERC721", async () => {
      const { nfb } = await deployFixture();
      expect(await nfb.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("should implement ERC721Metadata", async () => {
      const { nfb } = await deployFixture();
      expect(await nfb.supportsInterface("0x5b5e139f")).to.be.true;
    });
  });

  describe("Manager functions", async () => {
    it("should allow setting edition info", async () => {
      const { nfb, otherAccount } = await deployFixture();
      await nfb.setSeries(3, "Edition 3", "Test description for edition 3");
    });

    it("should not allow setting edition info from non permitted wallet", async () => {
      const { nfb, otherAccount } = await deployFixture();
      await expect(
        nfb
          .connect(otherAccount)
          .setSeries(3, "Edition 3", "Test description for edition 3")
      ).to.be.revertedWith(
        "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
      );
    });

    it("should not allow setting edition info when frozen", async () => {
      const { nfb, otherAccount } = await deployFixture();
      await nfb.freezeSeries(1);

      await expect(
        nfb.setSeries(1, "Edition 3", "Test description for edition 3")
      ).to.be.revertedWith("NFB: Series already frozen");
    });

    it("should only allow freezing for the manager", async () => {
      const { nfb, otherAccount } = await deployFixture();
      await expect(
        nfb.connect(otherAccount).freezeSeries(1)
      ).to.be.revertedWith(
        "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
      );
    });

    it("should allow freezing series", async () => {
      const { nfb } = await deployFixture();
      await nfb.freezeSeries(1);
      expect(await nfb.isSeriesFrozen(1)).to.be.true;
    });

    it("should not allow freezing series twice", async () => {
      const { nfb } = await deployFixture();
      await nfb.freezeSeries(1);
      await expect(nfb.freezeSeries(1)).to.be.revertedWith(
        "NFB: Series already frozen"
      );
    });
  });

  describe("Minting", async () => {
    it("should revert returning the token URI for a non existent token", async () => {
      const { nfb, otherAccount } = await deployFixture();
      await expect(nfb.tokenURI(1)).to.be.revertedWith(
        "NFB: Non-existent token"
      );
    });

    it("should not allow minting without minter role", async () => {
      const { nfb, otherAccount } = await deployFixture();

      const minterRole = await nfb.MINTER_ROLE();
      await expect(
        nfb.connect(otherAccount).mint(otherAccount.address, 20, 1, 1)
      ).to.be.revertedWith(
        `AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role ${minterRole}`
      );
    });

    it("should allow minting for existing editions", async () => {
      const { minter, nfb, otherAccount } = await deployFixture();

      await nfb.connect(minter).mint(otherAccount.address, 20, 2, 1);
      await nfb.connect(minter).mint(otherAccount.address, 20, 1, 1);
      await nfb.connect(minter).mint(otherAccount.address, 20, 1, 2);

      const tokenUriExample_id5 = parseTokenUri(await nfb.tokenURI(5));
      const tokenUriExample_id30 = parseTokenUri(await nfb.tokenURI(30));
      const tokenUriExample_id45 = parseTokenUri(await nfb.tokenURI(45));

      expect(tokenUriExample_id5.name).to.equal("Test NFB #5");
      expect(tokenUriExample_id30.name).to.equal("Test NFB #30");
      expect(tokenUriExample_id45.name).to.equal("Test NFB #45");

      expect(tokenUriExample_id5.description).to.equal(
        "Test description for series 2"
      );
      expect(tokenUriExample_id30.description).to.equal(
        "Test description for series 1"
      );
      expect(tokenUriExample_id45.description).to.equal(
        "Test description for series 1"
      );

      expect(tokenUriExample_id5.image).to.equal(
        "ipfs://QmeqjYUz5eUHqxZFzQuvYtUCm7yvSY1TYCbxUPzv5UEidm"
      );
      expect(tokenUriExample_id30.image).to.equal(
        "ipfs://QmeqjYUz5eUHqxZFzQuvYtUCm7yvSY1TYCbxUPzv5UEidm"
      );
      expect(tokenUriExample_id45.image).to.equal(
        "ipfs://QmeqjYUz5eUHqxZFzQuvYtUCm7yvSY1TYCbxUPzv5UEidm"
      );

      expect(tokenUriExample_id5.attributes[0].trait_type).to.equal("Series");
      expect(tokenUriExample_id5.attributes[0].value).to.equal("Series 2");
      expect(tokenUriExample_id30.attributes[0].trait_type).to.equal("Series");
      expect(tokenUriExample_id30.attributes[0].value).to.equal("Series 1");
      expect(tokenUriExample_id45.attributes[0].trait_type).to.equal("Series");
      expect(tokenUriExample_id45.attributes[0].value).to.equal("Series 1");

      expect(tokenUriExample_id5.attributes[1].trait_type).to.equal(
        "Series ID"
      );
      expect(tokenUriExample_id5.attributes[1].value).to.equal(2);
      expect(tokenUriExample_id5.attributes[1].display_type).to.equal("number");
      expect(tokenUriExample_id30.attributes[1].trait_type).to.equal(
        "Series ID"
      );
      expect(tokenUriExample_id30.attributes[1].value).to.equal(1);
      expect(tokenUriExample_id30.attributes[1].display_type).to.equal(
        "number"
      );
      expect(tokenUriExample_id45.attributes[1].trait_type).to.equal(
        "Series ID"
      );
      expect(tokenUriExample_id45.attributes[1].value).to.equal(1);
      expect(tokenUriExample_id45.attributes[1].display_type).to.equal(
        "number"
      );

      expect(tokenUriExample_id5.attributes[2].trait_type).to.equal("Edition");
      expect(tokenUriExample_id5.attributes[2].value).to.equal(
        "Test Edition 1"
      );
      expect(tokenUriExample_id30.attributes[2].trait_type).to.equal("Edition");
      expect(tokenUriExample_id30.attributes[2].value).to.equal(
        "Test Edition 1"
      );
      expect(tokenUriExample_id45.attributes[2].trait_type).to.equal("Edition");
      expect(tokenUriExample_id45.attributes[2].value).to.equal(
        "Test Edition 2"
      );

      expect(tokenUriExample_id5.attributes[3].trait_type).to.equal(
        "Edition ID"
      );
      expect(tokenUriExample_id5.attributes[3].value).to.equal(1);
      expect(tokenUriExample_id5.attributes[3].display_type).to.equal("number");
      expect(tokenUriExample_id30.attributes[3].trait_type).to.equal(
        "Edition ID"
      );
      expect(tokenUriExample_id30.attributes[3].value).to.equal(1);
      expect(tokenUriExample_id30.attributes[3].display_type).to.equal(
        "number"
      );
      expect(tokenUriExample_id45.attributes[3].trait_type).to.equal(
        "Edition ID"
      );
      expect(tokenUriExample_id45.attributes[3].value).to.equal(2);
      expect(tokenUriExample_id45.attributes[3].display_type).to.equal(
        "number"
      );

      expect(tokenUriExample_id5.attributes[4].trait_type).to.equal(
        "NFB Number"
      );
      expect(tokenUriExample_id5.attributes[4].value).to.equal(5);
      expect(tokenUriExample_id30.attributes[4].trait_type).to.equal(
        "NFB Number"
      );
      expect(tokenUriExample_id30.attributes[4].value).to.equal(30);
      expect(tokenUriExample_id45.attributes[4].trait_type).to.equal(
        "NFB Number"
      );
      expect(tokenUriExample_id45.attributes[4].value).to.equal(45);

      // now let's burn some nfbs and see if we can mint afterwards
      await nfb.connect(otherAccount).burn(0);
      await nfb.connect(otherAccount).burn(5);
      await nfb.connect(otherAccount).burn(30);
      await nfb.connect(otherAccount).burn(45);
      await nfb.connect(otherAccount).burn(59); // also burn the last one

      await nfb.connect(minter).mint(otherAccount.address, 1, 2, 1);
      await nfb.connect(minter).mint(otherAccount.address, 1, 1, 2);
      await nfb.connect(minter).mint(otherAccount.address, 1, 1, 1);

      const tokenUriExample_id60 = parseTokenUri(await nfb.tokenURI(60));
      const tokenUriExample_id61 = parseTokenUri(await nfb.tokenURI(61));
      const tokenUriExample_id62 = parseTokenUri(await nfb.tokenURI(62));

      expect(tokenUriExample_id60.name).to.equal("Test NFB #60");
      expect(tokenUriExample_id61.name).to.equal("Test NFB #61");
      expect(tokenUriExample_id62.name).to.equal("Test NFB #62");

      // let's check if the series and edition are correct
      expect(tokenUriExample_id60.attributes[0].value).to.equal("Series 2");
      expect(tokenUriExample_id60.attributes[1].value).to.equal(2);
      expect(tokenUriExample_id60.attributes[2].value).to.equal(
        "Test Edition 1"
      );
      expect(tokenUriExample_id61.attributes[0].value).to.equal("Series 1");
      expect(tokenUriExample_id61.attributes[1].value).to.equal(1);
      expect(tokenUriExample_id61.attributes[2].value).to.equal(
        "Test Edition 2"
      );
      expect(tokenUriExample_id62.attributes[0].value).to.equal("Series 1");
      expect(tokenUriExample_id62.attributes[1].value).to.equal(1);
      expect(tokenUriExample_id62.attributes[2].value).to.equal(
        "Test Edition 1"
      );

      // the tokenURI function should work after transfer
      await nfb
        .connect(otherAccount)
        .transferFrom(otherAccount.address, minter.address, 60);
      const tokenUriExample_id60_after_transfer = parseTokenUri(
        await nfb.tokenURI(60)
      );
      expect(tokenUriExample_id60_after_transfer.name).to.equal("Test NFB #60");
      expect(tokenUriExample_id60_after_transfer.attributes[0].value).to.equal(
        "Series 2"
      );
      expect(tokenUriExample_id60_after_transfer.attributes[1].value).to.equal(
        2
      );
      expect(tokenUriExample_id60_after_transfer.attributes[2].value).to.equal(
        "Test Edition 1"
      );
    });

    it("should not allow minting for non-existing series", async () => {
      const { minter, nfb, otherAccount } = await deployFixture();

      await expect(
        nfb.connect(minter).mint(otherAccount.address, 20, 3, 1)
      ).to.be.revertedWith("NFB: Series or edition is not available");
    });

    it("should not allow minting for non-existing edition", async () => {
      const { minter, nfb, otherAccount } = await deployFixture();

      await expect(
        nfb.connect(minter).mint(otherAccount.address, 20, 1, 3)
      ).to.be.revertedWith("NFB: Series or edition is not available");
    });

    it("should not allow minting for editions where available until expired", async () => {
      const { minter, nfb, otherAccount } = await deployFixture();
      // proceed time to 1 second after available until
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        (await nfb.editions(1, 1)).availableUntil.toNumber() + 1,
      ]);

      await expect(
        nfb.connect(minter).mint(otherAccount.address, 20, 1, 1)
      ).to.be.revertedWith("NFB: Series or edition is not available");
    });
  });

  describe("TokenURIGetter", async () => {
    it("should allow setting a TokenURIGetter only for the manager", async () => {
      const { mockNFBTokenURIGetter, nfb, otherAccount } =
        await deployFixture();
      await expect(
        nfb
          .connect(otherAccount)
          .setTokenURIGetter(1, 1, mockNFBTokenURIGetter.address)
      ).to.be.revertedWith(
        "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"
      );
    });

    it("should not allow setting a TokenURIGetter when frozen", async () => {
      const { mockNFBTokenURIGetter, nfb, otherAccount } =
        await deployFixture();
      await nfb.freezeSeries(1);
      await expect(
        nfb.setTokenURIGetter(1, 1, mockNFBTokenURIGetter.address)
      ).to.be.revertedWith("NFB: Series already frozen");
    });

    it("should allow setting a TokenURIGetter", async () => {
      const { minter, mockNFBTokenURIGetter, nfb } = await deployFixture();
      await nfb.setTokenURIGetter(1, 1, mockNFBTokenURIGetter.address);
      await nfb.connect(minter).mint(minter.address, 1, 1, 1);

      const tokenUriExample_id0 = parseTokenUri(await nfb.tokenURI(0));
      expect(tokenUriExample_id0.name).to.equal("Series 1");
    });
  });
});
