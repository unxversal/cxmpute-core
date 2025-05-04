// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * Governance / fee‑rebate token for the DEX.
 * ‑ Minted 1 : 1 by Vault when a user withdraws as CXPT.
 * ‑ No external mint; burning only allowed for Vault (if needed).
 */
contract CXPTToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address vault) ERC20("Cxmpute Protocol Token", "CXPT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, vault);
    }

    /* ------------------------------------------------------------ */
    /*                        Mint / Burn                           */
    /* ------------------------------------------------------------ */

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }
}