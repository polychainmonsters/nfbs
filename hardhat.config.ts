import { HardhatUserConfig } from "hardhat/config";
import { task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "@nomicfoundation/hardhat-chai-matchers";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "./tasks";

// print current hardhat accounts
task("accounts", "Prints the list of accounts", async (_, { ethers }) => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

const accounts = process.env.PRIVATE_KEY
  ? [`0x${process.env.PRIVATE_KEY}`]
  : [];

const config: HardhatUserConfig = {
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  networks: {
    mumbai: {
      url: "https://matic-mumbai.chainstacklabs.com",
      accounts,
    },
    goerli: {
      url: "https://eth-goerli.public.blastapi.io",
      accounts,
    },
    polygon: {
      url: "https://polygon-mainnet.chainstacklabs.com",
      accounts,
    },
    mainnet: {
      url: "https://rpc.ankr.com/eth",
      accounts,
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts,
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          viaIR: true,
        },
      },
    ],
  },
};

export default config;
