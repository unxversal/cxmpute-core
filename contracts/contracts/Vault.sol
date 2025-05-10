// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SynthERC20.sol"; // Assuming SynthERC20 has mint/burnFromVault controlled by MINTER_ROLE (Vault)
import "./CXPTToken.sol";   // Assuming CXPTToken has mint controlled by MINTER_ROLE (Vault)

/**
 * @title Vault Contract for CXMPUTE DEX (No User Shares Version)
 * @notice Holds 100% USDC collateral for the DEX. Manages synth minting/burning
 *         and CXPT token minting. Facilitates deposits and withdrawals via a GATEWAY_ROLE.
 *         Collected fees are tracked and withdrawable by ADMIN_ROLE.
 * @dev Uses AccessControl for roles (ADMIN, CORE, GATEWAY).
 *      GATEWAY_ROLE handles deposits/withdrawals of USDC and minting of CXPT.
 *      CORE_ROLE (matcher/CRONs) handles synth minting/burning and fee recording.
 *      ADMIN_ROLE handles fee withdrawals and synth registration.
 *      This version does NOT track per-user shares on-chain. Off-chain BalancesTable is the source of truth.
 */
contract Vault is AccessControlEnumerable, ReentrancyGuard {

    // --- Roles ---
    bytes32 public constant CORE_ROLE    = keccak256("CORE_ROLE");
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");
    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");

    // --- State Variables ---
    IERC20 public immutable usdc;
    CXPTToken public immutable cxpt;

    mapping(address => bool) public isSynth; // synth address => registered?
    uint256 public collectedFees;            // Tracks accumulated USDC fees (in base units)

    // --- Events ---
    // Emitted when USDC is deposited into the Vault for a user.
    // `gateway` is the msg.sender (GATEWAY_ROLE address).
    // `user` is the beneficiary of the deposit whose off-chain balance should be credited.
    event Deposited(address indexed gateway, address indexed user, uint256 amount);

    // Emitted when USDC or CXPT is withdrawn from the Vault for a user.
    // `gateway` is the msg.sender (GATEWAY_ROLE address).
    // `user` is the recipient of the withdrawal whose off-chain balance was debited.
    event Withdrawn(address indexed gateway, address indexed user, uint256 amount, bool asCxpt);

    event SynthRegistered(address indexed admin, address indexed synth);
    event SynthMinted(address indexed core, address indexed synth, address indexed to, uint256 amount);
    event SynthBurned(address indexed core, address indexed synth, address indexed from, uint256 amount);
    event FeesRecorded(address indexed core, uint256 amount);
    event FeesWithdrawn(address indexed admin, address indexed to, uint256 amount);
    // CXPTMinted event can be emitted by CXPTToken contract itself upon minting if designed that way.
    // If not, you can add: event CXPTMinted(address indexed gateway, address indexed to, uint256 amount);

    // --- Errors ---
    error Vault__ZeroAddress();
    error Vault__ZeroAmount();
    error Vault__InsufficientBalanceInVault(); // Changed from Vault__InsufficientBalance
    error Vault__InsufficientFees();
    error Vault__TransferFailed(string reason);
    error Vault__UnknownSynth();
    error Vault__AlreadyRegistered();

    // --- Constructor ---
    constructor(
        address _usdcAddress,
        address _cxptAddress,
        address _coreAddress,
        address _gatewayAddress
    ) {
        if (_usdcAddress == address(0) || _cxptAddress == address(0) || _coreAddress == address(0) || _gatewayAddress == address(0)) {
            revert Vault__ZeroAddress();
        }
        usdc = IERC20(_usdcAddress);
        cxpt = CXPTToken(_cxptAddress); // Assumes CXPTToken constructor grants MINTER_ROLE to this Vault if needed

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); // Deployer gets DEFAULT_ADMIN_ROLE
        _grantRole(ADMIN_ROLE, msg.sender);         // Deployer also gets ADMIN_ROLE initially
        _grantRole(CORE_ROLE, _coreAddress);
        _grantRole(GATEWAY_ROLE, _gatewayAddress);
    }

    // --- Admin Functions ---

    function registerSynth(address synthAddress) external onlyRole(ADMIN_ROLE) {
        if (synthAddress == address(0)) revert Vault__ZeroAddress();
        if (isSynth[synthAddress]) revert Vault__AlreadyRegistered();
        isSynth[synthAddress] = true;
        emit SynthRegistered(msg.sender, synthAddress);
    }

    function withdrawFees(address to, uint256 amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (to == address(0)) revert Vault__ZeroAddress();
        if (amount == 0) revert Vault__ZeroAmount();

        uint256 currentCollectedFees = collectedFees;
        if (currentCollectedFees < amount) revert Vault__InsufficientFees();

        // Check if the Vault physically has enough USDC (can differ from collectedFees if issues occur)
        if (usdc.balanceOf(address(this)) < amount) revert Vault__InsufficientBalanceInVault();

        collectedFees = currentCollectedFees - amount;

        bool success = usdc.transfer(to, amount);
        if (!success) {
            collectedFees = currentCollectedFees; // Revert state change
            revert Vault__TransferFailed("USDC fee transfer failed");
        }
        emit FeesWithdrawn(msg.sender, to, amount);
    }

    // --- Gateway Functions (Deposit/Withdraw) ---

    /**
     * @notice Called by the GATEWAY_ROLE to process a user's USDC deposit.
     * @dev The 'user' must have pre-approved the Vault contract (this address) OR the GATEWAY_ROLE address
     *      (if the gateway then transfers to Vault) to spend their USDC.
     *      This function pulls 'amount' of USDC from 'user' into this Vault.
     *      The off-chain system listens for the 'Deposited' event to update the user's balance
     *      in the `BalancesTable`.
     * @param user The end-user address for whom the deposit is made.
     * @param amount The amount of USDC to deposit, in base units.
     */
    function deposit(address user, uint256 amount) external onlyRole(GATEWAY_ROLE) nonReentrant {
        if (user == address(0)) revert Vault__ZeroAddress();
        if (amount == 0) revert Vault__ZeroAmount();

        // The GATEWAY_ROLE (msg.sender) is initiating this.
        // `user` must have approved this Vault contract to spend their USDC.
        // Or, if GATEWAY_ROLE holds user funds temporarily, then `user` must approve GATEWAY_ROLE,
        // and GATEWAY_ROLE must then transfer to Vault (requiring two approvals or a different flow).
        // Assuming user approves Vault directly for simplicity here:
        bool success = usdc.transferFrom(user, address(this), amount);
        if (!success) revert Vault__TransferFailed("USDC transferFrom failed during deposit");

        // No on-chain share accounting.
        emit Deposited(msg.sender, user, amount);
    }

    /**
     * @notice Called by the GATEWAY_ROLE to process a user's withdrawal.
     * @dev Off-chain systems must verify the user's balance in `BalancesTable` *before* calling this.
     *      This function transfers USDC from the Vault to the 'user' or mints CXPT to the 'user'.
     * @param user The end-user address receiving the withdrawal.
     * @param amount The amount to withdraw, in base units.
     * @param asCxpt If true, mints CXPT; otherwise, transfers USDC.
     */
    function withdraw(address user, uint256 amount, bool asCxpt) external onlyRole(GATEWAY_ROLE) nonReentrant {
        if (user == address(0)) revert Vault__ZeroAddress();
        if (amount == 0) revert Vault__ZeroAmount();

        // Off-chain system is responsible for checking if 'user' has sufficient balance.
        // This contract only checks if it has enough USDC to send (if not CXPT).

        if (asCxpt) {
            // Vault needs MINTER_ROLE on CXPTToken contract
            cxpt.mint(user, amount);
            // Consider emitting CXPTMinted event here if CXPTToken doesn't do it.
        } else {
            if (usdc.balanceOf(address(this)) < amount) revert Vault__InsufficientBalanceInVault();
            bool success = usdc.transfer(user, amount);
            if (!success) revert Vault__TransferFailed("USDC transfer failed during withdrawal");
        }

        // No on-chain share accounting.
        emit Withdrawn(msg.sender, user, amount, asCxpt);
    }

    // --- Core (Matcher/CRONs) Functions ---

    function recordFees(uint256 feeAmount) external onlyRole(CORE_ROLE) {
        if (feeAmount == 0) revert Vault__ZeroAmount();
        collectedFees += feeAmount;
        emit FeesRecorded(msg.sender, feeAmount);
    }

    function mintSynth(address synthAddress, address to, uint256 amount) external onlyRole(CORE_ROLE) {
        if (!isSynth[synthAddress]) revert Vault__UnknownSynth();
        if (to == address(0)) revert Vault__ZeroAddress();
        if (amount == 0) revert Vault__ZeroAmount(); // Added zero amount check for synth ops
        SynthERC20(synthAddress).mint(to, amount); // Assumes SynthERC20.mint is onlyRole(VAULT_MINTER_ROLE)
        emit SynthMinted(msg.sender, synthAddress, to, amount);
    }

    function burnSynth(address synthAddress, address from, uint256 amount) external onlyRole(CORE_ROLE) {
        if (!isSynth[synthAddress]) revert Vault__UnknownSynth();
        if (from == address(0)) revert Vault__ZeroAddress();
        if (amount == 0) revert Vault__ZeroAmount(); // Added zero amount check
        // Assumes SynthERC20.burnFromVault requires msg.sender to be Vault (MINTER_ROLE)
        // and that SynthERC20 has approved Vault or Vault uses transferFrom if user approved synth.
        // More commonly, burnFrom(from, amount) is called where SynthERC20 gives Vault allowance.
        // Let's assume SynthERC20 has `burnFromVault(address account, uint256 value)` that only Vault can call.
        SynthERC20(synthAddress).burnFromVault(from, amount);
        emit SynthBurned(msg.sender, synthAddress, from, amount);
    }

    // --- View Functions ---

    function isRegisteredSynth(address synthAddress) external view returns (bool) {
        return isSynth[synthAddress];
    }

    function getCollectedFees() external view returns (uint256) {
        return collectedFees;
    }

    // Function to check total USDC held by the Vault (for reconciliation)
    function totalUsdcBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}