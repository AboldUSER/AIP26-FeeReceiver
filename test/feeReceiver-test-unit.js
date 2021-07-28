const { expect } = require("chai");
const timeMachine = require("ganache-time-traveler");
const { artifacts, ethers, waffle } = require("hardhat");
const BN = ethers.BigNumber;
const { deployMockContract } = waffle;
const IERC20 = artifacts.require(
  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20"
);
const ERC20PresetMinterPauser = artifacts.require("ERC20PresetMinterPauser");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");

describe("FeeReceiver Unit", () => {
  let snapshotId;
  let deployer;
  let account1;
  let account2;
  let testAToken;
  let testBToken;
  let testCToken;
  let pairAB;
  let FeeReceiver;
  let feeReceiver;
  let swapToToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  let poolAddress = "0x7296333e1615721f4Bd9Df1a3070537484A50CF8";
  let uniRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  let triggerFee = 1;
  let payees = ["0x7296333e1615721f4Bd9Df1a3070537484A50CF8"];
  let shares = [10];

  beforeEach(async () => {
    const snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  before(async () => {
    [deployer, account1, account2] = await ethers.getSigners();

    TestAToken = await ethers.getContractFactory("ERC20PresetMinterPauser");
    testAToken = await TestAToken.deploy("TestAToken", "TESTA");
    await testAToken.deployed();

    await testAToken.mint(deployer.address, 10000);

    FeeReceiver = await ethers.getContractFactory("FeeReceiver");
    feeReceiver = await FeeReceiver.deploy(
      swapToToken,
      poolAddress,
      uniRouter,
      triggerFee,
      payees,
      shares
    );
    await feeReceiver.deployed();
  });

  describe("Token Stuff", async () => {
    it("tokenA minted and transferred", async () => {
      const tokenBalance = await testAToken.balanceOf(deployer.address);

      console.log(tokenBalance);

      expect(tokenBalance).to.equal(10000);
    });
  });

  describe("Default Values", async () => {
    it("constructor sets default values", async () => {
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
    });
  });

  describe("Set swapToToken", async () => {
    it("non owner cannot set swapToToken", async () => {
      await expect(
        feeReceiver
          .connect(account1)
          .setSwapToToken("0x6B175474E89094C44Da98b954EedeAC495271d0F")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set swapToToken", async () => {
      await feeReceiver
        .connect(deployer)
        .setSwapToToken("0x6B175474E89094C44Da98b954EedeAC495271d0F");

      const swapToTokenAddress = await feeReceiver.swapToToken();
      expect(swapToTokenAddress).to.equal(
        "0x6B175474E89094C44Da98b954EedeAC495271d0F"
      );
    });
  });

  describe("Set poolAddress", async () => {
    it("non owner cannot set setPoolAddress", async () => {
      await expect(
        feeReceiver
          .connect(account1)
          .setPoolAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set swapToToken", async () => {
      await feeReceiver
        .connect(deployer)
        .setPoolAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F");

      const poolAddressAddr = await feeReceiver.poolAddress();
      expect(poolAddressAddr).to.equal(
        "0x6B175474E89094C44Da98b954EedeAC495271d0F"
      );
    });
  });

  describe("Set stakeAddress", async () => {
    it("non owner cannot set stakeAddress", async () => {
      await expect(
        feeReceiver
          .connect(account1)
          .setStakeAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set stakeAddress", async () => {
      await feeReceiver
        .connect(deployer)
        .setStakeAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F");

      const stakeAddressAddr = await feeReceiver.stakeAddress();
      expect(stakeAddressAddr).to.equal(
        "0x6B175474E89094C44Da98b954EedeAC495271d0F"
      );
    });
  });

  describe("Set stakeThreshold", async () => {
    it("non owner cannot set stakeThreshold", async () => {
      await expect(
        feeReceiver.connect(account1).setStakeThreshold(2)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set stakeThreshold", async () => {
      await feeReceiver.connect(deployer).setStakeThreshold(500);

      const stakeThresholdNum = await feeReceiver.stakeThreshold();
      expect(stakeThresholdNum).to.equal(500);
    });
  });

  describe("Set stakeActive", async () => {
    it("non owner cannot set stakeActive", async () => {
      await expect(
        feeReceiver.connect(account1).setStakeActive(true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set stakeActive", async () => {
      await feeReceiver.connect(deployer).setStakeActive(true);

      const stakeActiveBool = await feeReceiver.stakeActive();
      expect(stakeActiveBool).to.equal(true);
    });
  });

  describe("Set triggerFee", async () => {
    it("non owner cannot set triggerFee", async () => {
      await expect(
        feeReceiver.connect(account1).setTriggerFee(2)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set triggerFee", async () => {
      await feeReceiver.connect(deployer).setTriggerFee(2);

      const triggerFeeNum = await feeReceiver.triggerFee();
      expect(triggerFeeNum).to.equal(2);
    });
  });

  describe("Add Payee", async () => {
    const payeeAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const payeeShares = 5;
    it("non owner cannot add payee", async () => {
      await expect(
        feeReceiver.connect(account1).addPayee(payeeAddress, payeeShares)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can add payee", async () => {
      const beginningTotalShares = await feeReceiver.totalShares();

      await feeReceiver.connect(deployer).addPayee(payeeAddress, payeeShares);

      const newPayeeAddress = await feeReceiver.payee(1);
      const newPayeeShares = await feeReceiver.shares(newPayeeAddress);
      const endingTotalShares = await feeReceiver.totalShares();
      expect(newPayeeAddress).to.equal(
        "0x6B175474E89094C44Da98b954EedeAC495271d0F"
      );
      expect(newPayeeShares).to.equal(5);
      expect(endingTotalShares).to.equal(
        parseFloat(beginningTotalShares) + parseFloat(payeeShares)
      );
    });
  });

  // describe('Convert and transfer', async () => {
  //   it('user can convert and transfer any token', async () => {
  //     await feeReceiver.connect(deployer).convertAndTransfer(payeeAddress, payeeShares, 1);

  //     // create uniswap factory contract object
  //     // create three test tokens (testA, testB, testC)
  //     // put one of them in this contract
  //     // create three pools in uniswap (testA/testB, testB/testC, testA/testC)
  //     // conduct test with different paths

  //   })
  // });
});
