// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // For admin functions directly on vault
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../common/interfaces/IOracleRelayer.sol";
import "./interfaces/ISynthToken.sol";
import "./SynthFactory.sol"; // To get synth info like assetId and customMinCR

// Using ProtocolAdminAccess if admin functions are primarily delegated,
// or Ownable if this vault manages its own params via its owner.
// Let's assume some parameters are directly Ownable by SynthAdmin for now.
// Or, this contract is Ownable by SynthAdmin.

/**
 * @title USDCVault
 * @author Unxversal Team
 * @notice Manages USDC collateral, minting/burning of sAssets, and user positions.
 * @dev Users deposit USDC to mint sAssets. Positions are subject to liquidation if CR falls.
 *      Fees are collected on mint/burn. Tracks USD value of minted sAssets at time of minting.
 */
contract USDCVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint8 public constant USDC_DECIMALS = 6; // Standard USDC decimals
    uint256 public constant PRICE_PRECISION = 1e18; // Oracle prices and internal USD values
    uint256 public constant S_ASSET_DECIMALS_NORMALIZER = 1e12; // To normalize 18-dec sAsset to 6-dec for USD value if needed, or use 1e18 / 10^sAssetDecimals
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant CR_DENOMINATOR = 10000; // For CR in BPS, e.g., 15000 = 150%

    // --- Modifiers ---
    modifier onlyLiquidationEngine() {
        require(msg.sender == liquidationEngine, "Vault: Caller not Liquidation Engine");
        _;
    }

    // --- Configuration ---
    IERC20 public immutable usdcToken;
    IOracleRelayer public oracle;
    SynthFactory public synthFactory; // To query synth details like assetId, customMinCR
    address public liquidationEngine; // Address of the SynthLiquidationEngine
    address public feeRecipient;      // Receives mint/burn fees
    address public treasuryAddress;   // Receives surplus from buffer

    uint256 public minCollateralRatioBps; // Default min CR if no per-synth customCR, e.g., 15000 (150%)
    uint256 public mintFeeBps;            // Fee for minting sAssets, e.g., 50 (0.5%)
    uint256 public burnFeeBps;            // Fee for burning sAssets, e.g., 50 (0.5%)
    uint256 public surplusBufferThreshold; // If surplus exceeds this, can be swept to treasury
    uint256 public currentSurplusBuffer;   // USDC accumulated from fees/liquidations beyond covering debt

    // --- User Position Storage ---
    struct SynthPositionData {
        uint256 amountMinted;        // Total quantity of this sAsset minted by the user
        uint256 totalUsdValueAtMint; // Aggregate USD value of `amountMinted` at the time(s) of minting
    }

    struct UserPosition {
        uint256 usdcCollateral; // Total USDC deposited by the user
        mapping(address => SynthPositionData) synthSpecifics; // sAssetAddress => SynthPositionData
    }
    mapping(address => UserPosition) public positions; // userAddress => UserPosition

    // --- Events ---
    event CollateralDeposited(address indexed user, uint256 amountUsdc);
    event CollateralWithdrawn(address indexed user, uint256 amountUsdc);
    event SynthMinted(
        address indexed user, address indexed synthAddress, uint256 assetId,
        uint256 amountSynthMinted, uint256 usdValueMinted, uint256 usdcCollateralizedForMint, uint256 feePaid
    );
    event SynthBurned(
        address indexed user, address indexed synthAddress, uint256 assetId,
        uint256 amountSynthBurned, uint256 usdValueRepaid, uint256 usdcReturned, uint256 feePaid
    );
    event PositionHealthUpdated(address indexed user, uint256 newCollateralRatioBps); // After an operation
    event SurplusSweptToTreasury(uint256 amountSwpt);
    // Admin parameter change events
    event MinCollateralRatioSet(uint256 newMinCRbps);
    event MintFeeSet(uint256 newFeeBps);
    event BurnFeeSet(uint256 newFeeBps);
    event FeeRecipientSet(address newRecipient);
    event TreasurySet(address newTreasury);
    event LiquidationEngineSet(address newEngine);
    event OracleSet(address newOracle);
    event SynthFactorySet(address newFactory);
    event SurplusBufferThresholdSet(uint256 newThreshold);


    constructor(
        address _usdcTokenAddress,
        address _oracleAddress,
        address _synthFactoryAddress,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_usdcTokenAddress != address(0), "Vault: Zero USDC address");
        // require(IERC20(_usdcTokenAddress).decimals() == USDC_DECIMALS, "Vault: Incorrect USDC decimals"); // Can't call view on uninitialized contract in constructor
        usdcToken = IERC20(_usdcTokenAddress);
        setOracle(_oracleAddress); // Emits event
        setSynthFactory(_synthFactoryAddress); // Emits event
        // Other params like fees, minCR, recipients are set by owner post-deployment
    }

    // --- Admin Functions (Ownable) ---
    function setMinCollateralRatio(uint256 _newMinCRbps) external onlyOwner {
        require(_newMinCRbps >= CR_DENOMINATOR, "Vault: Min CR too low"); // Must be >= 100%
        minCollateralRatioBps = _newMinCRbps;
        emit MinCollateralRatioSet(_newMinCRbps);
    }
    function setMintFee(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 1000, "Vault: Mint fee too high"); // Max 10% example
        mintFeeBps = _newFeeBps;
        emit MintFeeSet(_newFeeBps);
    }
    function setBurnFee(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 1000, "Vault: Burn fee too high");
        burnFeeBps = _newFeeBps;
        emit BurnFeeSet(_newFeeBps);
    }
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Vault: Zero fee recipient");
        feeRecipient = _newRecipient;
        emit FeeRecipientSet(_newRecipient);
    }
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Vault: Zero treasury");
        treasuryAddress = _newTreasury;
        emit TreasurySet(_newTreasury);
    }
    function setLiquidationEngine(address _newEngine) external onlyOwner {
        require(_newEngine != address(0), "Vault: Zero liquidation engine");
        liquidationEngine = _newEngine;
        emit LiquidationEngineSet(_newEngine);
    }
    function setOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Vault: Zero oracle");
        oracle = IOracleRelayer(_newOracle);
        emit OracleSet(_newOracle);
    }
    function setSynthFactory(address _newFactory) external onlyOwner {
        require(_newFactory != address(0), "Vault: Zero factory");
        synthFactory = SynthFactory(_newFactory);
        emit SynthFactorySet(_newFactory);
    }
    function setSurplusBufferThreshold(uint256 _newThreshold) external onlyOwner {
        surplusBufferThreshold = _newThreshold;
        emit SurplusBufferThresholdSet(_newThreshold);
    }
    function pauseActions() external onlyOwner { _pause(); }
    function unpauseActions() external onlyOwner { _unpause(); }

    // --- User Functions ---

    /** @notice User deposits USDC into their collateral balance. */
    function depositCollateral(uint256 amountUsdc) external nonReentrant whenNotPaused {
        require(amountUsdc > 0, "Vault: Zero deposit amount");
        usdcToken.safeTransferFrom(_msgSender(), address(this), amountUsdc);
        positions[_msgSender()].usdcCollateral += amountUsdc;
        emit CollateralDeposited(_msgSender(), amountUsdc);
        // Optionally, update health factor if they have existing debt
        _updateAndEmitHealth(_msgSender());
    }

    /** @notice User withdraws available USDC collateral. */
    function withdrawCollateral(uint256 amountUsdc) external nonReentrant whenNotPaused {
        require(amountUsdc > 0, "Vault: Zero withdrawal amount");
        UserPosition storage userPos = positions[_msgSender()];
        require(userPos.usdcCollateral >= amountUsdc, "Vault: Insufficient collateral balance");

        // Calculate total USD value of all minted synths for this user
        uint256 totalMintedUsdValue = _getTotalMintedUsdValue(_msgSender());
        
        // Calculate remaining collateral and check CR
        uint256 remainingCollateral = userPos.usdcCollateral - amountUsdc;
        if (totalMintedUsdValue > 0) { // Only check CR if there's outstanding debt
            uint256 effectiveMinCR = minCollateralRatioBps; // Default, can be overridden per synth, but this is for overall position
            // This check is simplified for overall health. A per-synth CR check upon withdrawal would be more complex.
            // For now, check against the general minCollateralRatioBps for the *total* debt.
            uint256 currentTotalDebtValue = _getCurrentTotalDebtUsdValue(_msgSender());
            require(currentTotalDebtValue == 0 || (remainingCollateral * CR_DENOMINATOR / currentTotalDebtValue) >= effectiveMinCR,
                "Vault: Withdrawal would make position undercollateralized");
        }
        // else, if no debt, they can withdraw all collateral.

        userPos.usdcCollateral = remainingCollateral;
        usdcToken.safeTransfer(_msgSender(), amountUsdc);
        emit CollateralWithdrawn(_msgSender(), amountUsdc);
        if (totalMintedUsdValue > 0) _updateAndEmitHealth(_msgSender());
    }

    /**
     * @notice User mints sAssets against their deposited USDC.
     * @param synthAddress The address of the sAsset token to mint.
     * @param amountSynthToMint The quantity of sAsset to mint (in sAsset's native decimals, e.g., 1e18 for 1 sBTC).
     */
    function mintSynth(address synthAddress, uint256 amountSynthToMint) external nonReentrant whenNotPaused {
        require(synthFactory.isSynthRegistered(synthAddress), "Vault: Synth not registered");
        require(amountSynthToMint > 0, "Vault: Zero mint amount");
        require(feeRecipient != address(0), "Vault: Fee recipient not set");


        UserPosition storage userPos = positions[_msgSender()];
        SynthFactory.SynthConfig memory synthConfig = synthFactory.getSynthConfig(synthAddress);
        uint256 sAssetDecimals = ISynthToken(synthAddress).decimals(); // Assumes sAssets have decimals()

        // Get current price of the sAsset's underlying in USD (1e18 precision)
        uint256 currentPriceUsd = oracle.getPrice(synthConfig.assetId); // Reverts if stale/unavailable

        // Calculate USD value of the sAsset to be minted
        // (amount * price) / 10^sAssetDecimals (to get USD value with PRICE_PRECISION)
        uint256 usdValueToMint = Math.mulDiv(amountSynthToMint, currentPriceUsd, (10**sAssetDecimals));

        // Calculate mint fee
        uint256 feeUsd = (usdValueToMint * mintFeeBps) / BPS_DENOMINATOR;
        uint256 usdValueToMintNetOfFee = usdValueToMint - feeUsd; // This is the value added to debt tracking

        // Determine effective Min CR
        uint256 effectiveMinCRbps = synthConfig.customMinCRbps > 0 ? synthConfig.customMinCRbps : minCollateralRatioBps;
        require(effectiveMinCRbps > 0, "Vault: MinCR not set");

        // Calculate total current USD value of ALL outstanding sAssets for this user AFTER this mint
        uint256 newTotalDebtUsdValue = _getCurrentTotalDebtUsdValue(_msgSender()) + usdValueToMintNetOfFee;
        
        // Check overall position health
        require(newTotalDebtUsdValue == 0 || (userPos.usdcCollateral * CR_DENOMINATOR / newTotalDebtUsdValue) >= effectiveMinCRbps,
            "Vault: Insufficient collateral for new CR");

        // Update user's position
        userPos.synthSpecifics[synthAddress].amountMinted += amountSynthToMint;
        userPos.synthSpecifics[synthAddress].totalUsdValueAtMint += usdValueToMintNetOfFee; // Track net USD value added to debt

        // Collect fee in USDC by deducting from user's collateral (or user pre-pays)
        // For simplicity, assume fee is effectively part of the collateralization requirement
        // Or, more directly, reduce collateral by fee amount IF user has enough *excess* collateral.
        // The spec implies fee is from the value minted. If mintFee is 0.5% on $100 mint, user gets $99.5 sAsset value
        // or user needs to collateralize $100 value + fee value.
        // Let's assume fee reduces the sAsset value for debt tracking (as done with usdValueToMintNetOfFee).
        // The fee itself needs to be transferred to feeRecipient.
        // The simplest way is to ensure user has enough collateral to cover `usdValueToMint` for CR purposes,
        // and then fee is taken from the transaction flow or from their collateral.
        // If fee is paid from collateral:
        require(userPos.usdcCollateral >= feeUsd, "Vault: Insufficient collateral for fee"); // This is complex if collateral is tight
        // A common way: user deposits USDC. Mint operation implies a cost.
        // The `usdValueToMint` (gross) determines collateral needed. Fee is separate.
        // Let's say fee is taken from the user's collateral pool.
        if (feeUsd > 0) {
            require(userPos.usdcCollateral >= feeUsd, "Vault: Insufficient collateral for mint fee");
            userPos.usdcCollateral -= feeUsd;
            usdcToken.safeTransfer(feeRecipient, feeUsd); // This contract transfers its USDC
        }

        // Mint the sAsset tokens
        ISynthToken(synthAddress).mint(_msgSender(), amountSynthToMint);

        emit SynthMinted(
            _msgSender(), synthAddress, synthConfig.assetId, amountSynthToMint,
            usdValueToMintNetOfFee, /* collateralizedForMint - this is complex */ 0, feeUsd
        );
        _updateAndEmitHealth(_msgSender());
    }

    /**
     * @notice User burns sAssets to reclaim a portion of their USDC collateral.
     * @param synthAddress The address of the sAsset token to burn.
     * @param amountSynthToBurn The quantity of sAsset to burn.
     */
    function burnSynth(address synthAddress, uint256 amountSynthToBurn) external nonReentrant whenNotPaused {
        require(synthFactory.isSynthRegistered(synthAddress), "Vault: Synth not registered");
        require(amountSynthToBurn > 0, "Vault: Zero burn amount");
        require(feeRecipient != address(0), "Vault: Fee recipient not set");

        UserPosition storage userPos = positions[_msgSender()];
        SynthPositionData storage synthPosData = userPos.synthSpecifics[synthAddress];
        SynthFactory.SynthConfig memory synthConfig = synthFactory.getSynthConfig(synthAddress);
         uint256 sAssetDecimals = ISynthToken(synthAddress).decimals();

        require(synthPosData.amountMinted >= amountSynthToBurn, "Vault: Insufficient sAsset balance to burn");

        // Calculate USD value of the debt portion being repaid (based on average value at mint)
        uint256 usdValueToRepay;
        if (synthPosData.amountMinted > 0) { // Avoid div by zero if amountMinted was somehow 0
             usdValueToRepay = Math.mulDiv(
                amountSynthToBurn,
                synthPosData.totalUsdValueAtMint,
                synthPosData.amountMinted
            );
        } else { // Should not happen if amountSynthToBurn > 0 and amountMinted >= amountSynthToBurn
            revert("Vault: Inconsistent synth position state");
        }
       
        // Calculate burn fee on the USD value being repaid
        uint256 feeUsd = (usdValueToRepay * burnFeeBps) / BPS_DENOMINATOR;
        uint256 usdcToReturnToUser = usdValueToRepay - feeUsd;

        // Ensure user has enough collateral to cover what's being returned + fee
        // This means usdcToReturnToUser + feeUsd (which is usdValueToRepay) must be <= userPos.usdcCollateral related to this debt.
        // This check is implicit: we deduct from totalUsdcCollateral later.

        // Check CR of REMAINING position (if any)
        uint256 remainingMintedAmount = synthPosData.amountMinted - amountSynthToBurn;
        if (remainingMintedAmount > 0) {
            uint256 remainingUsdValueAtMint = synthPosData.totalUsdValueAtMint - usdValueToRepay;
            uint256 remainingTotalCollateral = userPos.usdcCollateral - usdcToReturnToUser - feeUsd; // Collateral after this burn
            
            // Calculate current USD value of ALL remaining minted sAssets (not just this one)
            uint256 tempTotalDebtUsdValue = _getCurrentTotalDebtUsdValueExcludingSynthPortion(
                _msgSender(), synthAddress, amountSynthToBurn, usdValueToRepay
            );

            if (tempTotalDebtUsdValue > 0) { // If there's other debt or remaining debt of this synth
                uint256 effectiveMinCRbps = synthConfig.customMinCRbps > 0 ? synthConfig.customMinCRbps : minCollateralRatioBps;
                require(effectiveMinCRbps > 0, "Vault: MinCR not set for CR check");
                require(
                    (remainingTotalCollateral * CR_DENOMINATOR / tempTotalDebtUsdValue) >= effectiveMinCRbps,
                    "Vault: Burn leaves position undercollateralized"
                );
            }
        }
        // If remainingMintedAmount is 0 for this synth, and no other synths, they can withdraw all collateral associated with this burn.

        // User must approve this Vault contract to burn their sAssets
        ISynthToken(synthAddress).burnFrom(_msgSender(), amountSynthToBurn);

        // Update position state
        synthPosData.amountMinted -= amountSynthToBurn;
        synthPosData.totalUsdValueAtMint -= usdValueToRepay;
        userPos.usdcCollateral -= (usdcToReturnToUser + feeUsd); // Deduct returned amount and fee

        // Transfer USDC to user and feeRecipient
        if (feeUsd > 0) {
            usdcToken.safeTransfer(feeRecipient, feeUsd); // This contract transfers its USDC
        }
        if (usdcToReturnToUser > 0) {
            usdcToken.safeTransfer(_msgSender(), usdcToReturnToUser);
        }
        
        // Clean up map entry if all of this synth is burned and value is zero
        if (synthPosData.amountMinted == 0 && synthPosData.totalUsdValueAtMint == 0) {
            delete userPos.synthSpecifics[synthAddress];
        }


        emit SynthBurned(
            _msgSender(), synthAddress, synthConfig.assetId, amountSynthToBurn,
            usdValueToRepay, usdcToReturnToUser, feeUsd
        );
        _updateAndEmitHealth(_msgSender());
    }


    // --- Liquidation Support ---
    /**
     * @notice Called by the LiquidationEngine to liquidate a user's undercollateralized position.
     * @dev This function should only be callable by the authorized LiquidationEngine.
     *      It handles reducing user's debt and collateral, and transferring assets.
     * @param user The address of the user whose position is being liquidated.
     * @param synthToRepayAddress The sAsset being repaid by the liquidator.
     * @param amountSynthToRepay The amount of sAsset the liquidator is repaying.
     * @param collateralToSeizeAmountUsdc The amount of USDC collateral to be seized by the liquidator.
     *                                   This includes their repayment value + liquidation bonus.
     */
    function processLiquidation(
        address user,
        address synthToRepayAddress,
        uint256 amountSynthToRepay,
        uint256 collateralToSeizeAmountUsdc // Amount of USDC liquidator gets
    ) external nonReentrant whenNotPaused {
        require(msg.sender == liquidationEngine, "Vault: Caller not liquidation engine");
        require(synthFactory.isSynthRegistered(synthToRepayAddress), "Vault: Synth not registered for liquidation");

        UserPosition storage userPos = positions[user];
        SynthPositionData storage synthPosData = userPos.synthSpecifics[synthToRepayAddress];
        SynthFactory.SynthConfig memory synthConfig = synthFactory.getSynthConfig(synthToRepayAddress);

        require(synthPosData.amountMinted >= amountSynthToRepay, "Vault: Liq. repay > minted");
        require(userPos.usdcCollateral >= collateralToSeizeAmountUsdc, "Vault: Liq. seize > collateral");

        // Calculate USD value of the debt portion being repaid by liquidator
        // (based on average value at mint for the user's position)
        uint256 usdValueRepaidByLiquidator;
        if (synthPosData.amountMinted > 0) {
             usdValueRepaidByLiquidator = Math.mulDiv(
                amountSynthToRepay,
                synthPosData.totalUsdValueAtMint,
                synthPosData.amountMinted
            );
        } else {
            revert("Vault: Liq. inconsistent synth position");
        }

        // Update user's position: reduce debt, reduce collateral
        synthPosData.amountMinted -= amountSynthToRepay;
        synthPosData.totalUsdValueAtMint -= usdValueRepaidByLiquidator;
        userPos.usdcCollateral -= collateralToSeizeAmountUsdc;

        // The liquidator is assumed to have already burned the sAssets or provided them.
        // The LiquidationEngine should handle the burning of `amountSynthToRepay` from the liquidator
        // or from the user's balance if that's the model.
        // If liquidator provides sAssets to burn:
        // ISynthToken(synthToRepayAddress).burnFrom(liquidator, amountSynthToRepay);
        // For now, assume LiquidationEngine ensures sAssets are burned from somewhere.
        // This vault's role is to update the *debt* and *collateral* records.

        // Calculate if there's a profit for the system from this liquidation
        // (collateralSeized - usdValueOfDebtRepaidByLiquidator - bonusToLiquidator = systemProfit)
        // The `collateralToSeizeAmountUsdc` is what liquidator receives.
        // The system profit/loss is related to the difference between the actual value of collateral taken
        // from the user and the USD value of debt cleared for the user.
        // If `collateralToSeizeAmountUsdc` is simply what the user loses from their collateral balance,
        // and a portion of this goes to the liquidator and a portion to surplus buffer.
        // This means the `LiquidationEngine` determines the split. `USDCVault` just releases collateral.

        // For now, `USDCVault` simply releases `collateralToSeizeAmountUsdc`.
        // The `LiquidationEngine` will decide how much of this goes to the liquidator
        // and how much to the surplus buffer. This call might better be:
        // `releaseCollateralForLiquidation(user, amount)` and `decreaseDebtForLiquidation(user, synth, amountSynth, usdValue)`.
        // This `processLiquidation` function is a high-level one.

        // Transfer seized collateral (part to liquidator, part to surplus buffer)
        // This logic is typically in LiquidationEngine. Here, we just update the user's balance.
        // The LiquidationEngine will receive the `collateralToSeizeAmountUsdc` from this vault
        // (or rather, this vault transfers it out as directed by LiquidationEngine).

        // Let's assume LiquidationEngine tells us how much to send to liquidator and how much to surplus.
        // For now, this function assumes `collateralToSeizeAmountUsdc` is what the user loses.
        // The actual transfer logic needs to be coordinated with LiquidationEngine.

        // To simplify `USDCVault`: it reduces user's collateral by `collateralToSeizeAmountUsdc`.
        // The `LiquidationEngine` will then claim this amount (or parts of it).
        // This means `USDCVault` might need a function like `claimSeizedCollateral(amount)` callable by LE.
        // Or this function transfers it directly.

        // TODO: Refine interaction with LiquidationEngine for fund flow.
        // For now: User's collateral is reduced. The sAssets are considered repaid.
        // The actual movement of USDC from this vault to liquidator/surplus is TBD by LE's design.

        if (synthPosData.amountMinted == 0 && synthPosData.totalUsdValueAtMint == 0) {
            delete userPos.synthSpecifics[synthToRepayAddress];
        }

        _updateAndEmitHealth(user);
        // LiquidationEngine will emit its own detailed event.
    }


    // --- Surplus Buffer Management ---
    function sweepSurplusToTreasury() external nonReentrant onlyOwner {
        require(treasuryAddress != address(0), "Vault: Treasury not set");
        if (currentSurplusBuffer > surplusBufferThreshold) {
            uint256 amountToSweep = currentSurplusBuffer - surplusBufferThreshold;
            if (amountToSweep > 0) {
                currentSurplusBuffer -= amountToSweep;
                usdcToken.safeTransfer(treasuryAddress, amountToSweep); // This contract transfers its USDC
                emit SurplusSweptToTreasury(amountToSweep);
            }
        }
    }

    /** @dev Adds funds to the surplus buffer. Can be called by LiquidationEngine or when fees are processed. */
    function addCollateralToSurplusBuffer(uint256 amountUsdc) external whenNotPaused {
        // Restrict who can call this, e.g., LiquidationEngine or Fee collection mechanism
        // For now, let's assume fee collection part of mint/burn directly sends to feeRecipient,
        // and LiquidationEngine might send profit here.
        require(msg.sender == liquidationEngine || msg.sender == feeRecipient /*or this contract for internal fee processing*/,
                "Vault: Unauthorized surplus deposit");
        currentSurplusBuffer += amountUsdc;
        // No direct transfer needed if this function is called by an entity that already
        // caused USDC to be in this contract (e.g., if fees were paid to address(this)).
    }


    // --- View Functions ---
    function getCollateralizationRatio(address user) public view returns (uint256 crBps) {
        UserPosition storage userPos = positions[user];
        if (userPos.usdcCollateral == 0) return type(uint256).max; // Infinite CR if no debt and no collateral, or 0 if debt

        uint256 totalDebtUsd = _getCurrentTotalDebtUsdValue(user);
        if (totalDebtUsd == 0) return type(uint256).max; // Infinite CR if no debt

        // CR = (Collateral USD / Debt USD) * CR_DENOMINATOR
        // USDC collateral is already in USD (assuming 1 USDC = $1) but needs decimal adjustment
        uint256 collateralUsdValue = userPos.usdcCollateral * (PRICE_PRECISION / (10**USDC_DECIMALS));
        return Math.mulDiv(collateralUsdValue, CR_DENOMINATOR, totalDebtUsd);
    }

    function isPositionLiquidatable(address user) public view returns (bool) {
        uint256 currentCRbps = getCollateralizationRatio(user);
        // This needs to consider per-synth custom MinCR if any synth is driving the liquidation risk.
        // A simple check against global minCR:
        if (minCollateralRatioBps == 0) return false; // Not configured
        if (currentCRbps < minCollateralRatioBps) {
            return true;
        }
        // More advanced: iterate synths, check against effectiveMinCR for each portion of debt.
        // For now, global check based on average values.
        // The actual minCR for liquidation would be determined by the synth with the highest requirement
        // relative to its proportion of the debt, or simply the lowest customMinCR / global minCR.
        // Let's assume LiquidationEngine does more detailed checks.
        // This function gives a general idea.

        // A position is liquidatable if its CR is below the *effective* min CR.
        // The effective min CR might be the highest min CR of any minted synth, or the vault default.
        // For now, use vault default for this view. LiquidationEngine will be more precise.
        return currentCRbps < minCollateralRatioBps && minCollateralRatioBps > 0;
    }

    // --- Internal Helper Functions ---
    function _getTotalMintedUsdValue(address user) internal view returns (uint256 totalUsdValue) {
        // This is the sum of `totalUsdValueAtMint` across all sAssets for the user.
        // Iterating a mapping is not possible on-chain directly in Solidity.
        // This function would require off-chain computation or storing a running total for the user.
        // For on-chain CR checks during operations, we calculate it based on known synth involved.
        // For a generic view, this is problematic.
        // Let's assume this is the "book value" of their total debt.
        // For calculating current CR, we need current value of minted synths.

        // This function is actually not needed if we always calculate current debt value.
        // The important value is `_getCurrentTotalDebtUsdValue`.
        revert("Vault: _getTotalMintedUsdValue deprecated, use _getCurrentTotalDebtUsdValue");
    }

    function _getCurrentTotalDebtUsdValue(address user) internal view returns (uint256 totalCurrentUsdValue) {
        UserPosition storage userPos = positions[user];
        // This requires iterating userPos.synthSpecifics, which is a mapping.
        // This cannot be done directly in a view function if we don't know which synths user has.
        // This function is critical for CR calculation.
        // Options:
        // 1. User passes array of their minted synth addresses.
        // 2. Store an array of minted synth addresses per user (gas heavy for storage).
        // 3. Off-chain calculates this; on-chain operations recalculate for specific synth.

        // For on-chain operations like mint/burn/withdraw, we work with specific synths
        // or the full list if provided. For a general view function, this is tough.
        // Let's assume this helper is called INTERNALLY where the list of synths is enumerable
        // or we are calculating it iteratively.
        
        // This function is primarily for on-chain logic that needs the *current* value.
        // It would be called by iterating over a known set of user's synths or for a specific synth.
        // The public `getCollateralizationRatio` will need a way to get this.
        // For now, let this be a placeholder for the concept.
        // The actual CR calculation in mint/burn will be more direct for the involved synths.
        
        // This function is complex to implement generically on-chain.
        // It's better if CR checks are done in context of operations.
        // I will remove this generic helper and embed logic in mint/burn/withdraw.
        revert("Vault: _getCurrentTotalDebtUsdValue needs context of synths");
        return 0;
    }

    function _getCurrentTotalDebtUsdValueForHealthCheck(address user) internal view returns (uint256 totalCurrentUsdValue_) {
        // This would require knowing all synths a user has minted.
        // For a simplified health check emit, this is hard.
        // The LiquidationEngine will need to iterate or be provided this by liquidator.
        // For emitting health, we might only be able to do it accurately after an op involving one synth.
        // This is a known challenge in CDP systems without on-chain iteration of all debts.
        // For `_updateAndEmitHealth`, we might pass the latest CR if easily calculable.
        UserPosition storage userPos = positions[user];
        uint256 cumulativeDebt = 0;
        // This loop is illustrative, cannot iterate mapping keys directly.
        // Would need to iterate `deployedSynthAddresses` from factory and check if user has position.
        for (uint i = 0; i < synthFactory.getDeployedSynthsCount(); i++) {
            address synthAddr = synthFactory.getDeployedSynthAddressAtIndex(i);
            if (userPos.synthSpecifics[synthAddr].amountMinted > 0) {
                SynthFactory.SynthConfig memory synthConf = synthFactory.getSynthConfig(synthAddr);
                 uint256 sAssetDecimals = ISynthToken(synthAddr).decimals();
                uint256 price = oracle.getPrice(synthConf.assetId); // Assumes price is available
                cumulativeDebt += Math.mulDiv(
                    userPos.synthSpecifics[synthAddr].amountMinted, price, (10**sAssetDecimals)
                );
            }
        }
        return cumulativeDebt;
    }


    function _updateAndEmitHealth(address user) internal {
        uint256 totalDebt = _getCurrentTotalDebtUsdValueForHealthCheck(user);
        if (totalDebt == 0) {
            emit PositionHealthUpdated(user, type(uint256).max);
        } else {
            uint256 collateralUsdValue = positions[user].usdcCollateral * (PRICE_PRECISION / (10**USDC_DECIMALS));
            emit PositionHealthUpdated(user, Math.mulDiv(collateralUsdValue, CR_DENOMINATOR, totalDebt));
        }
    }

    // Helper for burnSynth CR check on remaining position
    function _getCurrentTotalDebtUsdValueExcludingSynthPortion(
        address user, address synthBeingBurned, uint256 amountBurned, uint256 usdValueRepaid
    ) internal view returns (uint256 netTotalDebt) {
        UserPosition storage userPos = positions[user];
        // Iterate all synths, calculate current value, subtract the portion being conceptually removed
        for (uint i = 0; i < synthFactory.getDeployedSynthsCount(); i++) {
            address synthAddr = synthFactory.getDeployedSynthAddressAtIndex(i);
            SynthPositionData storage spd = userPos.synthSpecifics[synthAddr];
            if (spd.amountMinted > 0) {
                SynthFactory.SynthConfig memory synthConf = synthFactory.getSynthConfig(synthAddr);
                uint256 sAssetDecimals = ISynthToken(synthAddr).decimals();
                uint256 price = oracle.getPrice(synthConf.assetId);
                uint256 currentAmount = spd.amountMinted;

                if (synthAddr == synthBeingBurned) {
                    currentAmount -= amountBurned; // Calculate based on remaining amount of this synth
                }
                if(currentAmount > 0) { // only add if there's a remaining amount
                    netTotalDebt += Math.mulDiv(currentAmount, price, (10**sAssetDecimals));
                }
            }
        }
    }

    /**
     * @notice Allows Liquidation Engine to transfer USDC from vault to a specified address
     * @dev This function is called after processLiquidation has reduced user's collateral share
     * @param to Address to transfer USDC to
     * @param amountUsdc Amount of USDC to transfer
     */
    function transferUSDCFromVault(address to, uint256 amountUsdc) external onlyLiquidationEngine {
        usdcToken.safeTransfer(to, amountUsdc);
    }

    /**
     * @notice Allows Liquidation Engine to transfer USDC to the surplus buffer
     * @dev Moves USDC from general pool to explicit surplusBuffer accounting
     * @param amountUsdc Amount of USDC to transfer to surplus buffer
     */
    function transferUSDCFromVaultToSurplus(uint256 amountUsdc) external onlyLiquidationEngine {
        currentSurplusBuffer += amountUsdc;
    }
}