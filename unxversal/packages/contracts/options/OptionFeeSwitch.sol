// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol"; // For setting fee recipient once
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OptionsFeeSwitch
 * @author Unxversal Team
 * @notice Manages collection of fees from options trading (premiums) and/or exercise.
 * @dev Fee recipient is set immutably at deployment.
 *      Assumes fees are directly transferred to feeRecipient. Auto-swapping to USDC
 *      would be handled by the feeRecipient contract or an external process.
 */
contract OptionsFeeSwitch {
    using SafeERC20 for IERC20;

    address public immutable feeRecipient;

    event FeeRecipientSet(address indexed recipient); // Emitted at construction
    event OptionFeeDeposited(
        address indexed feeToken,
        address indexed payerContract, // e.g., OptionNFT or CollateralVault
        address indexed originalUser,  // User who triggered the fee (buyer or exerciser)
        uint256 amount
    );

    /**
     * @param _initialFeeRecipient The address to receive all collected option fees.
     */
    constructor(address _initialFeeRecipient) {
        require(_initialFeeRecipient != address(0), "OptionsFeeSwitch: Zero fee recipient");
        feeRecipient = _initialFeeRecipient;
        emit FeeRecipientSet(_initialFeeRecipient);
    }

    /**
     * @notice Called by OptionNFT or CollateralVault to deposit collected fees.
     * @dev Pulls `amount` of `feeToken` from `msg.sender` (the payerContract) to `feeRecipient`.
     * @param feeToken The ERC20 token address of the fee.
     * @param originalUser The user whose action generated the fee (for event logging).
     * @param amount The amount of the fee to deposit.
     */
    function depositOptionFee(
        address feeToken,
        address originalUser, // For better event data
        uint256 amount
    ) external {
        // msg.sender is the contract (e.g., OptionNFT) that collected the fee and is now depositing it.
        require(amount > 0, "OptionsFeeSwitch: Zero fee amount");
        IERC20(feeToken).safeTransferFrom(msg.sender, feeRecipient, amount);
        emit OptionFeeDeposited(feeToken, msg.sender, originalUser, amount);
    }
}