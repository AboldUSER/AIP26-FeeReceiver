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
  let swapToToken;
  let uniswapV2Router02Contract;
  let feeReceiver;
  let uniRouter
  let triggerFee = 1;
  let payees = ["0x7296333e1615721f4Bd9Df1a3070537484A50CF8"];
  let shares = [10];
  // staking contract variables
  const CLIFF = 10 // time in seconds
  const DURATION = 100 // time in seconds
  let stakeToken;
  let stakingContract


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

    SwapToToken = await ethers.getContractFactory("ERC20PresetMinterPauser");
    swapToToken = await SwapToToken.deploy("SwapToToken", "SWAPTO");
    await swapToToken.deployed();

    await swapToToken.mint(deployer.address, 1000000);

    StakeToken = await ethers.getContractFactory("ERC20PresetMinterPauser");
    stakeToken = await StakeToken.deploy("Stake Token", "sTOKEN");
    await stakeToken.deployed();

    await stakeToken.mint(account1.address, 1000);
    await stakeToken.mint(account2.address, 1000);

    StakingContract = await ethers.getContractFactory('Staking')
    stakingContract = await StakingContract.deploy(
      stakeToken.address,
      'Staked Token',
      'sdTOKEN',
      DURATION,
      CLIFF
    );

    stakingContractAccount1Approve = await stakeToken.connect(account1).approve(stakingContract.address, 100);
    stakingContractAccount2Approve = await stakeToken.connect(account2).approve(stakingContract.address, 500);

    await stakingContract.connect(account1).stake('100');
    await stakingContract.connect(account2).stake('500');

    UniswapV2Router02Contract = await ethers.getContractFactory("UniswapV2Router02");
    uniswapV2Router02Contract = await UniswapV2Router02Contract.deploy("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    await uniswapV2Router02Contract.deployed();

    testATokenApprove = await testAToken.approve(uniswapV2Router02Contract.address, 500000);
    testBTokenApprove = await testBToken.approve(uniswapV2Router02Contract.address, 500000);
    swapToTokenApprove = await swapToToken.approve(uniswapV2Router02Contract.address, 500000);

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
      swapToToken.address,
      250000,
      250000,
      250000,
      250000,
      deployer.address,
      1627647649
    );

    await uniswapV2Router02Contract.addLiquidity(
      testBToken.address,
      swapToToken.address,
      250000,
      250000,
      250000,
      250000,
      deployer.address,
      1627647649
    );

    uniRouter = uniswapV2Router02Contract.address;

    FeeReceiver = await ethers.getContractFactory("FeeReceiver");
    feeReceiver = await FeeReceiver.deploy(
      swapToToken.address,
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
      const swapToTokenBalance = await swapToToken.balanceOf(deployer.address);
      const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
      const stakingBalance = await stakingContract.connect(account1).balanceOf(account1.address)

      expect(tokenABalance).to.equal(475000);
      expect(tokenBBalance).to.equal(500000);
      expect(swapToTokenBalance).to.equal(500000);
      expect(feeReceiverTokenABalance).to.equal(25000);
      expect(stakingBalance).to.equal('100')
    });

  });

  describe("Default Values", async () => {
    it("constructor sets default values", async () => {
      const owner = await feeReceiver.owner();
      const swapToTokenAddress = await feeReceiver.swapToToken();
      const uniRouterAddress = await feeReceiver.uniRouter();
      const triggerFeeAmount = await feeReceiver.triggerFee();
      const payeesAddress = await feeReceiver.payee(0);
      const sharesAmount = await feeReceiver.shares(payeesAddress);

      expect(owner).to.equal(deployer.address);
      expect(swapToTokenAddress).to.equal(swapToToken.address);
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

    it("owner cannot set swapToToken to zero address", async () => {
      await expect(
        feeReceiver.connect(deployer).setSwapToToken("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("Cannot set to zero address");
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

  describe("Set stakeAddress", async () => {
    it("non owner cannot set stakeAddress", async () => {
      await expect(
        feeReceiver
          .connect(account1)
          .setStakeAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner cannot set stakeAddress to zero address", async () => {
      await expect(
        feeReceiver.connect(deployer).setStakeAddress("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("Cannot set to zero address");
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

    it("owner cannot set triggerFee greater than 100", async () => {
      await expect(
        feeReceiver.connect(deployer).setTriggerFee(101)
      ).to.be.revertedWith("Cannot set trigger fee above 100");
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
    
    it("owner cannot add payee if they are already included in payee array", async () => {
      const existingPayee = await feeReceiver.connect(deployer).payee(0); 
      await expect(
        feeReceiver.connect(deployer).addPayee(existingPayee, payeeShares)
      ).to.be.revertedWith("PaymentSplitter: account already has shares");
    });

    it("owner cannot add payee with zero shares", async () => {
      await expect(
        feeReceiver.connect(deployer).addPayee(payeeAddress, 0)
      ).to.be.revertedWith("PaymentSplitter: shares are 0");
    });

    it("owner can add payee", async () => {
      const beginningTotalShares = await feeReceiver.connect(deployer).totalShares();

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

  describe("Remove Payee", async () => {
      
      const correctPayeeIndex = 0;
      const incorrectPayeeIndex = 1;
    it("non owner cannot remove payee", async () => {
      const correctPayeeAddress = await feeReceiver.payee(0);
      await expect(
        feeReceiver.connect(account1).removePayee(correctPayeeAddress, correctPayeeIndex)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner cannot remove payee if they are not on payee array", async () => {
      const incorrectPayeeAddress = account2.address;
      await expect(
        feeReceiver.connect(deployer).removePayee(incorrectPayeeAddress, correctPayeeIndex)
      ).to.be.revertedWith("PaymentSplitter: account does not match payee array index");
    });

    it("owner cannot remove payee if provided wrong payee index for payee array", async () => {
      const correctPayeeAddress = await feeReceiver.payee(0);
      await expect(
        feeReceiver.connect(deployer).removePayee(correctPayeeAddress, incorrectPayeeIndex)
      ).to.be.revertedWith("PaymentSplitter: index not in payee array");
    });

    it("owner can remove payee", async () => {
      const correctPayeeAddress = await feeReceiver.payee(0);
      await feeReceiver.connect(deployer).removePayee(correctPayeeAddress, correctPayeeIndex);

      const removedPayeeShares = await feeReceiver.shares(correctPayeeAddress);
      const endingTotalShares = await feeReceiver.totalShares();
      await expect(feeReceiver.payee(0)).to.be.revertedWith("PaymentSplitter: There are no payees");
      expect(removedPayeeShares).to.equal(0);
      expect(endingTotalShares).to.equal(0);
    });
  });

  describe('Convert and transfer without staking', async () => {
    it('user can convert and transfer any token along a Uniswap pool path of 2', async () => {
      await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, swapToToken.address]);

      const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
      const msgSenderTokenABalance = await swapToToken.balanceOf(deployer.address);
      const poolTokenABalance = await swapToToken.balanceOf(payees[0]);

      expect(feeReceiverTokenABalance).to.equal(0);
      expect(msgSenderTokenABalance).to.equal(500226);
      expect(poolTokenABalance).to.equal(22439);

    })

    it('user can convert and transfer any token along a Uniswap pool path of 3', async () => {
      await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

      const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
      const msgSenderTokenABalance = await swapToToken.balanceOf(deployer.address);
      const poolTokenABalance = await swapToToken.balanceOf(payees[0]);

      expect(feeReceiverTokenABalance).to.equal(0);
      expect(msgSenderTokenABalance).to.equal(500207);
      expect(poolTokenABalance).to.equal(20516);

    });

    it('event ConvertAndTransfer is emitted when user successfully calls convertAndTransfer function along a Uniswap pool path of 2', async () => {

      await expect(feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, swapToToken.address]))
        .to.emit(feeReceiver, 'ConvertAndTransfer')
        .withArgs(deployer.address, testAToken.address, swapToToken.address, 25000, 22665, payees);

    })

    it('event ConvertAndTransfer is emitted when user successfully calls convertAndTransfer function along a Uniswap pool path of 3', async () => {

      await expect(feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]))
        .to.emit(feeReceiver, 'ConvertAndTransfer')
        .withArgs(deployer.address, testAToken.address, swapToToken.address, 25000, 20723, payees);

    })

    // conduct more test with stakers

  });
  describe('Convert and transfer with staking enabled', async () => {

    before(async () => {
      await feeReceiver.connect(deployer).setStakeAddress(stakingContract.address)

      await feeReceiver.connect(deployer).setStakeThreshold(500);

      await feeReceiver.connect(deployer).setStakeActive(true);
    });

    it('user cannot successfully convert and transfer token when staking is required and user is not staking any stake tokens', async () => {

      await expect(feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]))
        .to.be.revertedWith('Not enough staked tokens');

    });

    it('user cannot successfully convert and transfer token when staking is required and user is not staking enough stake tokens', async () => {

      await expect(feeReceiver.connect(account1).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]))
        .to.be.revertedWith('Not enough staked tokens');

    });

    it('user can successfully convert and transfer token when staking is required and user is staking enough', async () => {

      await feeReceiver.connect(account2).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

      const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
      const msgSenderTokenABalance = await swapToToken.balanceOf(account2.address);
      const poolTokenABalance = await swapToToken.balanceOf(payees[0]);

      expect(feeReceiverTokenABalance).to.equal(0);
      expect(msgSenderTokenABalance).to.equal(207);
      expect(poolTokenABalance).to.equal(20516);

    });

  });
});
