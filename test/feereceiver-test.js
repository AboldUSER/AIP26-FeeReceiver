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
    let payeeA // = "0x7296333e1615721f4Bd9Df1a3070537484A50CF8" current Airswap smart contract pool address
    let payeeB;
    let payeeC;
    let payeeD;
    let testAToken;
    let testBToken;
    let swapToToken;
    let uniswapV2Router02Contract;
    let feeReceiver;
    let uniRouter
    let triggerFee = 1;
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
        [deployer, account1, account2, payeeA, payeeB, payeeC, payeeD] = await ethers.getSigners();

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
            [payeeA.address],
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
            expect(payeesAddress).to.equal(payeeA.address);
            expect(sharesAmount).to.equal(shares[0]);
        });
    });

    describe("Add and remove payees and convert and transfer", async () => {
        it("multiple payees with even number of shares are added to fee receiver contract", async () => {
            const payeeShares = 10;
            const beginningTotalShares = await feeReceiver.totalShares();

            await feeReceiver.connect(deployer).addPayee(payeeB.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeC.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeD.address, payeeShares);

            const originalPayeeAAddress = await feeReceiver.payee(0)
            const newPayeeBAddress = await feeReceiver.payee(1);
            const newPayeeCAddress = await feeReceiver.payee(2);
            const newPayeeDAddress = await feeReceiver.payee(3);
            const originalPayeeAShares = await feeReceiver.shares(payeeA.address);
            const newPayeeBShares = await feeReceiver.shares(payeeB.address);
            const newPayeeCShares = await feeReceiver.shares(payeeC.address);
            const newPayeeDShares = await feeReceiver.shares(payeeD.address);
            const endingTotalShares = await feeReceiver.totalShares();

            expect(originalPayeeAAddress).to.equal(payeeA.address);
            expect(newPayeeBAddress).to.equal(payeeB.address);
            expect(newPayeeCAddress).to.equal(payeeC.address);
            expect(newPayeeDAddress).to.equal(payeeD.address);
            expect(originalPayeeAShares).to.equal(10);
            expect(newPayeeBShares).to.equal(10);
            expect(newPayeeCShares).to.equal(10);
            expect(newPayeeDShares).to.equal(10);
            expect(endingTotalShares).to.equal(parseFloat(beginningTotalShares) + parseFloat(payeeShares * 3));
        });

        it("multiple payees with uneven number of shares are added to fee receiver contract", async () => {
            const payeeAShares = 10;
            const payeeBShares = 5;
            const payeeCShares = 11;
            const payeeDShares = 7;
            const beginningTotalShares = await feeReceiver.totalShares();

            await feeReceiver.connect(deployer).addPayee(payeeB.address, payeeBShares);
            await feeReceiver.connect(deployer).addPayee(payeeC.address, payeeCShares);
            await feeReceiver.connect(deployer).addPayee(payeeD.address, payeeDShares);

            const originalPayeeAAddress = await feeReceiver.payee(0)
            const newPayeeBAddress = await feeReceiver.payee(1);
            const newPayeeCAddress = await feeReceiver.payee(2);
            const newPayeeDAddress = await feeReceiver.payee(3);
            const originalPayeeAShares = await feeReceiver.shares(payeeA.address);
            const newPayeeBShares = await feeReceiver.shares(payeeB.address);
            const newPayeeCShares = await feeReceiver.shares(payeeC.address);
            const newPayeeDShares = await feeReceiver.shares(payeeD.address);
            const endingTotalShares = await feeReceiver.totalShares();

            expect(originalPayeeAAddress).to.equal(payeeA.address);
            expect(newPayeeBAddress).to.equal(payeeB.address);
            expect(newPayeeCAddress).to.equal(payeeC.address);
            expect(newPayeeDAddress).to.equal(payeeD.address);
            expect(originalPayeeAShares).to.equal(payeeAShares);
            expect(newPayeeBShares).to.equal(payeeBShares);
            expect(newPayeeCShares).to.equal(payeeCShares);
            expect(newPayeeDShares).to.equal(payeeDShares);
            expect(endingTotalShares).to.equal(parseFloat(beginningTotalShares) + payeeBShares + payeeCShares + payeeDShares);
        });

        it("token is converted and distibuted evenly to multiple payees", async () => {
            const payeeShares = 10;

            await feeReceiver.connect(deployer).addPayee(payeeB.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeC.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeD.address, payeeShares);

            await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

            const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
            const msgSenderTokenABalance = await swapToToken.balanceOf(deployer.address);
            const payeeATokenBalance = await swapToToken.balanceOf(payeeA.address);
            const payeeBTokenBalance = await swapToToken.balanceOf(payeeB.address);
            const payeeCTokenBalance = await swapToToken.balanceOf(payeeC.address);
            const payeeDTokenBalance = await swapToToken.balanceOf(payeeD.address);

            expect(feeReceiverTokenABalance).to.equal(0);
            expect(msgSenderTokenABalance).to.equal(500207);
            expect(payeeATokenBalance).to.equal(5129);
            expect(payeeBTokenBalance).to.equal(5129);
            expect(payeeCTokenBalance).to.equal(5129);
            expect(payeeDTokenBalance).to.equal(5129);
        });

        it("token is converted and distibuted unevenly to multiple payees", async () => {
            const payeeBShares = 5;
            const payeeCShares = 11;
            const payeeDShares = 7;

            await feeReceiver.connect(deployer).addPayee(payeeB.address, payeeBShares);
            await feeReceiver.connect(deployer).addPayee(payeeC.address, payeeCShares);
            await feeReceiver.connect(deployer).addPayee(payeeD.address, payeeDShares);

            await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

            const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
            const msgSenderTokenABalance = await swapToToken.balanceOf(deployer.address);
            const payeeATokenBalance = await swapToToken.balanceOf(payeeA.address);
            const payeeBTokenBalance = await swapToToken.balanceOf(payeeB.address);
            const payeeCTokenBalance = await swapToToken.balanceOf(payeeC.address);
            const payeeDTokenBalance = await swapToToken.balanceOf(payeeD.address);

            expect(feeReceiverTokenABalance).to.equal(0);
            expect(msgSenderTokenABalance).to.equal(500207);
            expect(payeeATokenBalance).to.equal(6154);
            expect(payeeBTokenBalance).to.equal(3077);
            expect(payeeCTokenBalance).to.equal(6770);
            expect(payeeDTokenBalance).to.equal(4308);
        });

        it("payees are added and some removed and token is converted and distibuted evenly to remaining payees", async () => {
            const payeeShares = 10;

            await feeReceiver.connect(deployer).addPayee(payeeB.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeC.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeD.address, payeeShares);
            await feeReceiver.connect(deployer).removePayee(payeeA.address, 0);

            await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

            const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
            const msgSenderTokenABalance = await swapToToken.balanceOf(deployer.address);
            const payeeATokenBalance = await swapToToken.balanceOf(payeeA.address);
            const payeeBTokenBalance = await swapToToken.balanceOf(payeeB.address);
            const payeeCTokenBalance = await swapToToken.balanceOf(payeeC.address);
            const payeeDTokenBalance = await swapToToken.balanceOf(payeeD.address);

            expect(feeReceiverTokenABalance).to.equal(0);
            expect(msgSenderTokenABalance).to.equal(500207);
            expect(payeeATokenBalance).to.equal(0);
            expect(payeeBTokenBalance).to.equal(6770);
            expect(payeeCTokenBalance).to.equal(6770);
            expect(payeeDTokenBalance).to.equal(6770);
        });

        it("payees are added and some removed and token is converted and distibuted unevenly to remaining payees", async () => {
            const payeeBShares = 5;
            const payeeCShares = 11;
            const payeeDShares = 7;

            await feeReceiver.connect(deployer).addPayee(payeeB.address, payeeBShares);
            await feeReceiver.connect(deployer).addPayee(payeeC.address, payeeCShares);
            await feeReceiver.connect(deployer).addPayee(payeeD.address, payeeDShares);
            await feeReceiver.connect(deployer).removePayee(payeeA.address, 0);

            await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

            const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
            const msgSenderTokenABalance = await swapToToken.balanceOf(deployer.address);
            const payeeATokenBalance = await swapToToken.balanceOf(payeeA.address);
            const payeeBTokenBalance = await swapToToken.balanceOf(payeeB.address);
            const payeeCTokenBalance = await swapToToken.balanceOf(payeeC.address);
            const payeeDTokenBalance = await swapToToken.balanceOf(payeeD.address);

            expect(feeReceiverTokenABalance).to.equal(0);
            expect(msgSenderTokenABalance).to.equal(500207);
            expect(payeeATokenBalance).to.equal(0);
            expect(payeeBTokenBalance).to.equal(4308);
            expect(payeeCTokenBalance).to.equal(9642);
            expect(payeeDTokenBalance).to.equal(6154);
        });

        it("token is converted and distibuted evenly to multiple payees with staking enabled", async () => {

            const payeeShares = 10;

            await feeReceiver.connect(deployer).addPayee(payeeB.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeC.address, payeeShares);
            await feeReceiver.connect(deployer).addPayee(payeeD.address, payeeShares);

            await feeReceiver.connect(deployer).setStakeAddress(stakingContract.address)

            await feeReceiver.connect(deployer).setStakeThreshold(500);

            await feeReceiver.connect(deployer).setStakeActive(true);

            await feeReceiver.connect(account2).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

            const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
            const msgSenderTokenABalance = await swapToToken.balanceOf(account2.address);
            const payeeATokenBalance = await swapToToken.balanceOf(payeeA.address);
            const payeeBTokenBalance = await swapToToken.balanceOf(payeeB.address);
            const payeeCTokenBalance = await swapToToken.balanceOf(payeeC.address);
            const payeeDTokenBalance = await swapToToken.balanceOf(payeeD.address);

            expect(feeReceiverTokenABalance).to.equal(0);
            expect(msgSenderTokenABalance).to.equal(207);
            expect(payeeATokenBalance).to.equal(5129);
            expect(payeeBTokenBalance).to.equal(5129);
            expect(payeeCTokenBalance).to.equal(5129);
            expect(payeeDTokenBalance).to.equal(5129);
        });

        it("token is not converted and distributed if there are no payees", async () => {
            await feeReceiver.connect(deployer).removePayee(payeeA.address, 0);

            await expect(feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]))
                .to.be.revertedWith('No payees are set');

        });

    });

    describe('Convert and transfer without staking', async () => {
        it('user cannot convert and transfer a token that is not in the contract', async () => {

            await expect(feeReceiver.connect(deployer).convertAndTransfer(testBToken.address, 0, [testBToken.address, swapToToken.address]))
                .to.be.revertedWith('Token balance is zero')

        });

        it('user cannot convert and transfer a token without a swap path', async () => {

            await expect(feeReceiver.connect(deployer).convertAndTransfer(testBToken.address, 0, []))
                .to.be.reverted;

        });

        it('trigger fee set to zero and user can still convert and transfer a token', async () => {
            await feeReceiver.connect(deployer).setTriggerFee(0);
            await feeReceiver.connect(deployer).convertAndTransfer(testAToken.address, 0, [testAToken.address, swapToToken.address]);

            const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
            const msgSenderTokenABalance = await swapToToken.balanceOf(deployer.address);
            const poolTokenABalance = await swapToToken.balanceOf(payeeA.address);

            expect(feeReceiverTokenABalance).to.equal(0);
            expect(msgSenderTokenABalance).to.equal(500000);
            expect(poolTokenABalance).to.equal(22665);
        })

    });

    describe('Convert and transfer with staking enabled', async () => {

        before(async () => {
            await feeReceiver.connect(deployer).setStakeAddress(stakingContract.address)

            await feeReceiver.connect(deployer).setStakeThreshold(500);

            await feeReceiver.connect(deployer).setStakeActive(true);
        });

        it('user cannot successfully convert and transfer token when staking is required and threshold is increased above stake amount of user', async () => {

            await feeReceiver.connect(deployer).setStakeThreshold(501);
            await expect(feeReceiver.connect(account1).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]))
                .to.be.revertedWith('Not enough staked tokens');

        });

        it('user successfully convert and transfer token when staking is turned back off though user is not staking enough stake tokens', async () => {

            await feeReceiver.connect(deployer).setStakeActive(false);
            await feeReceiver.connect(account1).convertAndTransfer(testAToken.address, 0, [testAToken.address, testBToken.address, swapToToken.address]);

            const feeReceiverTokenABalance = await testAToken.balanceOf(feeReceiver.address);
            const msgSenderTokenABalance = await swapToToken.balanceOf(account1.address);
            const poolTokenABalance = await swapToToken.balanceOf(payeeA.address);

            expect(feeReceiverTokenABalance).to.equal(0);
            expect(msgSenderTokenABalance).to.equal(207);
            expect(poolTokenABalance).to.equal(20516);

        });

    });
});
