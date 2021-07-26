const hre = require("hardhat");
const { ethers } = hre;

async function main() {

  await hre.run('compile');

  const [deployer] = await ethers.getSigners();
  console.log(deployer.address);

  const swapToToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC address
  const poolAddress = "0x7296333e1615721f4Bd9Df1a3070537484A50CF8";
  const uniRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const triggerFee = 1;
  const payees = ["0x7296333e1615721f4Bd9Df1a3070537484A50CF8"];
  const shares = [10];


  // Deply the contract
  const FeeReceiver = await hre.ethers.getContractFactory("FeeReceiver");
  const feeReceiver = await FeeReceiver.deploy(
    swapToToken,
    poolAddress,
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
