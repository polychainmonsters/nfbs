import { HardhatRuntimeEnvironment } from "hardhat/types";

export const verifyAfterSleep = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  address: string,
  network: string
) => {
  if (network !== "hardhat") {
    // sleep for 30 seconds to wait for the contract to be verified
    await new Promise((resolve) => setTimeout(resolve, 30000));

    await hre.run("verify:verify", {
      address,
      contract: contractName,
    });
  }
};
