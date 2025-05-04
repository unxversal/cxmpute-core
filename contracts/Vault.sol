// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./CXPTToken.sol";

/**
 * Holds 100 % USDC collateral and issues transferable *shares*.
 * Shares == claim on 1 USDC each (scales with decimals of USDC).
 *
 * Upgradeable via UUPS pattern.
 */
contract Vault is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    /* ------------------------------------------------------------ */
    /*                            State                             */
    /* ------------------------------------------------------------ */

    IERC20Upgradeable public usdc;          // immutable after init
    CXPTToken public cxpt;                  // immutable after init

    mapping(address => uint256) public shares; // user → shares
    uint256 public totalShares;

    /* ------------------------------------------------------------ */
    /*                       Initialisation                         */
    /* ------------------------------------------------------------ */

    function initialize(address _usdc, address _cxpt) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        usdc = IERC20Upgradeable(_usdc);
        cxpt = CXPTToken(_cxpt);
    }

    /* Only owner (DAO upgrade executor) can upgrade */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /* ------------------------------------------------------------ */
    /*                       Core functions                         */
    /* ------------------------------------------------------------ */

    /**
     * @dev Deposit USDC. Caller must `approve()` first.
     * Shares minted == amount (1 : 1). No fees.
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "zero deposit");
        usdc.transferFrom(msg.sender, address(this), amount);

        shares[msg.sender] += amount;
        totalShares += amount;
    }

    /**
     * @dev Withdraw underlying. If `asCxpt` true,
     *      CXPT is minted 1 : 1 and sent; USDC stays in vault.
     */
    function withdraw(uint256 shareAmount, bool asCxpt) external nonReentrant {
        require(shareAmount > 0, "zero withdraw");
        require(shares[msg.sender] >= shareAmount, "insufficient shares");

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        if (asCxpt) {
            cxpt.mint(msg.sender, shareAmount);
        } else {
            usdc.transfer(msg.sender, shareAmount);
        }
    }

    /* ------------------------------------------------------------ */
    /*                    Admin / rescue hooks                      */
    /* ------------------------------------------------------------ */

    function rescueTokens(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(token != address(usdc), "no USDC rescue");
        IERC20Upgradeable(token).transfer(to, amount);
    }
}