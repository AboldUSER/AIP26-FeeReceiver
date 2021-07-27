// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./TokenPaymentSplitter.sol";

interface IUniswapV2Router02 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

contract FeeReceiver is Ownable, TokenPaymentSplitter {
    using SafeMath for uint256;

    event FeeConsolidatation(
        address triggerAccount,
        IERC20 swapTokenFrom,
        IERC20 swapTokenTo,
        uint256 amountTokenFrom,
        uint256 amountTokenTo,
        address[] recievedAddresses
    );

    address public swapToToken;

    address public poolAddress;

    address public immutable uniRouter;

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
        address _uniRouter,
        uint256 _triggerFee,
        address[] memory _payees,
        uint256[] memory _shares
    ) TokenPaymentSplitter(_payees, _shares) {
        swapToToken = _swapToToken;
        poolAddress = _poolAddress;
        uniRouter = _uniRouter;
        triggerFee = _triggerFee;
    }

    /**
     * @dev Set a new fee (perentage 0 - 100) for calling the ConsolidateFeeToken function.
     * @param _swapFromToken The token from the fee pool to be swapped from.
     * @param _amountOutMin The amount of token from the fee pool to be swapped and distributed.
     * @param _path The amount of token from the fee pool to be swapped and distributed.
     */
    function convertAndTransfer(
        address _swapFromToken,
        uint256 _amountOutMin,
        address[] calldata _path
    ) public {

        if (stakeActive) {
            require(checkStake(msg.sender), "Not enough staked tokens");
        }

        // Calls the balanceOf function from the to be converted token.
        (uint256 tokenBalance) = _balanceOfErc20(_swapFromToken);

        // Approve token for AMM usage.
        _approveErc20(_swapFromToken, tokenBalance);

        // Calls the balanceOf function from the reward token to get the initial balance pre-swap.
        (uint256 initialTokenBalance) = _balanceOfErc20(swapToToken);
        
        // Calls the swap function from the on-chain AMM to swap token from fee pool into reward token.
        IUniswapV2Router02(uniRouter).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            tokenBalance,
            _amountOutMin,
            _path,
            address(this),
            block.timestamp.add(600) // Sets a deadline currently set at 600 seconds || 10 minutes
        );

        // Calls the balanceOf function from the reward token to get the new balance post-swap.
        (uint256 newTokenBalance) = _balanceOfErc20(swapToToken);

        // Calls the swap function from the on-chain AMM to swap token from fee pool into reward token.
        uint256 rewardAmount = newTokenBalance.sub(initialTokenBalance);

        // Calculates trigger reward amount and transfers to msg.sender.
        uint256 triggerFeeAmount = rewardAmount.mul(triggerFee).div(100);
        _transferErc20(msg.sender, swapToToken, triggerFeeAmount);

        // Transfers remaining amount to reward pool address(es).
        uint256 rewardPoolAmount = rewardAmount.sub(triggerFeeAmount);
        for (uint256 i = 0; i < _payees.length; i++) {
            uint256 distributionRatio = (_shares[_payees[i]].div(_totalShares));
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
            tokenBalance,
            rewardAmount,
            _payees
        );
    }

    /**
     * @dev Internal function to transfer ERC20 held in the contract.
     * @param _recipient Address to receive ERC20.
     * @param _tokenContract Address of the ERC20.
     * @param _transferAmount Amount or ERC20 to be transferred.
     *
     * */
    function _transferErc20(
        address _recipient,
        address _tokenContract,
        uint256 _transferAmount
    ) internal {
        IERC20 erc;
        erc = IERC20(_tokenContract);
        require(
            erc.balanceOf(address(this)) >= _transferAmount,
            "Not enough funds to transfer"
        );
        erc.transfer(_recipient, _transferAmount);
    }

    /**
     * @dev Internal function to approve ERC20 for AMM calls.
     * @param _tokenToApprove Address of ERC20 to approve.
     * @param _amount Amount of ERC20  to be approved.
     *
     * */
    function _approveErc20(
        address _tokenToApprove,
        uint256 _amount
    ) internal {
        IERC20 erc;
        erc = IERC20(_tokenToApprove);
        require(
            erc.approve(address(uniRouter), _amount), 'approve failed.');
    }

    /**
     * @dev Internal function to call balanceOf on ERC20.
     * @param _tokenToBalanceOf Address of ERC20 to call.
     * 
     * */
    function _balanceOfErc20(
        address _tokenToBalanceOf
    ) internal view returns (uint256) {
        IERC20 erc;
        erc = IERC20(_tokenToBalanceOf);
        (uint256 tokenBalance) = erc.balanceOf(address(this));
        return tokenBalance;
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
