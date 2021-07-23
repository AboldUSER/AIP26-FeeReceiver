// SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./TokenPaymentSplitter.sol";

interface IOneSplitAudit {
    function swap(
        IERC20 fromToken,
        IERC20 destToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] memory distribution,
        uint256 flags
    ) external payable returns (uint256 returnAmount);

    function getExpectedReturn(
        IERC20 fromToken,
        IERC20 destToken,
        uint256 amount,
        uint256 parts,
        uint256 flags // See constants in IOneSplit.sol
    )
        external
        view
        returns (uint256 returnAmount, uint256[] memory distribution);
}

interface IPool {
    /**
     * @notice Structs
     */
    struct Claim {
        bytes32 root;
        uint256 score;
        bytes32[] proof;
    }

    function withdrawProtected(
        Claim[] memory claims,
        IERC20 token,
        uint256 minimumAmount
    ) external;
}

contract FeeReceiver is Ownable, TokenPaymentSplitter {
    using SafeMath for uint256;

    event FeeConsolidatation(
        address triggerAccount,
        IERC20 swapFrom,
        IERC20 swapTo,
        uint256 amount,
        address[] recievedAddresses
    );

    address public swapToToken;

    address public poolAddress;

    address public oneSplitAudit;

    address public stakeAddress;

    uint256 public stakeThreshold;

    uint256 public triggerFee;

    bool public stakeActive;

    /**
     * @dev Set a new token to swap to (e.g., stabletoken).
     **/ 
    function setSwapToToken(address _swapToToken) public onlyOwner {
        swapToToken = _swapToToken;
    }

    /**
     * @dev Set a new address of fee pool.
     */
    function setPoolAddress(address _poolAddress) public onlyOwner {
        poolAddress = _poolAddress;
    }

    /**
     * @dev Set a new address of on-chain AMM.
     */
    function setOneSplitAudit(address _oneSplitAudit) public onlyOwner {
        oneSplitAudit = _oneSplitAudit;
    }

    /**
     * @dev Set a new address of stake contract.
     */
    function setStakeAddress(address _stakeAddress) public onlyOwner {
        stakeAddress = _stakeAddress;
    }

    /**
     * @dev Set a new threshold for stake contract token balance.
     */
    function setStakeThreshold(uint256 _stakeThreshold) public onlyOwner {
        stakeThreshold = _stakeThreshold;
    }

        /**
     * @dev Set a if staking is required.
     */
    function setStakeActive(bool _switch) public onlyOwner {
        stakeActive = _switch;
    }

    /**
     * @dev Set a new fee (perentage 0 - 100) for calling the ConsolidateFeeToken function.
     */
    function setTriggerFee(uint256 _triggerFee) public onlyOwner {
        triggerFee = _triggerFee;
    }

    constructor(
        address _swapToToken,
        address _poolAddress,
        address _oneSplitAudit,
        uint256 _triggerFee,
        address[] memory payees,
        uint256[] memory shares_
    ) TokenPaymentSplitter(payees, shares_) {
        swapToToken = _swapToToken;
        poolAddress = _poolAddress;
        oneSplitAudit = _oneSplitAudit;
        triggerFee = _triggerFee;
    }

    /**
     * @dev Set a new fee (perentage 0 - 100) for calling the ConsolidateFeeToken function.
     * @param _claims The claim struct necessary to withdraw from the fee pool.
     * @param _swapFromToken The token from the fee pool to be swapped from.
     * @param _amount The amount of token from the fee pool to be swapped and distributed.
     */
    function ConsolidateFeeToken(
        IPool.Claim[] memory _claims,
        address _swapFromToken,
        uint256 _amount
    ) public {

        if (stakeActive) {
            require(checkStake(msg.sender), "Not enough staked tokens");
        }

        // Calls the withdrawProtected function from the fee pool to transfer tokens into this contract.
        IPool(poolAddress).withdrawProtected(
            _claims,
            IERC20(_swapFromToken),
            _amount
        );

        // Calls the getExpectedReturn function from the on-chain AMM and catches result.
        (uint256 _expected, uint256[] memory _distribution) = IOneSplitAudit(
            oneSplitAudit
        ).getExpectedReturn(
            IERC20(_swapFromToken),
            IERC20(swapToToken),
            _amount,
            0,
            0
        );

        // Calls the swap function from the on-chain AMM to swap token from fee pool into (stable)token.
        IOneSplitAudit(oneSplitAudit).swap(
            IERC20(_swapFromToken),
            IERC20(swapToToken),
            _amount,
            _expected,
            _distribution,
            0
        );

        // Calculates trigger reward amount and transfers to msg.sender.
        uint256 triggerFeeAmount = _amount.mul(triggerFee).div(100);
        _transferErc20(msg.sender, swapToToken, triggerFeeAmount);

        // Transfers remaining amount to reward pool address(es).
        uint256 rewardPoolAmount = _amount.sub(triggerFeeAmount);
        for (uint256 i = 0; i < _payees.length; i++) {
            uint256 distributionRatio = (_shares[_payees[i]] / _totalShares);
            _transferErc20(
                _payees[i],
                swapToToken,
                rewardPoolAmount.mul(distributionRatio)
            );
        }

        emit FeeConsolidatation(
            msg.sender,
            IERC20(_swapFromToken),
            IERC20(swapToToken),
            _amount,
            _payees
        );
    }

    /**
     * @dev Internal function to transfer ERC20 held in the contract.
     *
     * */
    function _transferErc20(
        address _recipient,
        address _tokenContract,
        uint256 _returnAmount
    ) internal {
        IERC20 erc;
        erc = IERC20(_tokenContract);
        require(
            erc.balanceOf(address(this)) >= _returnAmount,
            "Not enough funds to transfer"
        );
        erc.transfer(_recipient, _returnAmount);
    }

    /**
     * @dev Checks if an address is staking tokens at or above threshold.
     * @param _staker Address to check if token staker.
     */
    function checkStake(address _staker) internal view returns(bool) {
        IERC20 erc;
        erc = IERC20(stakeAddress);
        bool verifiedStaker = (erc.balanceOf(_staker) >= stakeThreshold) ? true : false;
        return verifiedStaker;
    }

    /**
     * @dev Add a recipient to receive payouts from the consolidateFeeToken function.
     * @param _account Address of the recipient.
     * @param _shares Amount of shares to determine th proportion of payout received.
     */
    function addPayee(address _account, uint256 _shares) public onlyOwner {
        _addPayee(_account, _shares);
    }

    /**
     * @dev Remove a recipient from receiving payouts from the consolidateFeeToken function.
     * @param _account Address of the recipient.
     * @param _index Index number of the recipient in the array of recipients.
     */
    function removePayee(address _account, uint256 _index) public onlyOwner {
        _removePayee(_account, _index);
    }
}
