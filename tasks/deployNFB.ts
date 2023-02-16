// import all required stuff
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { task } from "hardhat/config";
import { verifyAfterSleep } from "./utils";

// a hardhat task that deploys an nfb
task("deployNFB", "Deploys a nfb")
  .addParam("name", "The name of the nfb")
  .addParam("symbol", "The symbol of the nfb")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const NFB = await hre.ethers.getContractFactory("NFB");
    const nfb = await NFB.deploy(taskArgs.name, taskArgs.symbol);
    await nfb.deployed();

    // print the address of the contract
    console.log("NFB deployed to:", nfb.address);

    await verifyAfterSleep(hre, "NFB", nfb.address, hre.network.name);
  });
