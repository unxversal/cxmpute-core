// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * 1 : 1‑backed synthetic asset.  Vault is the minter & burner.
 */
contract SynthERC20 is ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(string memory n, string memory s, address vault)
        ERC20(n, s)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, vault);
    }

    /* Vault‐only */
    function mint(address to, uint256 amt) external onlyRole(MINTER_ROLE) {
        _mint(to, amt);
    }

    function burnFromVault(address from, uint256 amt)
        external
        onlyRole(MINTER_ROLE)
    {
        _burn(from, amt);
    }
}