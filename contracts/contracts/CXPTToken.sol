// File: CXPTToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * Governance / rebate token – minted 1 : 1 when users withdraw
 * “asCxpt = true”.  Vault is the sole minter.
 */
contract CXPTToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address initialAdmin) ERC20("CXMpute Token", "CXPT") {
        require(initialAdmin != address(0), "CXPTToken: Initial admin cannot be zero");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        // MINTER_ROLE for the Vault will be granted in the deployment script
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}