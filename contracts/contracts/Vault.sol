// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SynthERC20.sol";
import "./CXPTToken.sol";

/**
 * @title Vault Contract for CXMPUTE DEX
 * @notice Holds 100% USDC collateral, manages user shares, tracks collected fees,
 *         and facilitates synth/CXPT minting/burning via role-based access.
 * @dev Uses AccessControl for roles (ADMIN, CORE, GATEWAY).
 *      GATEWAY role handles deposits/withdrawals.
 *      CORE role (matcher) handles synth minting/burning and fee recording.
 *      ADMIN role handles fee withdrawals and synth registration.
 */
contract Vault is AccessControlEnumerable, ReentrancyGuard {

    // --- Roles ---
    bytes32 public constant CORE_ROLE    = keccak256("CORE_ROLE");
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");
    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");

    // --- State Variables ---
    IERC20 public immutable usdc;
    CXPTToken public immutable cxpt;

    mapping(address => uint256) public shares;      // user => shares (1:1 USDC)
    mapping(address => bool) public isSynth;        // synth address => registered?

    uint256 public collectedFees; // <<< NEW: Tracks accumulated USDC fees (in base units)

    // --- Events ---
    event Deposited(address indexed gateway, address indexed user, uint256 amount);
    event Withdrawn(address indexed gateway, address indexed user, uint256 amount, bool asCxpt);
    event SynthRegistered(address indexed admin, address indexed synth);
    event SynthMinted(address indexed core, address indexed synth, address indexed to, uint256 amount);
    event SynthBurned(address indexed core, address indexed synth, address indexed from, uint256 amount);
    event FeesRecorded(address indexed core, uint256 amount); // <<< NEW: Event for fee recording
    event FeesWithdrawn(address indexed admin, address indexed to, uint256 amount);

    // --- Errors ---
    error Vault__ZeroAddress();
    error Vault__ZeroAmount();
    error Vault__InsufficientBalance();
    error Vault__InsufficientFees(); // <<< NEW: Error for insufficient fees
    error Vault__TransferFailed(string reason);
    error Vault__UnknownSynth();
    error Vault__AlreadyRegistered();

    // --- Constructor ---
    constructor(
        address _usdc,
        address _cxpt,
        address _coreAddress,
        address _gatewayAddress
    ) {
        if (_usdc == address(0) || _cxpt == address(0) || _coreAddress == address(0) || _gatewayAddress == address(0)) {
            revert Vault__ZeroAddress();
        }
        usdc = IERC20(_usdc);
        cxpt = CXPTToken(_cxpt);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(CORE_ROLE, _coreAddress);
        _grantRole(GATEWAY_ROLE, _gatewayAddress);
    }

    // --- Admin Functions ---

    function registerSynth(address synth) external onlyRole(ADMIN_ROLE) {
        if (synth == address(0)) revert Vault__ZeroAddress();
        if (isSynth[synth]) revert Vault__AlreadyRegistered();
        isSynth[synth] = true;
        emit SynthRegistered(msg.sender, synth);
    }

    /**
     * @notice Admin function to withdraw accumulated protocol fees.
     * @dev Checks against the on-chain `collectedFees` balance.
     * @param to The address to receive the fees.
     * @param amt The amount of USDC fees (in base units) to withdraw.
     */
    function withdrawFees(address to, uint256 amt) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (to == address(0)) revert Vault__ZeroAddress();
        if (amt == 0) revert Vault__ZeroAmount();

        uint256 currentCollectedFees = collectedFees; // Gas optimization
        if (currentCollectedFees < amt) revert Vault__InsufficientFees(); // <<< CHECK collectedFees

        uint256 vaultUsdcBalance = usdc.balanceOf(address(this));
        if (vaultUsdcBalance < amt) revert Vault__InsufficientBalance(); // Still need vault balance check

        collectedFees = currentCollectedFees - amt; // <<< DECREMENT collectedFees

        bool success = usdc.transfer(to, amt);
        if (!success) {
            // Revert state change if transfer fails
            collectedFees = currentCollectedFees;
            revert Vault__TransferFailed("USDC fee transfer failed");
        }

        emit FeesWithdrawn(msg.sender, to, amt);
    }


    // --- Gateway Functions (Deposit/Withdraw) ---
    // (deposit and withdraw functions remain the same as previous revision)

    function deposit(address user, uint256 amt) external onlyRole(GATEWAY_ROLE) nonReentrant {
        if (user == address(0)) revert Vault__ZeroAddress();
        if (amt == 0) revert Vault__ZeroAmount();
        bool success = usdc.transferFrom(user, address(this), amt);
        if (!success) revert Vault__TransferFailed("USDC transferFrom failed");
        shares[user] += amt;
        emit Deposited(msg.sender, user, amt);
    }

    function withdraw(address user, uint256 amt, bool asCxpt) external onlyRole(GATEWAY_ROLE) nonReentrant {
        if (user == address(0)) revert Vault__ZeroAddress();
        if (amt == 0) revert Vault__ZeroAmount();
        uint256 userShares = shares[user]; // Gas optimization
        if (userShares < amt) revert Vault__InsufficientBalance();

        shares[user] = userShares - amt;

        if (asCxpt) {
            cxpt.mint(user, amt);
        } else {
            bool success = usdc.transfer(user, amt);
            if (!success) {
                shares[user] = userShares; // Revert share decrement
                revert Vault__TransferFailed("USDC transfer failed");
            }
        }
        emit Withdrawn(msg.sender, user, amt, asCxpt);
    }


    // --- Core (Matcher) Functions ---

    /**
     * @notice Called by the CORE (Matcher) to record fees collected from trades.
     * @param feeAmount The total fee amount (in USDC base units) generated in a match batch.
     */
    function recordFees(uint256 feeAmount) external onlyRole(CORE_ROLE) {
        // No nonReentrant needed unless complex logic added
        if (feeAmount == 0) revert Vault__ZeroAmount();

        collectedFees += feeAmount; // <<< INCREMENT collectedFees
        emit FeesRecorded(msg.sender, feeAmount); // msg.sender is core/matcher
    }

    // --- Synth Mint/Burn Functions (remain the same) ---

    function mintSynth(address synth, address to, uint256 amt) external onlyRole(CORE_ROLE) {
        if (!isSynth[synth]) revert Vault__UnknownSynth();
        if (to == address(0)) revert Vault__ZeroAddress();
        SynthERC20(synth).mint(to, amt);
        emit SynthMinted(msg.sender, synth, to, amt);
    }

    function burnSynth(address synth, address from, uint256 amt) external onlyRole(CORE_ROLE) {
        if (!isSynth[synth]) revert Vault__UnknownSynth();
        if (from == address(0)) revert Vault__ZeroAddress();
        SynthERC20(synth).burnFromVault(from, amt);
        emit SynthBurned(msg.sender, synth, from, amt);
    }

    // --- View Functions ---

    function getShares(address user) external view returns (uint256) {
        return shares[user];
    }

    function isRegisteredSynth(address synth) external view returns (bool) {
        return isSynth[synth];
    }

    /**
     * @notice Returns the current amount of collected fees available for withdrawal by admin.
     */
    function getCollectedFees() external view returns (uint256) { // <<< NEW View function
        return collectedFees;
    }
}