import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { verifyAfterSleep } from "./utils";

// hardhat deployment task for the nfb manager contract
task("deployNFBPurchaser", "Deploys the nfb purchaser contract").setAction(
  async (_, hre: HardhatRuntimeEnvironment) => {
    const NFBPurchaser = await hre.ethers.getContractFactory(
      "GenericNFBPurchaser"
    );
    const nfbPurchaser = await hre.upgrades.deployProxy(NFBPurchaser, []);
    await nfbPurchaser.deployed();

    // print the address of the contract
    console.log("NFBPurchaser deployed to:", nfbPurchaser.address);

    await verifyAfterSleep(
      hre,
      "NFBPurchaser",
      nfbPurchaser.address,
      hre.network.name
    );
  }
);
