const { expect } = require("chai");
const timeMachine = require("ganache-time-traveler");
const { artifacts, ethers, waffle } = require("hardhat");
const BN = ethers.BigNumber;
const { deployMockContract } = waffle;

describe("FeeReceiver Unit", () => {
  let snapshotId;
  let deployer;
  let account1;
  let account2;
  let testAToken;
  let testBToken;
  let testCToken;
  let uniswapV2Router02Contract;
  let feeReceiver;
  let swapToToken;
  let poolAddress = "0x7296333e1615721f4Bd9Df1a3070537484A50CF8";
  let uniRouter
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

    await testAToken.mint(deployer.address, 1000000);

    TestBToken = await ethers.getContractFactory("ERC20PresetMinterPauser");
    testBToken = await TestBToken.deploy("TestBToken", "TESTB");
    await testBToken.deployed();

    await testBToken.mint(deployer.address, 1000000);

    TestCToken = await ethers.getContractFactory("ERC20PresetMinterPauser");
    testCToken = await TestCToken.deploy("TestCToken", "TESTC");
    await testCToken.deployed();

    await testCToken.mint(deployer.address, 1000000);

    UniswapV2Router02Contract = await ethers.getContractFactory("UniswapV2Router02");
    uniswapV2Router02Contract = await UniswapV2Router02Contract.deploy("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    await uniswapV2Router02Contract.deployed();

    testAApprove = await testAToken.approve(uniswapV2Router02Contract.address, 500000);
    testBApprove = await testBToken.approve(uniswapV2Router02Contract.address, 500000);
    testCApprove = await testCToken.approve(uniswapV2Router02Contract.address, 500000);

    await uniswapV2Router02Contract.addLiquidity(
      testAToken.address,
      testBToken.address,
      250000,
      250000,
      250000,
      250000,
      deployer.address,
      1627647649
    );

    await uniswapV2Router02Contract.addLiquidity(
      testAToken.address,
      testCToken.address,
      250000,
      250000,
      250000,
      250000,
      deployer.address,
      1627647649
    );

    await uniswapV2Router02Contract.addLiquidity(
      testBToken.address,
      testCToken.address,
      250000,
      250000,
      250000,
      250000,
      deployer.address,
      1627647649
    );

    swapToToken = testCToken.address;
    uniRouter = uniswapV2Router02Contract.address;

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

    await testAToken.transfer(feeReceiver.address, 25000)
  });

  describe("Token Setup", async () => {
    it("test tokens minted and transferred to uniswap and feereceiver contract", async () => {
      const tokenABalance = await testAToken.balanceOf(deployer.address);
      const tokenBBalance = await testBToken.balanceOf(deployer.address);
      const tokenCBalance = await testCToken.balanceOf(deployer.address);
      const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
      
      expect(tokenABalance).to.equal(475000);
      expect(tokenBBalance).to.equal(500000);
      expect(tokenCBalance).to.equal(500000);
      expect(feeReceiverTokenABalance).to.equal(25000);
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

  describe('Convert and transfer', async () => {
    it('user can convert and transfer any token along a Uniswap pool path of 2', async () => {
      await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testCToken.address]);

      const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
      const msgSenderTokenABalance = await testCToken.balanceOf(deployer.address);
      const poolTokenABalance = await testCToken.balanceOf(payees[0]);

      expect(feeReceiverTokenABalance).to.equal(0);
      expect(msgSenderTokenABalance).to.equal(500226);
      expect(poolTokenABalance).to.equal(22439);

    })

    it('user can convert and transfer any token along a Uniswap pool path of 3', async () => {
      await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, testCToken.address]);

      const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
      const msgSenderTokenABalance = await testCToken.balanceOf(deployer.address);
      const poolTokenABalance = await testCToken.balanceOf(payees[0]);

      expect(feeReceiverTokenABalance).to.equal(0);
      expect(msgSenderTokenABalance).to.equal(500207);
      expect(poolTokenABalance).to.equal(20516);

    });

    it('user cannot successfully convert and transfer token is staking is required and user is not staking', async () => {

      await feeReceiver.connect(deployer).setStakeAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F")

      await feeReceiver.connect(deployer).setStakeThreshold(500);

      await feeReceiver.connect(deployer).setStakeActive(true);

      await expect(feeReceiver.connect(account1).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, testCToken.address]))
      .to.be.revertedWith('Not enough staked tokens');

    })

    it('event ConvertAndTransfer is emitted when user successfully calls convertAndTransfer function along a Uniswap pool path of 2', async () => {

      await expect(feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testCToken.address]))
        .to.emit(feeReceiver, 'ConvertAndTransfer')
        .withArgs(deployer.address, testAToken.address, testCToken.address, 25000, 22665, [poolAddress]);

    })

    it('event ConvertAndTransfer is emitted when user successfully calls convertAndTransfer function along a Uniswap pool path of 3', async () => {

      await expect(feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, testCToken.address]))
        .to.emit(feeReceiver, 'ConvertAndTransfer')
        .withArgs(deployer.address, testAToken.address, testCToken.address, 25000, 20723, payees);

    })

    // conduct more test with stakers

  });
});
