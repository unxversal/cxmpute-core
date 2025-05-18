// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol"; // Provides burn and burnFrom
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract SynthERC20 is ERC20, ERC20Burnable, AccessControlEnumerable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE"); // BURNER_ROLE can call burnFrom

    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        address initialAdmin, // Address to grant DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE
        address minterAndBurner // Typically the Vault address
    ) ERC20(name, symbol) {
        require(initialAdmin != address(0), "SynthERC20: Initial admin cannot be zero address");
        require(minterAndBurner != address(0), "SynthERC20: Minter/Burner cannot be zero address");
        
        _decimals = decimals_;

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MINTER_ROLE, minterAndBurner);
        _grantRole(BURNER_ROLE, minterAndBurner); // Vault will also be the burner
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Creates `amount` new tokens for `to`.
     * See {ERC20-_mint}.
     * Requirements:
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 amount) external virtual onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     * See {ERC20-_burn}.
     * Requirements:
     * - the caller must have the `BURNER_ROLE`.
     * - `account` must have approved `amount` to the caller.
     */
    function burnFrom(address account, uint256 amount) public virtual override onlyRole(BURNER_ROLE) {
        // This overrides the standard ERC20Burnable.burnFrom to enforce BURNER_ROLE
        // The original ERC20Burnable.burnFrom checks allowance internally via _spendAllowance
        super.burnFrom(account, amount);
    }

    // ERC20Burnable already provides a public burn(uint256 amount) which burns msg.sender's tokens.
    // If you need a burn function callable only by BURNER_ROLE to burn tokens held by THIS contract,
    // you would add a custom one:
    /*
    function burnHeldTokens(uint256 amount) external virtual onlyRole(BURNER_ROLE) {
        _burn(address(this), amount);
    }
    */

    // Allow admin to grant/revoke roles if needed after deployment, e.g., change minter/burner.
    // AccessControlEnumerable already provides role management functions like grantRole, revokeRole, renounceRole.
}