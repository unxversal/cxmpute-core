// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol"; // Use Enumerable for easier role management if needed
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // Use IERC20 interface
import "./SynthERC20.sol";
import "./CXPTToken.sol";

/**
 * @title Vault Contract for CXMPUTE DEX
 * @notice Holds 100% USDC collateral, manages user shares (representing USDC balances),
 *         and facilitates synth/CXPT minting/burning via role-based access.
 * @dev Uses AccessControl for managing roles (ADMIN, CORE, GATEWAY).
 *      Only the GATEWAY address can initiate deposits/withdrawals on behalf of users.
 *      CORE role (off-chain matcher) handles synth minting/burning.
 *      ADMIN role handles fee withdrawals and synth registration.
 *      Internal 'shares' mapping tracks user balances mirrored from off-chain system.
 */
contract Vault is AccessControlEnumerable, ReentrancyGuard {

    // --- Roles ---
    bytes32 public constant CORE_ROLE    = keccak256("CORE_ROLE");   // Off-chain Matcher Lambda role
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");  // Protocol Admin role
    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");// Backend API Signer role for deposits/withdrawals

    // --- State Variables ---
    IERC20 public immutable usdc;        // Address of the USDC token contract
    CXPTToken public immutable cxpt;     // Address of the CXPT token contract

    // Mapping: user address => shares (1 share = 1 base unit of USDC)
    mapping(address => uint256) public shares;

    // Mapping: synth token address => boolean (whitelist of valid synthetic tokens)
    mapping(address => bool) public isSynth;

    // --- Events ---
    event Deposited(address indexed gateway, address indexed user, uint256 amount);
    event Withdrawn(address indexed gateway, address indexed user, uint256 amount, bool asCxpt);
    event SynthRegistered(address indexed admin, address indexed synth);
    event SynthMinted(address indexed core, address indexed synth, address indexed to, uint256 amount);
    event SynthBurned(address indexed core, address indexed synth, address indexed from, uint256 amount);
    event FeesWithdrawn(address indexed admin, address indexed to, uint256 amount);

    // --- Errors ---
    error Vault__ZeroAmount();
    error Vault__InsufficientBalance();
    error Vault__TransferFailed(string reason);
    error Vault__UnknownSynth();
    error Vault__AlreadyRegistered(); // Optional: For registerSynth

    // --- Constructor ---
    constructor(
        address _usdc,          // Address of USDC contract
        address _cxpt,          // Address of deployed CXPTToken contract
        address _coreAddress,   // Address of the Matcher (CORE_ROLE holder)
        address _gatewayAddress // Address of the Backend API Signer (GATEWAY_ROLE holder)
    ) {
        if (_usdc == address(0) || _cxpt == address(0) || _coreAddress == address(0) || _gatewayAddress == address(0)) {
            revert("Vault__ZeroAddress"); // Use specific error if defined elsewhere or keep generic
        }
        usdc = IERC20(_usdc);
        cxpt = CXPTToken(_cxpt);

        // Grant roles
        // Deployer gets DEFAULT_ADMIN_ROLE by default with AccessControl
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender); // Grant ADMIN_ROLE to deployer initially
        _grantRole(CORE_ROLE, _coreAddress);
        _grantRole(GATEWAY_ROLE, _gatewayAddress);

        // Set role admin hierarchy (optional but good practice)
        // _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        // _setRoleAdmin(CORE_ROLE, ADMIN_ROLE); // Or DEFAULT_ADMIN_ROLE
        // _setRoleAdmin(GATEWAY_ROLE, ADMIN_ROLE); // Or DEFAULT_ADMIN_ROLE
    }

    // --- Admin Functions ---

    /**
     * @notice Admin function to whitelist a new synthetic token contract.
     * @param synth The address of the SynthERC20 contract to register.
     */
    function registerSynth(address synth) external onlyRole(ADMIN_ROLE) {
        if (synth == address(0)) revert("Vault__ZeroAddress");
        if (isSynth[synth]) revert Vault__AlreadyRegistered(); // Prevent re-registration

        isSynth[synth] = true;
        emit SynthRegistered(msg.sender, synth);
    }

    /**
     * @notice Admin function to withdraw accumulated protocol fees.
     * @param to The address to receive the fees.
     * @param amt The amount of USDC fees to withdraw.
     */
    function withdrawFees(address to, uint256 amt) external onlyRole(ADMIN_ROLE) nonReentrant {
         if (to == address(0)) revert("Vault__ZeroAddress");
         if (amt == 0) revert Vault__ZeroAmount();

        uint256 balance = usdc.balanceOf(address(this));
        // Note: This doesn't track fees explicitly, relies on admin knowing the fee amount.
        // A more robust system might track collectible fees separately.
        if (balance < amt) revert Vault__InsufficientBalance();

        bool success = usdc.transfer(to, amt);
        if (!success) revert Vault__TransferFailed("USDC fee transfer failed");

        emit FeesWithdrawn(msg.sender, to, amt);
    }


    // --- Gateway Functions (Deposit/Withdraw) ---

    /**
     * @notice Called by the GATEWAY to deposit USDC *on behalf of* a user.
     * @dev Requires the user to have *previously approved* this Vault contract
     *      to spend their USDC via the USDC contract's `approve` function.
     * @param user The end-user address for whom the deposit is being made.
     * @param amt The amount of USDC (in base units) to deposit.
     */
    function deposit(address user, uint256 amt) external onlyRole(GATEWAY_ROLE) nonReentrant {
        if (user == address(0)) revert("Vault__ZeroAddress");
        if (amt == 0) revert Vault__ZeroAmount();

        // Pull approved USDC from the user's wallet to this Vault
        bool success = usdc.transferFrom(user, address(this), amt);
        if (!success) revert Vault__TransferFailed("USDC transferFrom failed");

        // Update internal shares balance for the user
        shares[user] += amt;

        emit Deposited(msg.sender, user, amt); // msg.sender is the gateway
    }

    /**
     * @notice Called by the GATEWAY to withdraw funds *on behalf of* a user.
     * @param user The end-user address for whom the withdrawal is being made.
     * @param amt The amount of shares (USDC base units) to withdraw.
     * @param asCxpt If true, mints CXPT to the user instead of sending USDC.
     */
    function withdraw(address user, uint256 amt, bool asCxpt) external onlyRole(GATEWAY_ROLE) nonReentrant {
        if (user == address(0)) revert("Vault__ZeroAddress");
        if (amt == 0) revert Vault__ZeroAmount();
        if (shares[user] < amt) revert Vault__InsufficientBalance();

        // Decrease user's shares first
        shares[user] -= amt;

        // Perform the withdrawal action
        if (asCxpt) {
            // Mint CXPT tokens 1:1 to the user
            cxpt.mint(user, amt);
        } else {
            // Transfer USDC from the Vault to the user
            bool success = usdc.transfer(user, amt);
            if (!success) {
                // Revert state change if transfer fails
                shares[user] += amt;
                revert Vault__TransferFailed("USDC transfer failed");
            }
        }

        emit Withdrawn(msg.sender, user, amt, asCxpt); // msg.sender is the gateway
    }


    // --- Core (Matcher) Functions (Synth Mint/Burn) ---
    // These remain unchanged, callable only by the CORE_ROLE (Matcher Lambda)

    /**
     * @notice Called by the CORE (Matcher) to mint synthetic tokens to a user.
     * @param synth The address of the SynthERC20 token contract.
     * @param to The address receiving the synthetic tokens.
     * @param amt The amount of synthetic tokens to mint.
     */
    function mintSynth(
        address synth,
        address to,
        uint256 amt
    ) external onlyRole(CORE_ROLE) {
        // Non-reentrant modifier might be overkill here unless synths have complex callbacks
        if (!isSynth[synth]) revert Vault__UnknownSynth();
        if (to == address(0)) revert("Vault__ZeroAddress");
        // Amount check might be implicit in _mint, but good practice if needed:
        // if (amt == 0) revert Vault__ZeroAmount();

        SynthERC20(synth).mint(to, amt);
        emit SynthMinted(msg.sender, synth, to, amt); // msg.sender is the core/matcher
    }

    /**
     * @notice Called by the CORE (Matcher) to burn synthetic tokens from a user.
     * @param synth The address of the SynthERC20 token contract.
     * @param from The address whose synthetic tokens are being burned.
     * @param amt The amount of synthetic tokens to burn.
     */
    function burnSynth(
        address synth,
        address from,
        uint256 amt
    ) external onlyRole(CORE_ROLE) {
        // Non-reentrant modifier might be overkill here
        if (!isSynth[synth]) revert Vault__UnknownSynth();
         if (from == address(0)) revert("Vault__ZeroAddress");
        // if (amt == 0) revert Vault__ZeroAmount();

        // Note: Assumes SynthERC20 handles insufficient balance checks internally during _burn
        SynthERC20(synth).burnFromVault(from, amt);
        emit SynthBurned(msg.sender, synth, from, amt); // msg.sender is the core/matcher
    }

     // --- View Functions ---

    /**
     * @notice Returns the number of shares (USDC balance) held by a user within the Vault.
     * @param user The address of the user.
     * @return The amount of shares.
     */
    function getShares(address user) external view returns (uint256) {
        return shares[user];
    }

    /**
     * @notice Checks if a given address corresponds to a registered synthetic token.
     * @param synth The address to check.
     * @return True if the address is a registered synth, false otherwise.
     */
    function isRegisteredSynth(address synth) external view returns (bool) {
        return isSynth[synth];
    }
}