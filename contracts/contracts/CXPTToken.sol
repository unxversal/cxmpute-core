// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title CXPT – Cxmpute Network Token
/// @notice Fixed-supply ERC-20 with burn and permit capabilities.
contract CXPTToken is ERC20Burnable, ERC20Permit {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 1B with 18 decimals

    constructor(address initialReceiver) ERC20("Cxmpute Token", "CXPT") ERC20Permit("CXPT") {
        _mint(initialReceiver, MAX_SUPPLY);
    }
} 