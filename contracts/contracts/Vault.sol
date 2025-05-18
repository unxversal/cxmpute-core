// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./CXPTToken.sol"; // Your CXPTToken contract
// Assuming SynthERC20.sol defines a contract that implements ISynthERC20
// You might need to adjust path or define ISynthERC20 if SynthERC20.sol is complex
import "./SynthERC20.sol"; // Placeholder: ensure this path is correct or define ISynthERC20

interface ISynthERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    // Add burn(uint256 amount) external; if synths can be burned by the contract itself (e.g., if Vault holds them)
}

contract Vault is AccessControlEnumerable {
    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable usdcToken;
    CXPTToken public immutable cxptToken;

    mapping(address => bool) public isRegisteredSynth; // synthContractAddress => is official
    uint256 public totalFeesCollectedUSDC; // Fees collected in USDC base units

    // --- Events ---
    event DepositedUSDC(address indexed coreAddress, address indexed userWallet, uint256 usdcAmount);
    event WithdrawnUSDC(address indexed coreAddress, address indexed userWallet, uint256 usdcAmount);
    event WithdrawnCXPT(address indexed coreAddress, address indexed userWallet, uint256 cxptAmount);
    event SynthRegistered(address indexed registrar, address indexed synthContract);
    event FeesRecorded(address indexed coreAddress, uint256 usdcFeeAmount);
    event FeesWithdrawn(address indexed admin, address indexed to, uint256 usdcAmount);

    event SynthDepositedToVault(address indexed userWallet, address indexed synthContract, uint256 sAssetAmount);
    event SynthWithdrawnFromVault(address indexed coreAddress, address indexed userWallet, address indexed synthContract, uint256 sAssetAmount);
    
    event USDCToSAssetExchanged(
        address indexed coreAddress,
        address indexed userWallet,
        address indexed sAssetContract,
        uint256 usdcAmountSpent,
        uint256 sAssetAmountMinted
    );
    event SAssetToUSDCExchanged(
        address indexed coreAddress,
        address indexed userWallet,
        address indexed sAssetContract,
        uint256 sAssetAmountBurned,
        uint256 usdcAmountReceived
    );

    constructor(
        address _usdcAddress,
        address _cxptTokenAddress,
        address _coreAddress,
        address _gatewayAddress 
    ) {
        require(_usdcAddress != address(0), "Vault: Invalid USDC address");
        require(_cxptTokenAddress != address(0), "Vault: Invalid CXPT address");
        require(_coreAddress != address(0), "Vault: Invalid Core address");
        require(_gatewayAddress != address(0), "Vault: Invalid Gateway address");

        usdcToken = IERC20(_usdcAddress);
        cxptToken = CXPTToken(_cxptTokenAddress); // Assumes CXPTToken type is available

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(CORE_ROLE, _coreAddress);
        _grantRole(GATEWAY_ROLE, _gatewayAddress);
    }

    // --- USDC Operations (Called by CORE_ROLE backend) ---
    function depositUSDC(address userWallet, uint256 usdcAmount) external onlyRole(CORE_ROLE) {
        require(userWallet != address(0), "Vault: Invalid user wallet");
        require(usdcAmount > 0, "Vault: Amount must be positive");
        // User must have approved this Vault contract to spend 'usdcAmount' of their USDC
        require(usdcToken.transferFrom(userWallet, address(this), usdcAmount), "Vault: USDC transferFrom failed");
        emit DepositedUSDC(msg.sender, userWallet, usdcAmount);
    }

    // --- Combined Withdraw (USDC or CXPT) (Called by CORE_ROLE backend) ---
    function withdraw(address userWallet, uint256 amount, bool withdrawAsCxpt) external onlyRole(CORE_ROLE) {
        require(userWallet != address(0), "Vault: Invalid user wallet");
        require(amount > 0, "Vault: Amount must be positive");
        // Backend ensures user has sufficient internal balance before calling this

        if (withdrawAsCxpt) {
            // Vault contract must have MINTER_ROLE on CXPTToken contract
            cxptToken.mint(userWallet, amount); // Assumes CXPTToken has appropriate mint permissions
            emit WithdrawnCXPT(msg.sender, userWallet, amount);
        } else { // Withdraw as USDC
            require(usdcToken.balanceOf(address(this)) >= amount, "Vault: Insufficient USDC in Vault");
            usdcToken.transfer(userWallet, amount);
            emit WithdrawnUSDC(msg.sender, userWallet, amount);
        }
    }

    // --- sASSET Deposit & Withdrawal (Called by CORE_ROLE backend) ---
    // User wants to deposit their sASSET ERC20 tokens (e.g. sBTC) into the Vault for internal DEX trading
    function depositSynthToVault(address userWallet, address synthContract, uint256 sAssetAmount) external onlyRole(CORE_ROLE) {
        require(userWallet != address(0), "Vault: Invalid user wallet");
        require(isRegisteredSynth[synthContract], "Vault: Synth not registered");
        require(sAssetAmount > 0, "Vault: Amount must be positive");
        // User (userWallet) must have approved this Vault contract to spend 'sAssetAmount' of their synthContract tokens
        require(ISynthERC20(synthContract).transferFrom(userWallet, address(this), sAssetAmount), "Vault: sASSET transferFrom failed");
        emit SynthDepositedToVault(userWallet, synthContract, sAssetAmount);
    }

    // User wants to withdraw their internal sASSET balance as ERC20 tokens to their wallet
    function withdrawSynthFromVault(address userWallet, address synthContract, uint256 sAssetAmount) external onlyRole(CORE_ROLE) {
        require(userWallet != address(0), "Vault: Invalid user wallet");
        require(isRegisteredSynth[synthContract], "Vault: Synth not registered");
        require(sAssetAmount > 0, "Vault: Amount must be positive");
        require(ISynthERC20(synthContract).balanceOf(address(this)) >= sAssetAmount, "Vault: Insufficient sASSET in Vault");
        
        ISynthERC20(synthContract).transfer(userWallet, sAssetAmount);
        emit SynthWithdrawnFromVault(msg.sender, userWallet, synthContract, sAssetAmount);
    }

    // --- sASSET On-Chain Exchange with USDC (Called by CORE_ROLE backend) ---
    // User spends USDC from their external wallet to receive newly minted sASSETs in their external wallet
    function exchangeUSDCToSAsset(
        address userWallet,         // User EOA spending USDC and receiving sASSET
        address sAssetContract,     // The specific sASSET (e.g., sBTC) contract address
        uint256 usdcAmountToSpend,  // Amount of USDC user will spend (in USDC base units)
        uint256 sAssetAmountToMint  // Amount of sASSET to mint (in sASSET base units) - calculated by backend
    ) external onlyRole(CORE_ROLE) {
        require(userWallet != address(0), "Vault: Invalid user wallet");
        require(isRegisteredSynth[sAssetContract], "Vault: Synth not registered");
        require(usdcAmountToSpend > 0, "Vault: USDC amount must be positive");
        require(sAssetAmountToMint > 0, "Vault: sASSET amount must be positive");

        // 1. Vault pulls USDC from user (user must have approved Vault)
        require(usdcToken.transferFrom(userWallet, address(this), usdcAmountToSpend), "Vault: USDC transferFrom for exchange failed");
        
        // 2. Vault mints sASSET directly to user's wallet
        //    This Vault contract needs MINTER_ROLE on the sAssetContract (SynthERC20)
        ISynthERC20(sAssetContract).mint(userWallet, sAssetAmountToMint);

        emit USDCToSAssetExchanged(msg.sender, userWallet, sAssetContract, usdcAmountToSpend, sAssetAmountToMint);
    }

    // User spends sASSETs from their external wallet (burning them) to receive USDC in their external wallet
    function exchangeSAssetToUSDC(
        address userWallet,         // User EOA spending sASSET and receiving USDC
        address sAssetContract,     // The specific sASSET (e.g., sBTC) contract address
        uint256 sAssetAmountToSpend,// Amount of sASSET user will spend (in sASSET base units)
        uint256 usdcAmountToCredit  // Amount of USDC to credit to user (in USDC base units) - calculated by backend
    ) external onlyRole(CORE_ROLE) {
        require(userWallet != address(0), "Vault: Invalid user wallet");
        require(isRegisteredSynth[sAssetContract], "Vault: Synth not registered");
        require(sAssetAmountToSpend > 0, "Vault: sASSET amount must be positive");
        require(usdcAmountToCredit > 0, "Vault: USDC amount must be positive");

        // 1. Vault burns sASSET from user's wallet (user must have approved Vault for sAssetContract)
        //    The SynthERC20 contract needs a burnFrom method that Vault can call.
        ISynthERC20(sAssetContract).burnFrom(userWallet, sAssetAmountToSpend);
        
        // 2. Vault transfers USDC to user's wallet
        require(usdcToken.balanceOf(address(this)) >= usdcAmountToCredit, "Vault: Insufficient USDC in Vault for exchange");
        usdcToken.transfer(userWallet, usdcAmountToCredit);

        emit SAssetToUSDCExchanged(msg.sender, userWallet, sAssetContract, sAssetAmountToSpend, usdcAmountToCredit);
    }

    // --- Admin & Gateway Functions ---
    function registerSynth(address synthContract) external onlyRole(GATEWAY_ROLE) {
        require(synthContract != address(0), "Vault: Zero address for synth");
        isRegisteredSynth[synthContract] = true;
        emit SynthRegistered(msg.sender, synthContract);
    }

    function recordFees(uint256 usdcFeeAmount) external onlyRole(CORE_ROLE) {
        // Called by match engine (backend)
        totalFeesCollectedUSDC += usdcFeeAmount;
        emit FeesRecorded(msg.sender, usdcFeeAmount);
    }

    function withdrawFees(address to, uint256 usdcAmount) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "Vault: Fee recipient cannot be zero address");
        require(totalFeesCollectedUSDC >= usdcAmount, "Vault: Insufficient collected fees");
        require(usdcToken.balanceOf(address(this)) >= usdcAmount, "Vault: Insufficient USDC balance in Vault for fee withdrawal");
        
        totalFeesCollectedUSDC -= usdcAmount;
        usdcToken.transfer(to, usdcAmount);
        emit FeesWithdrawn(msg.sender, to, usdcAmount);
    }

    // --- View Functions ---
    function getUSDCTokenAddress() external view returns (address) {
        return address(usdcToken);
    }

    function getCXPTTokenAddress() external view returns (address) {
        return address(cxptToken);
    }
}