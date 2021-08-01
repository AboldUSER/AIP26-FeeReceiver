const hre = require("hardhat");
const { ethers } = hre;

async function main() {

  await hre.run('compile');

  const [deployer] = await ethers.getSigners();
  console.log(deployer.address);

  // Deploy the contract
  const FeeReceiver = await hre.ethers.getContractFactory("FeeReceiver");
  const feeReceiver = await FeeReceiver.deploy(
    swapToToken,
    uniRouter,
    triggerFee,
    payees,
    shares
  );

  await feeReceiver.deployed();

  console.log("FeeReceiver address:", feeReceiver.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
