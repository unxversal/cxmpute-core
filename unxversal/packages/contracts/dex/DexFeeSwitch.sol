// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol"; // To set fee recipient once
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DexFeeSwitch
 * @author Unxversal Team
 * @notice Manages the collection and distribution of trading fees for the Unxversal DEX.
 * @dev This contract is designed to be immutable regarding its fee logic after deployment.
 *      The fee recipient can be set once by the owner (deployer/DAO).
 *      It collects fees in various tokens and expects an off-chain or DAO-governed
 *      process to swap these fees to a standard denomination (e.g., USDC) if desired.
 *      Your spec mentioned: "All fee destinations ... are USDC-denominated. Fees received in other
 *      assets are auto-swapped to USDC via a whitelisted route at the time of deposit."
 *      This contract will *collect* them. The auto-swap would be a separate mechanism
 *      interacting with this contract's collected fees or triggered by the `depositFee` function
 *      if it had swap capabilities (which adds complexity and gas). For V1, simple collection.
 */
contract DexFeeSwitch {
    using SafeERC20 for IERC20;

    address public immutable feeRecipient; // Can be a treasury, multisig, or another contract
    bool public constant recipientIsSet = true; // To indicate it's set (as it's immutable)

    // If you want to allow setting it once post-deployment instead of constructor:
    // address public feeRecipient;
    // bool public recipientIsSet;
    // address public owner; // To set the feeRecipient

    event FeeRecipientSet(address indexed recipient);
    event FeeDeposited(address indexed token, address indexed payer, address indexed recipient, uint256 amount);

    /**
     * @param _initialFeeRecipient The address that will receive all collected fees.
     *                           Cannot be the zero address.
     */
    constructor(address _initialFeeRecipient) {
        require(_initialFeeRecipient != address(0), "DexFeeSwitch: Zero fee recipient");
        feeRecipient = _initialFeeRecipient;
        emit FeeRecipientSet(_initialFeeRecipient);
    }

    // If allowing one-time set post-deployment:
    // constructor() { owner = msg.sender; }
    // function setFeeRecipient(address _newFeeRecipient) external {
    //     require(msg.sender == owner, "DexFeeSwitch: Not owner");
    //     require(!recipientIsSet, "DexFeeSwitch: Recipient already set");
    //     require(_newFeeRecipient != address(0), "DexFeeSwitch: Zero fee recipient");
    //     feeRecipient = _newFeeRecipient;
    //     recipientIsSet = true;
    //     emit FeeRecipientSet(_newFeeRecipient);
    // }


    /**
     * @notice Called by the OrderNFT contract (or other fee-generating contracts) to deposit fees.
     * @dev This function pulls the fee amount from the `payer` (typically the OrderNFT contract itself,
     *      which would have received the tokens from users).
     * @param token The ERC20 token address of the fee being deposited.
     * @param payer The address from which to pull the fee (must have approved this contract).
     * @param amount The amount of the fee to deposit.
     */
    function depositFee(address token, address payer, uint256 amount) external {
        require(recipientIsSet, "DexFeeSwitch: Fee recipient not set");
        require(amount > 0, "DexFeeSwitch: Zero fee amount");
        require(payer != address(0), "DexFeeSwitch: Zero payer address"); // Should be the OrderNFT contract

        IERC20(token).safeTransferFrom(payer, feeRecipient, amount);

        emit FeeDeposited(token, payer, feeRecipient, amount);
    }

    /**
     * @notice Allows the feeRecipient (or a designated admin if this contract becomes Ownable
     *         and has more complex logic) to withdraw collected fees for a specific token.
     * @dev This is primarily useful if fees accumulate here before being swept.
     *      If feeRecipient is an EOA, they don't need this. If it's a contract, it might.
     *      However, direct `safeTransferFrom` to `feeRecipient` in `depositFee` is simpler.
     *      This function is only useful if this contract itself holds balances.
     *      Given the `safeTransferFrom` in `depositFee`, this contract should not hold balances.
     *      If the goal is for this contract to *accumulate* fees and then have the recipient
     *      claim them (or for an auto-swap mechanism to pull from here), then `depositFee`
     *      should transfer to `address(this)`.
     *
     *      Revisiting spec: "All fee destinations ... are USDC-denominated. Fees received in other assets
     *      are auto-swapped ... at the time of deposit." This implies `depositFee` might interact with
     *      a router. For V1 simplicity, let's assume `depositFee` sends directly to `feeRecipient`.
     *      If an auto-swap is desired, `depositFee` becomes more complex.
     *
     *      If `feeRecipient` is a contract that *performs* the auto-swap:
     *      The current `depositFee` sends tokens directly to `feeRecipient`. That recipient contract
     *      would then handle any swaps. This DexFeeSwitch remains simple.
     */

    // To support the "auto-swap to USDC" feature more directly within this contract (adds complexity):
    // address public usdcToken;
    // IUniswapV2Router02 public uniswapRouter; // Example router
    // mapping(address => address[]) public swapPathToUsdc; // tokenIn => [tokenIn, weth, usdc]

    // function setUniswapRouter(address _router) external onlyOwner;
    // function setUsdcToken(address _usdc) external onlyOwner;
    // function setSwapPath(address _tokenIn, address[] calldata _path) external onlyOwner;

    // function depositFeeAndSwapToUsdc(address tokenIn, address payer, uint256 amountIn) external {
    //     require(recipientIsSet, "Recipient not set");
    //     IERC20(tokenIn).safeTransferFrom(payer, address(this), amountIn);
    //     _approveTokenIfNeeded(tokenIn, address(uniswapRouter), amountIn);
    //     uint256 balanceBefore = IERC20(usdcToken).balanceOf(feeRecipient);
    //     uniswapRouter.swapExactTokensForTokens(...); // perform swap
    //     uint256 balanceAfter = IERC20(usdcToken).balanceOf(feeRecipient);
    //     emit FeeDeposited(usdcToken, payer, feeRecipient, balanceAfter - balanceBefore);
    // }

    // For now, sticking to the simpler direct deposit model. Auto-swap can be a V2 or
    // handled by the `feeRecipient` contract if it's a smart contract.
}