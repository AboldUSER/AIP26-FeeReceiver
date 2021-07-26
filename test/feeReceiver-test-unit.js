const { expect } = require("chai");
const timeMachine = require('ganache-time-traveler')
const { artifacts, ethers, waffle } = require('hardhat')
const BN = ethers.BigNumber
const { deployMockContract } = waffle
// const IERC20 = artifacts.require('IERC20')

describe("FeeReceiver Unit", () => {
  // let snapshotId;
  let deployer;
  let account1;
  let account2;
  let FeeReceiver;
  let feeReceiver;
  let swapToToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  let poolAddress = "0x7296333e1615721f4Bd9Df1a3070537484A50CF8";
  let uniRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  let triggerFee = 1;
  let payees = ["0x7296333e1615721f4Bd9Df1a3070537484A50CF8"];
  let shares = [10];

  // beforeEach(async () => {
  //   const snapshot = await timeMachine.takeSnapshot()
  //   snapshotId = snapshot['result']
  // })

  // afterEach(async () => {
  //   await timeMachine.revertToSnapshot(snapshotId)
  // })

  before(async () => {
    [deployer, account1, account2] = await ethers.getSigners();

    FeeReceiver = await hre.ethers.getContractFactory("FeeReceiver");
    feeReceiver = await FeeReceiver.deploy(
    swapToToken,
    poolAddress,
    uniRouter,
    triggerFee,
    payees,
    shares
  );
  await feeReceiver.deployed();
  })

  describe('Default Values', async () => {
    it('constructor sets default values', async () => {
      const owner = await feeReceiver.owner();
      const swapToTokenAddress = await feeReceiver.swapToToken();
      const poolContractAddress = await feeReceiver.poolAddress();
      const uniRouterAddress = await feeReceiver.uniRouter();
      const triggerFeeAmount = await feeReceiver.triggerFee();
      const payeesAddress = await feeReceiver.payee(0);
      const sharesAmount = await feeReceiver.shares(payeesAddress);

      expect(owner).to.equal(deployer.address);
      expect(swapToTokenAddress).to.equal(swapToToken);
      expect(poolContractAddress).to.equal(poolAddress);
      expect(uniRouterAddress).to.equal(uniRouter);
      expect(triggerFeeAmount).to.equal(triggerFee);
      expect(payeesAddress).to.equal(payees[0]);
      expect(sharesAmount).to.equal(shares[0]);
    })
  })

})
