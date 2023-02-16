import { ethers } from "hardhat";

export const parseTokenUri = (uri: string) => {
  try {
    return JSON.parse(
      Buffer.from(
        uri.replace("data:application/json;base64,", ""),
        "base64"
      ).toString("utf-8")
    );
  } catch (err) {
    console.info("Error parsing token URI", uri);
    throw err;
  }
};

export async function deployFixture() {
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
  const mockNFBTokenURIGetter = await MockNFBTokenURIGetter.deploy(nfb.address);

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
