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

    await nfb.setEdition(
      1,
      1,
      Math.round(Date.now() / 1000) - 60,
      Math.round(Date.now() / 1000) + 1000000,
      "Test Edition 1"
    );
    await nfb.setEdition(
      2,
      1,
      Math.round(Date.now() / 1000) - 60,
      Math.round(Date.now() / 1000) + 1000000,
      "Test Edition 1"
    );
    await nfb.setEdition(
      1,
      2,
      Math.round(Date.now() / 1000) - 60,
      Math.round(Date.now() / 1000) + 1000000,
      "Test Edition 2"
    );

    const NFBPurchaser = await ethers.getContractFactory("GenericNFBPurchaser");
    const nfbPurchaser = await NFBPurchaser.deploy();
    await nfbPurchaser.initialize();

    // deploy a mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy();
    // mint some of the mock tokens to other account
    await mockToken.mint(otherAccount.address, ethers.utils.parseEther("1000"));

    await nfb.grantRole(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")),
      nfbPurchaser.address
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

    // deploy the mock purchaser custom handler
    const MockNFBPurchaserCustomHandler = await ethers.getContractFactory(
      "MockNFBPurchaserCustomHandler"
    );
    const mockNFBPurchaserCustomHandler =
      await MockNFBPurchaserCustomHandler.deploy();

    return {
      minter,
      mockToken,
      mockNFBPurchaserCustomHandler,
      mockNFBTokenURIGetter,
      owner,
      otherAccount,
      nfb,
      nfbPurchaser,
    };
  }

  describe("Withdrawing from the nfb purchaser", async () => {
    it("should allow withdrawing funds from the nfb purchaser", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      // now purchase some nfbs from other account
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(
          1,
          1,
          10,
          otherAccount.address,
          ethers.constants.AddressZero,
          0,
          {
            value: ethers.utils.parseEther("1"),
          }
        );
      // now withdraw funds
      const withdrawTx = await nfbPurchaser.withdrawNative();
      const withdrawTxReceipt = await withdrawTx.wait();
      const withdrawTxEvent = withdrawTxReceipt.events?.find(
        (e: any) => e.event === "Withdrawn"
      );
      expect(withdrawTxEvent?.args?.amount).to.equal(
        ethers.utils.parseEther("1")
      );
    });

    it("should not allow withdrawing funds from the nfb purchaser when not the withdrawer role", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      // now purchase some nfbs from other account
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(
          1,
          1,
          10,
          otherAccount.address,
          ethers.constants.AddressZero,
          0,
          {
            value: ethers.utils.parseEther("1"),
          }
        );
      const withdrawerRole = await nfbPurchaser.WITHDRAWER_ROLE();
      // now withdraw funds
      await expect(
        nfbPurchaser.connect(otherAccount).withdrawNative()
      ).to.be.revertedWith(
        `AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role ${withdrawerRole}`
      );
    });

    it("should not allow withdrawing funds from the nfb purchaser when no funds", async () => {
      const { nfbPurchaser } = await deployFixture();
      await expect(nfbPurchaser.withdrawNative()).to.be.revertedWith(
        "NFBPurchaser: Nothing to withdraw"
      );
    });

    it("should allow withdrawing tokens", async () => {
      const { otherAccount, mockToken, nfb, nfbPurchaser } =
        await deployFixture();
      await nfbPurchaser.setNFB(1, 1, nfb.address, 100, 0, 25);
      // accept the mock token as payment
      await nfbPurchaser.setPaymentToken(
        1,
        1,
        mockToken.address,
        ethers.utils.parseEther("1"),
        0
      );
      // approve the nfb purchaser to spend the mock token
      await mockToken
        .connect(otherAccount)
        .approve(nfbPurchaser.address, ethers.utils.parseEther("25"));
      // now purchase some nfbs from other account
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(1, 1, 25, otherAccount.address, mockToken.address, 0);
      // now withdraw funds
      const withdrawTx = await nfbPurchaser.withdrawTokens(mockToken.address);
      const withdrawTxReceipt = await withdrawTx.wait();
      const withdrawTxEvent = withdrawTxReceipt.events?.find(
        (e: any) => e.event === "Withdrawn"
      );
      expect(withdrawTxEvent?.args?.amount).to.equal(
        ethers.utils.parseEther("25")
      );
    });
  });

  describe("Configuring the nfb purchaser", async () => {
    it("should allow selling nfbs", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      const nfbs = [
        { seriesId: 1, editionId: 1, price: ethers.utils.parseEther("0.1") },
        { seriesId: 1, editionId: 2, price: ethers.utils.parseEther("0.05") },
        { seriesId: 2, editionId: 1, price: ethers.utils.parseEther("0.025") },
      ];

      let i = 1;
      for (const nfbConfig of nfbs) {
        await nfbPurchaser.setNFB(
          nfbConfig.seriesId,
          nfbConfig.editionId,
          nfb.address,
          100,
          nfbConfig.price,
          10
        );

        await nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(
            nfbConfig.seriesId,
            nfbConfig.editionId,
            3,
            otherAccount.address,
            ethers.constants.AddressZero,
            0,
            { value: nfbConfig.price.mul(3) }
          );

        expect(await nfb.balanceOf(otherAccount.address)).to.equal(i * 3);
        i++;
      }

      // should check if sold packs are updated
      expect(await nfbPurchaser.nfbsSold(1, 1)).to.equal(3);
      expect(await nfbPurchaser.nfbsSold(1, 2)).to.equal(3);
      expect(await nfbPurchaser.nfbsSold(2, 1)).to.equal(3);
    });

    it("should enforce token payments if set", async () => {
      const { mockToken, otherAccount, nfb, nfbPurchaser } =
        await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await nfbPurchaser.toggleEnforceTokenPayment(1, 1);
      await nfbPurchaser.setPaymentToken(
        1,
        1,
        mockToken.address,
        ethers.utils.parseEther("10"),
        0
      );
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(
            1,
            1,
            1,
            otherAccount.address,
            ethers.constants.AddressZero,
            0,
            {
              value: ethers.utils.parseEther("0.1"),
            }
          )
      ).to.be.revertedWith("NFBPurchaser: Token payment required");
      // expect to fail without approving
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(1, 1, 1, otherAccount.address, mockToken.address, 0)
      ).to.be.revertedWith("ERC20: insufficient allowance");
      // approve and try again
      await mockToken
        .connect(otherAccount)
        .approve(nfbPurchaser.address, ethers.utils.parseEther("10"));
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(1, 1, 1, otherAccount.address, mockToken.address, 0);
      expect(await nfb.balanceOf(otherAccount.address)).to.equal(1);
      // expect the balance to be reduced
      expect(await mockToken.balanceOf(otherAccount.address)).to.equal(
        ethers.utils.parseEther("990")
      );
    });

    it("should allow calling a custom payment handler", async () => {
      const { otherAccount, nfb, nfbPurchaser, mockNFBPurchaserCustomHandler } =
        await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await nfbPurchaser.setCustomHandler(
        1,
        1,
        mockNFBPurchaserCustomHandler.address
      );
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(
          1,
          1,
          1,
          otherAccount.address,
          ethers.constants.AddressZero,
          0,
          {
            value: ethers.utils.parseEther("0.1"),
          }
        );
      expect(await nfb.balanceOf(otherAccount.address)).to.equal(1);
      expect(await mockNFBPurchaserCustomHandler.purchaseDone()).to.equal(true);
    });

    it("should not sell to zero address", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(
            1,
            1,
            1,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            0,
            {
              value: ethers.utils.parseEther("0.1"),
            }
          )
      ).to.be.revertedWith("NFBPurchaser: Invalid recipient");
    });

    it("should not sell more than max nfbs per tx", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(
            1,
            1,
            11,
            otherAccount.address,
            ethers.constants.AddressZero,
            0,
            {
              value: ethers.utils.parseEther("1"),
            }
          )
      ).to.be.revertedWith("NFBPurchaser: Too many nfbs");
    });

    it("should not sell more nfbs than available", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        200
      );
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(
            1,
            1,
            101,
            otherAccount.address,
            ethers.constants.AddressZero,
            0,
            {
              value: ethers.utils.parseEther("10"),
            }
          )
      ).to.be.revertedWith("NFBPurchaser: Sold out");
    });

    it("should ensure a nfb is paid for", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(
            1,
            1,
            1,
            otherAccount.address,
            ethers.constants.AddressZero,
            0,
            {
              value: ethers.utils.parseEther("0.01"),
            }
          )
      ).to.be.revertedWith("NFBPurchaser: Invalid payment amount");
    });

    it("should ensure a nfb paid for is not overpaid", async () => {
      const { otherAccount, nfb, nfbPurchaser } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(
            1,
            1,
            1,
            otherAccount.address,
            ethers.constants.AddressZero,
            0,
            {
              value: ethers.utils.parseEther("1"),
            }
          )
      ).to.be.revertedWith("NFBPurchaser: Invalid payment amount");
    });

    it("should allow a nfb to be purchased with a token", async () => {
      const { otherAccount, nfb, nfbPurchaser, mockToken } =
        await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await nfbPurchaser.setPaymentToken(
        1,
        1,
        mockToken.address,
        ethers.utils.parseEther("10"),
        0
      );
      await mockToken
        .connect(otherAccount)
        .approve(nfbPurchaser.address, ethers.utils.parseEther("10"));
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(1, 1, 1, otherAccount.address, mockToken.address, 0);
      expect(await nfb.balanceOf(otherAccount.address)).to.equal(1);
      expect(await mockToken.balanceOf(otherAccount.address)).to.equal(
        ethers.utils.parseEther("990")
      );
    });

    it("should allow a nfb to be purchased with a token and ETH", async () => {
      const { otherAccount, nfb, nfbPurchaser, mockToken } =
        await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await nfbPurchaser.setPaymentToken(
        1,
        1,
        mockToken.address,
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("0.1")
      );
      await mockToken
        .connect(otherAccount)
        .approve(nfbPurchaser.address, ethers.utils.parseEther("10"));
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(1, 1, 1, otherAccount.address, mockToken.address, 0, {
          value: ethers.utils.parseEther("0.1"),
        });
      expect(await nfb.balanceOf(otherAccount.address)).to.equal(1);
      expect(await mockToken.balanceOf(otherAccount.address)).to.equal(
        ethers.utils.parseEther("990")
      );
    });

    it("should allow a nfb to be purchased with a token and ETH and a custom handler", async () => {
      const {
        otherAccount,
        nfb,
        nfbPurchaser,
        mockToken,
        mockNFBPurchaserCustomHandler,
      } = await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await nfbPurchaser.setPaymentToken(
        1,
        1,
        mockToken.address,
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("0.1")
      );
      await nfbPurchaser.setCustomHandler(
        1,
        1,
        mockNFBPurchaserCustomHandler.address
      );
      await mockToken
        .connect(otherAccount)
        .approve(nfbPurchaser.address, ethers.utils.parseEther("10"));
      await nfbPurchaser
        .connect(otherAccount)
        .purchaseNFBs(1, 1, 1, otherAccount.address, mockToken.address, 0, {
          value: ethers.utils.parseEther("0.1"),
        });
      expect(await nfb.balanceOf(otherAccount.address)).to.equal(1);
      expect(await mockToken.balanceOf(otherAccount.address)).to.equal(
        ethers.utils.parseEther("990")
      );
      expect(await mockNFBPurchaserCustomHandler.purchaseDone()).to.equal(true);
    });

    it("should not allow a nfb to be purchased with a token if the approved amount is too low", async () => {
      const { otherAccount, nfb, nfbPurchaser, mockToken } =
        await deployFixture();
      await nfbPurchaser.setNFB(
        1,
        1,
        nfb.address,
        100,
        ethers.utils.parseEther("0.1"),
        10
      );
      await nfbPurchaser.setPaymentToken(
        1,
        1,
        mockToken.address,
        ethers.utils.parseEther("10"),
        0
      );
      await mockToken
        .connect(otherAccount)
        .approve(nfbPurchaser.address, ethers.utils.parseEther("0.1"));
      await expect(
        nfbPurchaser
          .connect(otherAccount)
          .purchaseNFBs(1, 1, 1, otherAccount.address, mockToken.address, 0)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });
});
