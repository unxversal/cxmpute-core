// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./SynthERC20.sol";
import "./CXPTToken.sol";

/**
 * Holds 100 % USDC collateral.
 *  – tracks user shares internally 1 : 1 with USDC for simplicity
 *  – can mint / burn Synths on behalf of the off‑chain matcher
 *  – can mint CXPT on withdrawal (governance / fee‑rebate token)
 */
contract Vault is AccessControl, ReentrancyGuard {
    /* ─── config ───────────────────────────────────────────── */
    bytes32 public constant CORE_ROLE   = keccak256("CORE_ROLE"); // SST matcher
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");

    IERC20  public immutable usdc;
    CXPTToken public immutable cxpt;

    /* user ⇒ shares (1 share = 1 USDC) */
    mapping(address => uint256) public shares;

    /* whitelist of valid Synth tokens */
    mapping(address => bool) public isSynth;

    /* ─── events off‑chain core will listen to ─────────────── */
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, bool asCxpt);
    event SynthMinted(address indexed synth, address indexed to, uint256 amount);
    event SynthBurned(address indexed synth, address indexed from, uint256 amount);

    constructor(
        address _usdc,
        address _cxpt,
        address core
    ) {
        usdc = IERC20(_usdc);
        cxpt = CXPTToken(_cxpt);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(CORE_ROLE, core);               // Lambda‑signing key
    }

    /* ADMIN registers each new Synth once – called from SynthFactory */
    function registerSynth(address synth) external onlyRole(ADMIN_ROLE) {
        isSynth[synth] = true;
    }

    /* ───────────────────────────────────────────────────────── */

    function deposit(uint256 amt) external nonReentrant {
        require(amt > 0, "zero");
        require(
            usdc.transferFrom(msg.sender, address(this), amt),
            "transferFrom failed"
        );
        shares[msg.sender] += amt;

        emit Deposited(msg.sender, amt);
    }

    /**
     * asCxpt = false  → transfer out USDC  
     * asCxpt = true   → *keep* USDC inside vault and mint CXPT 1 : 1
     */
    function withdraw(uint256 amt, bool asCxpt) external nonReentrant {
        require(amt > 0 && shares[msg.sender] >= amt, "balance");
        shares[msg.sender] -= amt;

        if (asCxpt) {
            cxpt.mint(msg.sender, amt);
        } else {
            require(usdc.transfer(msg.sender, amt), "USDC transfer failed");
        }

        emit Withdrawn(msg.sender, amt, asCxpt);
    }

    /* ─── called per‑trade by the matcher Lambda (CORE_ROLE) ── */

    function mintSynth(
        address synth,
        address to,
        uint256 amt
    ) external onlyRole(CORE_ROLE) {
        require(isSynth[synth], "unknown synth");
        SynthERC20(synth).mint(to, amt);
        emit SynthMinted(synth, to, amt);
    }

    function burnSynth(
        address synth,
        address from,
        uint256 amt
    ) external onlyRole(CORE_ROLE) {
        require(isSynth[synth], "unknown synth");
        SynthERC20(synth).burnFromVault(from, amt);
        emit SynthBurned(synth, from, amt);
    }

    function withdrawFees(address to, uint256 amt) external onlyRole(ADMIN_ROLE) {
        require(usdc.balanceOf(address(this)) >= amt, "insufficient");
        require(usdc.transfer(to, amt), "transfer failed");
    }

}