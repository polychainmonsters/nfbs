import { task } from "hardhat/config";

task("distributeNFBs", "Distributes nfb tokens to a list of addresses")
  .addParam("nfb", "The address of the nfb")
  .addParam("addresses", "The addresses to distribute nfb tokens to")
  .addParam("series", "The series of the nfb tokens to distribute")
  .addParam("edition", "The edition of the nfb tokens to distribute")
  .setAction(async (taskArgs, hre) => {
    const addresses = taskArgs.addresses.split(",");

    const NFB = await hre.ethers.getContractFactory("NFB");
    const nfb = NFB.attach(taskArgs.nfb);

    for (let i = 0; i < addresses.length; i++) {
      const tx = await nfb.mint(
        addresses[i],
        1,
        taskArgs.series,
        taskArgs.edition
      );
      await tx.wait();
      console.info(`Distributed to ${addresses[i]}`);
    }
  });
