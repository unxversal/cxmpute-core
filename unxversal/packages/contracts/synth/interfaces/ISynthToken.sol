// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ISynthToken
 * @author Unxversal Team
 * @notice Interface for synthetic asset (sAsset) tokens.
 * @dev Extends IERC20 with a controlled minting function. Burning is handled
 *      via ERC20Burnable's `burnFrom` by an authorized controller.
 */
interface ISynthToken is IERC20 {
    /**
     * @notice Mints new synth tokens to an account.
     * @dev Typically only callable by a trusted minter (e.g., USDCVault).
     * @param to The address to mint tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external;

    // ERC20Burnable's `burnFrom(address account, uint256 amount)` will be used by the controller.
    // No separate `burn(address from, ...)` needed in this interface if controller uses `burnFrom`.
}