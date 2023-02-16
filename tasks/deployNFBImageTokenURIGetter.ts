import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { verifyAfterSleep } from "./utils";

// hardhat deployment task for the nfb manager contract
task(
  "deployNFBImageTokenURIGetter",
  "Deploys the nfb image token uri getter contract"
)
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const NFBImageTokenURIGetter = await hre.ethers.getContractFactory(
      "NFBImageTokenURIGetter"
    );
    const nfbImageTokenURIGetter = await NFBImageTokenURIGetter.deploy(
      taskArgs.nfb,
      taskArgs.name,
      taskArgs.image
    );
    await nfbImageTokenURIGetter.deployed();

    // print the address of the contract
    console.log(
      "NFBImageTokenURIGetter deployed to:",
      nfbImageTokenURIGetter.address
    );

    await verifyAfterSleep(
      hre,
      "NFBImageTokenURIGetter",
      nfbImageTokenURIGetter.address,
      hre.network.name
    );
  })
  // add params
  .addParam("nfb", "The address of the NFB")
  .addParam("name", "The name to be used for the metadata")
  .addParam("image", "The image URI to be used");
