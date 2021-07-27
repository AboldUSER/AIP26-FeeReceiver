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


  // Deploy the contract
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

  const ERC20PresetMinterPauser = await hre.ethers.getContractFactory("ERC20PresetMinterPauser");
  const erc20PresetMinterPauser = await ERC20PresetMinterPauser.deploy("TestA", "TESTA");

  await erc20PresetMinterPauser.deployed();

  console.log("ERC20PresetMinterPauser address:", erc20PresetMinterPauser.address);

  console.log("FeeReceiver address:", feeReceiver.address);

  const UniswapV2Factory = await hre.ethers.getContractFactory("UniswapV2Factory");
  const uniswapV2Factory = await UniswapV2Factory.deploy("0x18e433c7Bf8A2E1d0197CE5d8f9AFAda1A771360");

  await uniswapV2Factory.deployed();

  console.log("UniswapV2Factory address:", uniswapV2Factory.address);

  const UniswapV2Router02 = await hre.ethers.getContractFactory("UniswapV2Router02");
  const uniswapV2Router02 = await UniswapV2Router02.deploy(uniswapV2Factory.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");

  await uniswapV2Router02.deployed();

  console.log("UniswapV2Router02 address:", uniswapV2Router02.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
