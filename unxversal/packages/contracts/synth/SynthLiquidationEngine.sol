// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./USDCVault.sol";
import "./SynthFactory.sol"; // To get synth info
import "./interfaces/ISynthToken.sol";
import "../common/interfaces/IOracleRelayer.sol"; // For oracle prices

/**
 * @title SynthLiquidationEngine
 * @author Unxversal Team
 * @notice Handles the liquidation of undercollateralized positions in the USDCVault.
 * @dev Allows anyone (keepers) to trigger liquidations. Liquidators repay a portion of
 *      the user's sAsset debt and receive discounted USDC collateral from the user's vault.
 */
contract SynthLiquidationEngine is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    USDCVault public usdcVault;
    SynthFactory public synthFactory;
    IOracleRelayer public oracle;
    IERC20 public usdcToken; // For interacting with USDC

    // Liquidation parameters (configurable by owner)
    uint256 public liquidationPenaltyBps;  // Penalty charged to liquidated user, part becomes liquidator bonus, part to surplus. E.g., 1000 (10%)
    uint256 public liquidatorRewardShareBps; // Share of the penalty that goes to the liquidator. E.g., 5000 (50% of penalty)
    uint256 public maxLiquidationPortionBps; // Max portion of a single sAsset debt that can be liquidated in one call. E.g., 5000 (50%)

    event PositionLiquidated(
        address indexed liquidator,
        address indexed user,
        address indexed synthAddress,
        uint256 amountSynthRepaid,      // Amount of sAsset repaid by liquidator
        uint256 usdValueOfDebtRepaid,   // USD value of the debt (at user's mint avg) cleared for user
        uint256 usdcCollateralSeized,   // Total USDC taken from user's collateral
        uint256 usdcToLiquidator,       // USDC portion paid to liquidator
        uint256 usdcToSurplusBuffer     // USDC portion paid to surplus buffer
    );

    // Admin parameter change events
    event LiquidationParamsSet(uint256 penaltyBps, uint256 rewardShareBps, uint256 maxPortionBps);
    event VaultSet(address vaultAddress);
    event FactorySet(address factoryAddress);
    event OracleSet(address oracleAddress);
    event UsdcTokenSet(address usdcAddress);


    constructor(
        address _usdcVaultAddress,
        address _synthFactoryAddress,
        address _oracleAddress,
        address _usdcTokenAddress,
        address _initialOwner
    ) Ownable(_initialOwner) {
        setUSDCVault(_usdcVaultAddress);
        setSynthFactory(_synthFactoryAddress);
        setOracle(_oracleAddress);
        setUsdcToken(_usdcTokenAddress);
        // Default liquidation params should be set by owner post-deployment
    }

    // --- Admin Functions ---
    function setLiquidationParameters(
        uint256 _penaltyBps,
        uint256 _rewardShareBps,
        uint256 _maxPortionBps
    ) external onlyOwner {
        require(_penaltyBps > 0 && _penaltyBps <= 2500, "SLE: Invalid penalty"); // Max 25% example
        require(_rewardShareBps <= 10000, "SLE: Invalid reward share"); // Can be up to 100% of penalty
        require(_maxPortionBps > 0 && _maxPortionBps <= 10000, "SLE: Invalid max portion"); // Up to 100%
        liquidationPenaltyBps = _penaltyBps;
        liquidatorRewardShareBps = _rewardShareBps;
        maxLiquidationPortionBps = _maxPortionBps;
        emit LiquidationParamsSet(_penaltyBps, _rewardShareBps, _maxPortionBps);
    }

    function setUSDCVault(address _vaultAddress) public onlyOwner {
        require(_vaultAddress != address(0), "SLE: Zero vault");
        usdcVault = USDCVault(_vaultAddress);
        emit VaultSet(_vaultAddress);
    }
    function setSynthFactory(address _factoryAddress) public onlyOwner {
        require(_factoryAddress != address(0), "SLE: Zero factory");
        synthFactory = SynthFactory(_factoryAddress);
        emit FactorySet(_factoryAddress);
    }
    function setOracle(address _oracleAddress) public onlyOwner {
        require(_oracleAddress != address(0), "SLE: Zero oracle");
        oracle = IOracleRelayer(_oracleAddress);
        emit OracleSet(_oracleAddress);
    }
    function setUsdcToken(address _usdcAddress) public onlyOwner {
        require(_usdcAddress != address(0), "SLE: Zero USDC");
        usdcToken = IERC20(_usdcAddress);
        emit UsdcTokenSet(_usdcAddress);
    }
    function pauseLiquidations() external onlyOwner { _pause(); }
    function unpauseLiquidations() external onlyOwner { _unpause(); }

    // --- Liquidation Function ---
    /**
     * @notice Liquidates an undercollateralized position for a specific sAsset.
     * @dev Anyone can call this. The caller (liquidator) must provide `amountSynthToRepay` of the sAsset.
     *      Liquidator first approves this contract for `amountSynthToRepay` of `synthToRepayAddress`.
     * @param user The address of the user whose position is being liquidated.
     * @param synthToRepayAddress The address of the sAsset for which debt is being repaid.
     * @param amountSynthToRepay The amount of sAsset the liquidator will repay on behalf of the user.
     *                           This amount is burned from the liquidator.
     */
    function liquidatePosition(
        address user,
        address synthToRepayAddress,
        uint256 amountSynthToRepay
    ) external nonReentrant whenNotPaused {
        require(address(usdcVault) != address(0), "SLE: Vault not set");
        require(address(synthFactory) != address(0), "SLE: Factory not set");
        require(address(oracle) != address(0), "SLE: Oracle not set");
        require(liquidationPenaltyBps > 0, "SLE: Liquidation not configured");

        // 1. Check if position is liquidatable (CR < minCR)
        // This check should be comprehensive, considering all user's debts vs collateral.
        // USDCVault's `isPositionLiquidatable` gives a general idea.
        // A more precise check here would involve fetching all user's synth positions.
        // For now, rely on USDCVault's view or assume liquidator has verified.
        // For safety, this contract should re-verify using current prices.
        require(usdcVault.isPositionLiquidatable(user), "SLE: Position not liquidatable by vault's check");

        // Get synth details from factory and vault
        SynthFactory.SynthConfig memory synthConfig = synthFactory.getSynthConfig(synthToRepayAddress);
        require(synthConfig.isRegistered, "SLE: Synth not registered");
        USDCVault.UserPosition storage userPos = usdcVault.positions(user); // Get storage pointer
        USDCVault.SynthPositionData storage userSynthPos = userPos.synthSpecifics[synthToRepayAddress];

        require(userSynthPos.amountMinted > 0, "SLE: User has no debt for this synth");

        // 2. Determine actual amount of sAsset to liquidate (up to maxPortion or full debt)
        uint256 maxRepayableSynth = (userSynthPos.amountMinted * maxLiquidationPortionBps) / BPS_DENOMINATOR;
        uint256 actualSynthToRepay = Math.min(amountSynthToRepay, maxRepayableSynth);
        require(actualSynthToRepay > 0, "SLE: Repay amount is zero after cap");
        require(actualSynthToRepay <= userSynthPos.amountMinted, "SLE: Repay amount exceeds user debt for synth");

        // 3. Liquidator provides sAssets: Burn sAssets from liquidator
        // Liquidator must have approved this contract for `actualSynthToRepay` of `synthToRepayAddress`.
        ISynthToken(synthToRepayAddress).burnFrom(_msgSender(), actualSynthToRepay);

        // 4. Calculate USD value of the debt being repaid by liquidator for the user
        // This uses the user's average mint price for that sAsset to determine "book value" of debt cleared.
        uint256 usdValueOfDebtClearedForUser;
        if (userSynthPos.amountMinted > 0) { // Should be true due to earlier check
            usdValueOfDebtClearedForUser = Math.mulDiv(
                actualSynthToRepay,
                userSynthPos.totalUsdValueAtMint,
                userSynthPos.amountMinted // Use original total before this liquidation part
            );
        } else {
            revert("SLE: Inconsistent state for debt value calc");
        }
        
        // 5. Calculate total USDC value of collateral to take from user
        // This is the USD value of debt cleared + penalty on that value.
        uint256 penaltyAmountUsd = (usdValueOfDebtClearedForUser * liquidationPenaltyBps) / BPS_DENOMINATOR;
        uint256 totalUsdcValueFromUser = usdValueOfDebtClearedForUser + penaltyAmountUsd;

        // Ensure user has enough collateral to cover this
        // Convert totalUsdcValueFromUser to USDC units (assuming 6 decimals for USDC)
        uint256 usdcToTakeFromUser = totalUsdcValueFromUser * (10**USDCVault.USDC_DECIMALS) / PRICE_PRECISION;
        require(userPos.usdcCollateral >= usdcToTakeFromUser, "SLE: Insufficient user collateral for liquidation");

        // 6. Update user's position in USDCVault: reduce debt, reduce collateral
        // This call tells USDCVault what happened.
        // The `collateralToSeizeAmountUsdc` for Vault's `processLiquidation` is `usdcToTakeFromUser`.
        usdcVault.processLiquidation(user, synthToRepayAddress, actualSynthToRepay, usdcToTakeFromUser);
        // After this, user's `usdcCollateral` in vault is reduced by `usdcToTakeFromUser`.
        // User's `amountMinted` and `totalUsdValueAtMint` for `synthToRepayAddress` are reduced.

        // 7. Distribute the seized USDC collateral (`usdcToTakeFromUser`)
        // It's currently "held" by this LiquidationEngine implicitly because USDCVault reduced user's balance.
        // Now, transfer it from USDCVault (which holds all USDC) to liquidator and surplus buffer.

        uint256 liquidatorRewardUsd = (penaltyAmountUsd * liquidatorRewardShareBps) / BPS_DENOMINATOR;
        uint256 usdcToLiquidator = liquidatorRewardUsd * (10**USDCVault.USDC_DECIMALS) / PRICE_PRECISION;
        
        // The remaining part of `totalUsdcValueFromUser` goes to surplus/system.
        // `usdValueOfDebtClearedForUser` effectively covers the "hole" left by the sAsset debt.
        // `penaltyAmountUsd` is the extra.
        // `liquidatorRewardUsd` is part of `penaltyAmountUsd`.
        // `surplusContributionUsd = penaltyAmountUsd - liquidatorRewardUsd`.
        uint256 surplusContributionUsd = penaltyAmountUsd - liquidatorRewardUsd;
        uint256 usdcToSurplus = surplusContributionUsd * (10**USDCVault.USDC_DECIMALS) / PRICE_PRECISION;

        // Transfer USDC from the Vault to liquidator and to surplus buffer (managed by Vault)
        if (usdcToLiquidator > 0) {
            // Vault needs a function to allow LE to transfer out, or LE holds USDC temporarily.
            // For simplicity, assume Vault transfers directly if called by LE.
            // Or, LE is given allowance on Vault's USDC (less ideal).
            // Let's make Vault transfer. Modify Vault.processLiquidation or add a new function.
            // **This requires a change in USDCVault or a specific withdrawal function callable by LE.**
            // For now, assume this contract gets the USDC and distributes it.
            // This implies `usdcVault.processLiquidation` might have transferred `usdcToTakeFromUser` to `address(this)`.
            // This is a CRITICAL flow detail.
            // Let's assume `USDCVault` has a function like:
            // `releaseCollateralForLiquidation(address recipient, uint256 amountUsdc)` callable by LE.
            
            // If `USDCVault.processLiquidation` only updates balances, then this contract
            // needs to be able to pull the `usdcToTakeFromUser` from `USDCVault`.
            // This means `USDCVault` needs to `approve` this `SynthLiquidationEngine` for its total USDC balance,
            // OR `USDCVault` needs specific authenticated withdrawal functions.
            // The latter is safer.

            // **Revised Flow Assumption:**
            // `USDCVault` has: `transferUSDCFromVault(address to, uint256 amount)` callable by LE.
            // This `SynthLiquidationEngine` would need to be registered with `USDCVault`.
            // Let's assume `USDCVault` has a method `executeLiquidationPayouts(address liquidator, uint256 amountToLiquidator, address surplus, uint256 amountToSurplus)`
            // callable only by `liquidationEngine`.

            usdcVault.transferUSDCFromVault(_msgSender(), usdcToLiquidator); // To liquidator
            if (usdcToSurplus > 0) {
                 usdcVault.transferUSDCFromVaultToSurplus(usdcToSurplus); // To Vault's surplus
            }
        }


        emit PositionLiquidated(
            _msgSender(), user, synthToRepayAddress, actualSynthToRepay,
            usdValueOfDebtClearedForUser, usdcToTakeFromUser,
            usdcToLiquidator, usdcToSurplus
        );
    }

    // --- View Functions ---
    /** @notice Checks if a user's specific synth position is liquidatable based on its current value and effective CR. */
    function checkSynthLiquidatability(address user, address synthAddress)
        external view returns (bool isLiquidatable, uint256 currentCRbps)
    {
        // This is a more focused check than vault's general one.
        USDCVault.UserPosition memory userPos = usdcVault.positions(user); // Read from storage
        if (userPos.usdcCollateral == 0) return (false, type(uint256).max);

        SynthFactory.SynthConfig memory synthConfig = synthFactory.getSynthConfig(synthAddress);
        if (!synthConfig.isRegistered || userPos.synthSpecifics[synthAddress].amountMinted == 0) {
            return (false, usdcVault.getCollateralizationRatio(user)); // Return overall CR if this synth not part of debt
        }

        uint256 currentTotalDebtUsd = usdcVault._getCurrentTotalDebtUsdValueForHealthCheck(user); // Uses the gas-heavy helper
        if (currentTotalDebtUsd == 0) return (false, type(uint256).max);

        uint256 collateralUsdValue = userPos.usdcCollateral * (PRICE_PRECISION / (10**USDCVault.USDC_DECIMALS));
        currentCRbps = Math.mulDiv(collateralUsdValue, CR_DENOMINATOR, currentTotalDebtUsd);

        uint256 effectiveMinCRbps = synthConfig.customMinCRbps > 0 ? synthConfig.customMinCRbps : usdcVault.minCollateralRatioBps();
        
        isLiquidatable = currentCRbps < effectiveMinCRbps && effectiveMinCRbps > 0;
        return (isLiquidatable, currentCRbps);
    }
}