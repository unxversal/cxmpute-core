// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../common/interfaces/IOracleRelayer.sol";
import "./libraries/FundingRateLib.sol";
import "./interfaces/IPerpsFeeCollector.sol";
import "./interfaces/ISpotPriceOracle.sol";

/**
 * @title PerpClearingHouse
 * @author Unxversal Team
 * @notice Central clearinghouse for perpetual futures. Manages markets, trader accounts, margin,
 *         positions, PnL, trade settlement, and funding rates. Uses USDC as collateral.
 * @dev All position sizes are in USD Notional. Relies on off-chain order matching.
 */
contract PerpClearingHouse is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Strings for uint256;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // --- Constants ---
    uint8 public constant USDC_DECIMALS = 6;
    uint256 public constant USD_PRECISION_SCALE = 10**USDC_DECIMALS;
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MARGIN_RATIO_PRECISION = 10000; // BPS
    uint256 public constant LEVERAGE_PRECISION = 100;

    // --- Structs ---
    /**
     * @dev Configuration for a specific perpetual market.
     * @param isListed True if the market is recognized by the system.
     * @param isActive True if trading and operations are enabled for this market.
     * @param underlyingAssetIdOracle Asset ID for IOracleRelayer to fetch mark price.
     * @param spotIndexOracle Address of the ISpotPriceOracle for funding's index price.
     * @param maxLeverage Maximum leverage allowed, e.g., 2000 for 20x.
     * @param initialMarginRatioBps Initial Margin Ratio in BPS.
     * @param maintenanceMarginRatioBps Maintenance Margin Ratio in BPS.
     * @param liquidationFeeBps Total fee from liquidated margin, in BPS.
     * @param takerTradeFeeBps Taker trade fee in BPS.
     * @param makerTradeFeeBps Maker trade fee in BPS (can be negative for rebate).
     * @param fundingParams Parameters for funding rate calculation.
     * @param minOrderSizeNotionalUsdPrecision Minimum order size in USD notional (USDC_DECIMALS scaled).
     * @param fundingFeeProtocolBps Protocol's share of gross funding payments, in BPS.
     */
    struct PerpMarketConfig {
        bool isListed;
        bool isActive;
        uint256 underlyingAssetIdOracle;
        ISpotPriceOracle spotIndexOracle;
        uint256 maxLeverage;
        uint256 initialMarginRatioBps;
        uint256 maintenanceMarginRatioBps;
        uint256 liquidationFeeBps;
        int256 takerTradeFeeBps;
        int256 makerTradeFeeBps;
        FundingRateLib.FundingParams fundingParams;
        uint256 minOrderSizeNotionalUsdPrecision;
        uint256 fundingFeeProtocolBps;
    }

    /**
     * @dev Dynamic state for a specific perpetual market.
     * @param cumulativeFundingRateValue Sum of (fundingRate * interval duration), scaled by PRICE_PRECISION.
     * @param lastFundingTimestamp Timestamp of the last funding settlement for this market.
     * @param openInterestNotionalLongUsd Sum of absolute sizes of long positions (USD_PRECISION scaled).
     * @param openInterestNotionalShortUsd Sum of absolute sizes of short positions (USD_PRECISION scaled).
     */
    struct PerpMarketState {
        int256 cumulativeFundingRateValue;
        uint256 lastFundingTimestamp;
        uint256 openInterestNotionalLongUsd;
        uint256 openInterestNotionalShortUsd;
    }

    /**
     * @dev Details of a trader's position in a specific market.
     * @param sizeNotionalUsd USD Notional size: +ve for long, -ve for short (USD_PRECISION scaled).
     * @param sumEntryPriceXSizeNotional Sum of (entryPrice_1e18 * abs_size_notional_1e6) for avg entry price.
     * @param sumAbsSizeNotionalUsd Sum of abs_size_notional_1e6 for weighted avg entry.
     * @param lastCumulativeFundingRateValueSnapshot Market's cumulative funding value at last interaction.
     * @param lastInteractionTimestamp Timestamp of the last interaction with this position.
     */
    struct TraderPosition {
        int256 sizeNotionalUsd;
        uint256 sumEntryPriceXSizeNotional;
        uint256 sumAbsSizeNotionalUsd;
        int256 lastCumulativeFundingRateValueSnapshot;
        uint256 lastInteractionTimestamp;
    }

    /**
     * @dev A trader's overall margin account.
     * @param usdcCollateralBalance Raw USDC balance (native 6 decimals).
     * @param positions Mapping from marketId to the trader's position in that market.
     * @param openMarketIds Set of marketIds where the trader has an open position.
     */
    struct TraderAccount {
        uint256 usdcCollateralBalance;
        mapping(bytes32 => TraderPosition) positions;
        EnumerableSet.Bytes32Set openMarketIds;
    }

    // --- State Variables ---
    IERC20 public usdcToken;
    IOracleRelayer public markPriceOracle;
    IPerpsFeeCollector public feeCollector;
    address public insuranceFundAddress;
    address public liquidationEngineAddress;

    mapping(bytes32 => PerpMarketConfig) private _marketConfigs;
    mapping(bytes32 => PerpMarketState) private _marketStates;
    mapping(address => TraderAccount) private _traderAccounts;

    bytes32[] public listedMarketIdsArray;
    mapping(bytes32 => bool) private _isMarketIdActuallyListed;

    // --- Events ---
    event MarginDeposited(address indexed trader, uint256 amountUsdc);
    event MarginWithdrawn(address indexed trader, uint256 amountUsdc);
    event MarketConfigured(bytes32 indexed marketId, bool isUpdate);
    event MarketFundingParamsUpdated(bytes32 indexed marketId, uint256 intervalSec, uint256 maxRateAbs, uint256 fundingFeeBps);
    event MarketSpotIndexOracleUpdated(bytes32 indexed marketId, address indexed spotOracle);
    event MarketActivationSet(bytes32 indexed marketId, bool isActive);
    event PositionChanged(
        address indexed trader, bytes32 indexed marketId,
        int256 newSizeNotionalUsd, uint256 newAvgEntryPrice1e18,
        int256 realizedPnlUsdc, uint256 tradeFeeUsdc
    );
    event FundingRateCalculated(bytes32 indexed marketId, int256 fundingRate1e18, uint256 timestamp);
    event FundingPaymentApplied(
        address indexed trader, bytes32 indexed marketId,
        int256 paymentAmountUsdc, int256 positionSizeNotionalUsd
    );
    event PositionLiquidatedByEngine( // Renamed for clarity vs internal event if any
        address indexed trader, bytes32 indexed marketId, address indexed liquidatorEngine,
        int256 closedSizeNotionalUsd, uint256 closePrice1e18,
        uint256 totalLiqFeeDeductedUsdc, int256 realizedPnlOnCloseUsdc
    );
    event UsdcTokenSet(address tokenAddress);
    event MarkPriceOracleSet(address oracleAddress);
    event FeeCollectorSet(address collectorAddress);
    event InsuranceFundSet(address fundAddress);
    event LiquidationEngineSet(address engineAddress);
    event MinOrderSizeSet(bytes32 indexed marketId, uint256 minOrderSizeUsdc);


    modifier marketIsActive(bytes32 marketId) {
        require(_marketConfigs[marketId].isListed && _marketConfigs[marketId].isActive, "PCH: Market not active");
        _;
    }
    modifier onlyLiquidationEngine() {
        require(_msgSender() == liquidationEngineAddress, "PCH: Caller not Liquidation Engine");
        _;
    }

    constructor(
        address _usdcTokenAddress, address _markPriceOracleAddress,
        address _feeCollectorAddress, address _insuranceFundAddress,
        address _initialOwner
    ) Ownable(_initialOwner) {
        setUsdcToken(_usdcTokenAddress);
        setOracle(_markPriceOracleAddress);
        setFeeCollector(_feeCollectorAddress);
        setInsuranceFund(_insuranceFundAddress);
    }

    // --- Admin Configuration Functions ---
    function setUsdcToken(address _tokenAddress) public onlyOwner {
        require(_tokenAddress != address(0), "PCH: Zero USDC");
        usdcToken = IERC20(_tokenAddress);
        emit UsdcTokenSet(_tokenAddress);
    }
    function setOracle(address _oracleAddress) public onlyOwner {
        require(_oracleAddress != address(0), "PCH: Zero mark oracle");
        markPriceOracle = IOracleRelayer(_oracleAddress);
        emit MarkPriceOracleSet(_oracleAddress);
    }
    function setFeeCollector(address _collectorAddress) public onlyOwner {
        require(_collectorAddress != address(0), "PCH: Zero fee collector");
        feeCollector = IPerpsFeeCollector(_collectorAddress);
        emit FeeCollectorSet(_collectorAddress);
    }
    function setInsuranceFund(address _fundAddress) public onlyOwner {
        require(_fundAddress != address(0), "PCH: Zero insurance fund");
        insuranceFundAddress = _fundAddress;
        emit InsuranceFundSet(_fundAddress);
    }
    function setLiquidationEngineAddress(address _engineAddress) public onlyOwner {
        require(_engineAddress != address(0), "PCH: Zero liquidation engine");
        liquidationEngineAddress = _engineAddress;
        emit LiquidationEngineSet(_engineAddress);
    }

    function listOrUpdateMarketDetails(
        bytes32 marketId, uint256 underlyingAssetIdOracle, address spotIndexOracleAddress,
        uint256 maxLeverage, uint256 imrBps, uint256 mmrBps, uint256 liqFeeBps,
        int256 takerTradeFeeBps, int256 makerTradeFeeBps, bool isActive
    ) external onlyOwner {
        require(marketId != bytes32(0), "PCH: Zero marketId");
        require(underlyingAssetIdOracle != 0, "PCH: Zero oracle ID");
        require(spotIndexOracleAddress != address(0), "PCH: Zero spot oracle");
        require(maxLeverage >= 1 * LEVERAGE_PRECISION && maxLeverage <= 100 * LEVERAGE_PRECISION, "PCH: Invalid max leverage");
        uint256 derivedImrBps = MARGIN_RATIO_PRECISION * LEVERAGE_PRECISION / maxLeverage;
        require(imrBps == derivedImrBps, "PCH: IMR does not match max leverage");
        require(mmrBps > 0 && mmrBps < imrBps, "PCH: Invalid MMR (must be < IMR)");
        require(liqFeeBps < mmrBps, "PCH: Liq fee must be < MMR");
        require(takerTradeFeeBps < int256(MARGIN_RATIO_PRECISION / 2) && makerTradeFeeBps < int256(MARGIN_RATIO_PRECISION / 2), "PCH: Trade fee too high");
        require(takerTradeFeeBps >= -(int256(MARGIN_RATIO_PRECISION) / 10) && makerTradeFeeBps >= -(int256(MARGIN_RATIO_PRECISION) / 10), "PCH: Rebate too high");

        PerpMarketConfig storage market = _marketConfigs[marketId];
        bool isNewListing = !market.isListed; // Use market.isListed which is accurate
        if (isNewListing) {
            market.isListed = true;
            _isMarketIdActuallyListed[marketId] = true;
            listedMarketIdsArray.push(marketId);
            _marketStates[marketId].lastFundingTimestamp = block.timestamp;
        }

        market.isActive = isActive;
        market.underlyingAssetIdOracle = underlyingAssetIdOracle;
        market.spotIndexOracle = ISpotPriceOracle(spotIndexOracleAddress);
        market.maxLeverage = maxLeverage;
        market.initialMarginRatioBps = imrBps;
        market.maintenanceMarginRatioBps = mmrBps;
        market.liquidationFeeBps = liqFeeBps;
        market.takerTradeFeeBps = takerTradeFeeBps;
        market.makerTradeFeeBps = makerTradeFeeBps;
        // minOrderSizeNotionalUsdPrecision is set by setMinOrderSizeNotional

        emit MarketConfigured(marketId, !isNewListing);
    }

    function setMarketFundingParameters(
        bytes32 marketId, uint256 fundingIntervalSeconds,
        uint256 maxFundingRateAbsValue1e18, uint256 _fundingFeeProtocolBps
    ) external onlyOwner {
        PerpMarketConfig storage market = _marketConfigs[marketId];
        require(market.isListed, "PCH: Market not listed");
        require(fundingIntervalSeconds >= 3600, "PCH: Interval < 1hr"); // Min 1hr
        require(maxFundingRateAbsValue1e18 > 0 && maxFundingRateAbsValue1e18 <= PRICE_PRECISION / 20, "PCH: Max rate invalid (max 5%)");
        require(_fundingFeeProtocolBps <= 2500, "PCH: Funding fee too high (max 25%)");

        market.fundingParams.fundingIntervalSeconds = fundingIntervalSeconds;
        market.fundingParams.maxFundingRateAbsValue = maxFundingRateAbsValue1e18;
        market.fundingFeeProtocolBps = _fundingFeeProtocolBps;
        emit MarketFundingParamsUpdated(marketId, fundingIntervalSeconds, maxFundingRateAbsValue1e18, _fundingFeeProtocolBps);
    }
    
    function setMarketSpotIndexOracle(bytes32 marketId, address spotIndexOracleAddress) external onlyOwner {
        PerpMarketConfig storage market = _marketConfigs[marketId];
        require(market.isListed, "PCH: Market not listed");
        require(spotIndexOracleAddress != address(0), "PCH: Zero spot oracle address");
        market.spotIndexOracle = ISpotPriceOracle(spotIndexOracleAddress);
        emit MarketSpotIndexOracleUpdated(marketId, spotIndexOracleAddress);
    }

    function setMarketActive(bytes32 marketId, bool _isActive) external onlyOwner {
        PerpMarketConfig storage market = _marketConfigs[marketId];
        require(market.isListed, "PCH: Market not listed");
        market.isActive = _isActive;
        emit MarketActivationSet(marketId, _isActive);
    }

    function setMinOrderSizeNotional(bytes32 marketId, uint256 _minOrderSizeUsdc) external onlyOwner {
        PerpMarketConfig storage market = _marketConfigs[marketId];
        require(market.isListed, "PCH: Market not listed");
        require(_minOrderSizeUsdc > 0, "PCH: Min order size must be > 0");
        market.minOrderSizeNotionalUsdPrecision = _minOrderSizeUsdc;
        emit MinOrderSizeSet(marketId, _minOrderSizeUsdc);
    }

    function pause() public onlyOwner { _pause(); }
    function unpause() public onlyOwner { _unpause(); }

    // --- User Margin ---
    function depositMargin(uint256 amountUsdc) external nonReentrant whenNotPaused {
        require(amountUsdc > 0, "PCH: Zero deposit");
        usdcToken.safeTransferFrom(_msgSender(), address(this), amountUsdc);
        _traderAccounts[_msgSender()].usdcCollateralBalance += amountUsdc;
        emit MarginDeposited(_msgSender(), amountUsdc);
    }

    function withdrawMargin(uint256 amountUsdc) external nonReentrant whenNotPaused {
        require(amountUsdc > 0, "PCH: Zero withdrawal");
        TraderAccount storage account = _traderAccounts[_msgSender()];
        require(account.usdcCollateralBalance >= amountUsdc, "PCH: Insufficient collateral");

        (uint256 mmrUsdc, ) = _calculateTotalMarginRequirements(account);
        uint256 marginBalanceUsdc = _getAccountTotalMarginBalanceUsd(account);

        require(marginBalanceUsdc > amountUsdc, "PCH: Withdrawal exceeds free margin"); // Free margin = Balance - IMR (or MMR for withdrawal)
        uint256 marginAfterWithdrawal = marginBalanceUsdc - amountUsdc;
        require(marginAfterWithdrawal >= mmrUsdc, "PCH: Withdrawal violates MMR");

        account.usdcCollateralBalance -= amountUsdc;
        usdcToken.safeTransfer(_msgSender(), amountUsdc);
        emit MarginWithdrawn(_msgSender(), amountUsdc);
    }

    // --- Trade Execution ---
    struct MatchedOrderFillData {
        bytes32 marketId;
        address maker;
        int256 sizeNotionalUsd; // Taker's perspective: +ve if taker buys, -ve if taker sells
        uint256 price1e18;
    }

    function fillMatchedOrder(MatchedOrderFillData calldata fill)
        external nonReentrant whenNotPaused marketIsActive(fill.marketId)
    {
        address taker = _msgSender();
        require(fill.maker != taker && fill.maker != address(0), "PCH: Invalid maker");
        require(fill.sizeNotionalUsd != 0, "PCH: Zero trade size");
        require(fill.price1e18 > 0, "PCH: Zero trade price");
        
        PerpMarketConfig storage mCfg = _marketConfigs[fill.marketId];
        uint256 absTradeSizeUsdc = uint256(fill.sizeNotionalUsd > 0 ? fill.sizeNotionalUsd : -fill.sizeNotionalUsd);
        require(absTradeSizeUsdc >= mCfg.minOrderSizeNotionalUsdPrecision, "PCH: Trade size too small");

        _preTradeIMRCheck(taker, fill.marketId, fill.sizeNotionalUsd, mCfg);
        _preTradeIMRCheck(fill.maker, fill.marketId, -fill.sizeNotionalUsd, mCfg);

        _settleFundingForTrader(taker, fill.marketId, mCfg, _marketStates[fill.marketId]);
        _settleFundingForTrader(fill.maker, fill.marketId, mCfg, _marketStates[fill.marketId]);

        (int256 takerPnlUsdc, uint256 takerFeeUsdc) = _executeTradeAndUpdatePosition(
            taker, fill.marketId, mCfg, _marketStates[fill.marketId],
            fill.sizeNotionalUsd, fill.price1e18, true /*isTaker*/, false /*isLiquidation*/
        );
        (int256 makerPnlUsdc, uint256 makerFeeUsdc) = _executeTradeAndUpdatePosition(
            fill.maker, fill.marketId, mCfg, _marketStates[fill.marketId],
            -fill.sizeNotionalUsd, fill.price1e18, false /*isTaker*/, false /*isLiquidation*/
        );

        _applyRealizedPnlToCollateral(taker, takerPnlUsdc);
        _applyRealizedPnlToCollateral(fill.maker, makerPnlUsdc);

        if (takerFeeUsdc > 0) _handleFeeCollection(taker, fill.marketId, takerFeeUsdc, true);
        if (makerFeeUsdc > 0) _handleFeeCollection(fill.maker, fill.marketId, makerFeeUsdc, false);
    }

    // --- Funding ---
    function settleMarketFunding(bytes32 marketId) external nonReentrant marketIsActive(marketId) {
        PerpMarketConfig storage mCfg = _marketConfigs[marketId];
        PerpMarketState storage mState = _marketStates[marketId];
        require(block.timestamp >= mState.lastFundingTimestamp + mCfg.fundingParams.fundingIntervalSeconds,
            "PCH: Funding interval not passed");

        uint256 markPriceTwap1e18 = markPriceOracle.getPrice(mCfg.underlyingAssetIdOracle);
        uint256 indexPriceTwap1e18 = mCfg.spotIndexOracle.getPrice();
        
        int256 fundingRate1e18 = FundingRateLib.calculateNextFundingRate(markPriceTwap1e18, indexPriceTwap1e18, mCfg.fundingParams);

        mState.cumulativeFundingRateValue += fundingRate1e18;
        mState.lastFundingTimestamp = block.timestamp;

        emit FundingRateCalculated(marketId, fundingRate1e18, block.timestamp);
    }

    // --- Liquidation Hook ---
    function processLiquidation(
        address trader, bytes32 marketId, int256 sizeToCloseNotionalUsd,
        uint256 closePrice1e18, uint256 totalLiquidationFeeUsdc
    ) external nonReentrant onlyLiquidationEngine returns (int256 realizedPnlOnCloseUsdc) {
        PerpMarketConfig storage mCfg = _marketConfigs[marketId];
        require(mCfg.isListed, "PCH: Liq market not listed");
        
        _settleFundingForTrader(trader, marketId, mCfg, _marketStates[marketId]);

        (realizedPnlOnCloseUsdc,) = _executeTradeAndUpdatePosition(
            trader, marketId, mCfg, _marketStates[marketId],
            sizeToCloseNotionalUsd, closePrice1e18, true /*isTaker for this context*/, true /*isLiquidation*/
        );
        _applyRealizedPnlToCollateral(trader, realizedPnlOnCloseUsdc);

        TraderAccount storage acc = _traderAccounts[trader];
        require(acc.usdcCollateralBalance >= totalLiquidationFeeUsdc, "PCH: Insufficient margin for liq fee");
        acc.usdcCollateralBalance -= totalLiquidationFeeUsdc;

        if (totalLiquidationFeeUsdc > 0 && address(feeCollector) != address(0)) {
            usdcToken.safeTransfer(address(feeCollector), totalLiquidationFeeUsdc);
        }
        emit PositionLiquidatedByEngine(trader, marketId, _msgSender(), sizeToCloseNotionalUsd, closePrice1e18, totalLiquidationFeeUsdc, realizedPnlOnCloseUsdc);
        return realizedPnlOnCloseUsdc;
    }

    // --- Internal Logic ---
    function _preTradeIMRCheck(address trader, bytes32 marketId, int256 tradeSizeNotionalUsd, PerpMarketConfig storage mCfgPassed) internal view {
        TraderAccount storage acc = _traderAccounts[trader];
        uint256 totalMarginBalanceUsdc = _getAccountTotalMarginBalanceUsd(acc);
        (, uint256 totalImrUsdcAfterTrade) = _calculateTotalMarginRequirementsAfterPotentialTrade(
            acc, marketId, tradeSizeNotionalUsd
        );
        require(totalMarginBalanceUsdc >= totalImrUsdcAfterTrade, "PCH: IMR violation");
    }

    function _settleFundingForTrader(address trader, bytes32 marketId, PerpMarketConfig storage mCfg, PerpMarketState storage mState) internal {
        TraderAccount storage acc = _traderAccounts[trader];
        TraderPosition storage pos = acc.positions[marketId];

        if (pos.sizeNotionalUsd == 0 || pos.lastCumulativeFundingRateValueSnapshot == mState.cumulativeFundingRateValue) {
            return;
        }
        int256 rateValueDiff1e18 = mState.cumulativeFundingRateValue - pos.lastCumulativeFundingRateValueSnapshot;
        int256 paymentUsdc = (pos.sizeNotionalUsd * rateValueDiff1e18) / int256(PRICE_PRECISION); // Results in USD_PRECISION (1e6) scale

        uint256 protocolFeeFromFundingUsdc = 0;
        if (mCfg.fundingFeeProtocolBps > 0) {
            uint256 absPayment = uint256(paymentUsdc > 0 ? paymentUsdc : -paymentUsdc);
            protocolFeeFromFundingUsdc = Math.mulDiv(absPayment, mCfg.fundingFeeProtocolBps, MARGIN_RATIO_PRECISION);
        }

        if (paymentUsdc > 0) { // Trader PAYS funding
            uint256 totalPaymentFromTrader = uint256(paymentUsdc); // This is the gross amount before protocol fee split
            if (acc.usdcCollateralBalance >= totalPaymentFromTrader) {
                acc.usdcCollateralBalance -= totalPaymentFromTrader;
                if (address(feeCollector) != address(0) && totalPaymentFromTrader > 0) {
                    usdcToken.safeTransfer(address(feeCollector), totalPaymentFromTrader);
                    // feeCollector might then send (totalPaymentFromTrader - protocolFeeFromFundingUsdc) to counterparties/pool
                    // and protocolFeeFromFundingUsdc to treasury/insurance.
                }
            } else { /* Handle shortfall */ 
                if(address(feeCollector) != address(0) && acc.usdcCollateralBalance > 0) {
                     usdcToken.safeTransfer(address(feeCollector), acc.usdcCollateralBalance);
                }
                acc.usdcCollateralBalance = 0; 
            }
        } else if (paymentUsdc < 0) { // Trader RECEIVES funding
            uint256 grossPaymentToTrader = uint256(-paymentUsdc);
            uint256 netPaymentToTrader = grossPaymentToTrader - protocolFeeFromFundingUsdc;
            if (netPaymentToTrader > 0) {
                // Funds must come from feeCollector (acting as funding pool)
                if (address(feeCollector) != address(0)) {
                    IERC20(usdcToken).safeTransferFrom(address(feeCollector), address(this), netPaymentToTrader); // FeeCollector needs to approve this CH
                    acc.usdcCollateralBalance += netPaymentToTrader;
                }
            }
            if (protocolFeeFromFundingUsdc > 0 && address(feeCollector) != address(0)) {
                // The feeCollector already "paid" the gross amount implicitly (by not receiving it or by sourcing it).
                // It needs to account for the protocolFeeFromFundingUsdc part internally.
            }
        }
        pos.lastCumulativeFundingRateValueSnapshot = mState.cumulativeFundingRateValue;
        emit FundingPaymentApplied(trader, marketId, paymentUsdc, pos.sizeNotionalUsd);
    }

    function _executeTradeAndUpdatePosition(
        address trader, bytes32 marketId, PerpMarketConfig storage mCfg, PerpMarketState storage mState,
        int256 tradeSizeNotionalUsd, uint256 tradePrice1e18, bool isTaker, bool isLiquidation
    ) internal returns (int256 realizedPnlUsdc, uint256 tradeFeeUsdc) {
        TraderAccount storage acc = _traderAccounts[trader];
        TraderPosition storage pos = acc.positions[marketId];
        int256 oldSizeNotionalUsd = pos.sizeNotionalUsd;
        int256 newSizeNotionalUsd = oldSizeNotionalUsd + tradeSizeNotionalUsd;
        uint256 absTradeSizeNotionalUsd = uint256(tradeSizeNotionalUsd > 0 ? tradeSizeNotionalUsd : -tradeSizeNotionalUsd);

        if (oldSizeNotionalUsd == 0) { // Opening
            pos.sizeNotionalUsd = newSizeNotionalUsd;
            pos.sumEntryPriceXSizeNotional = tradePrice1e18 * absTradeSizeNotionalUsd;
            pos.sumAbsSizeNotionalUsd = absTradeSizeNotionalUsd;
            if (!acc.openMarketIds.contains(marketId)) acc.openMarketIds.add(marketId);
        } else if (newSizeNotionalUsd == 0) { // Closing full
            uint256 avgEntryPrice1e18 = pos.sumAbsSizeNotionalUsd == 0 ? 0 : pos.sumEntryPriceXSizeNotional / pos.sumAbsSizeNotionalUsd;
            if (avgEntryPrice1e18 > 0) { // Avoid div by zero if pos was somehow inconsistent
                realizedPnlUsdc = (oldSizeNotionalUsd * (int256(tradePrice1e18) - int256(avgEntryPrice1e18))) / int256(PRICE_PRECISION);
            }
            pos.sizeNotionalUsd = 0; pos.sumEntryPriceXSizeNotional = 0; pos.sumAbsSizeNotionalUsd = 0;
            acc.openMarketIds.remove(marketId);
        } else if ((oldSizeNotionalUsd > 0) == (newSizeNotionalUsd > 0)) { // Reducing or Increasing same direction
            if (absTradeSizeNotionalUsd < uint256(oldSizeNotionalUsd > 0 ? oldSizeNotionalUsd : -oldSizeNotionalUsd) ) { // Reducing
                uint256 avgEntryPrice1e18 = pos.sumAbsSizeNotionalUsd == 0 ? 0 : pos.sumEntryPriceXSizeNotional / pos.sumAbsSizeNotionalUsd;
                 if (avgEntryPrice1e18 > 0) {
                    realizedPnlUsdc = (-tradeSizeNotionalUsd * (int256(tradePrice1e18) - int256(avgEntryPrice1e18))) / int256(PRICE_PRECISION);
                }
                pos.sumEntryPriceXSizeNotional -= avgEntryPrice1e18 * absTradeSizeNotionalUsd; // Maintain avg price for remaining
                pos.sumAbsSizeNotionalUsd -= absTradeSizeNotionalUsd;
            } else { // Increasing
                pos.sumEntryPriceXSizeNotional += tradePrice1e18 * absTradeSizeNotionalUsd;
                pos.sumAbsSizeNotionalUsd += absTradeSizeNotionalUsd;
            }
            pos.sizeNotionalUsd = newSizeNotionalUsd;
        } else { // Flipping position
            uint256 avgEntryPrice1e18 = pos.sumAbsSizeNotionalUsd == 0 ? 0 : pos.sumEntryPriceXSizeNotional / pos.sumAbsSizeNotionalUsd;
            if (avgEntryPrice1e18 > 0) {
                realizedPnlUsdc = (oldSizeNotionalUsd * (int256(tradePrice1e18) - int256(avgEntryPrice1e18))) / int256(PRICE_PRECISION);
            }
            pos.sizeNotionalUsd = newSizeNotionalUsd;
            pos.sumEntryPriceXSizeNotional = tradePrice1e18 * uint256(newSizeNotionalUsd > 0 ? newSizeNotionalUsd : -newSizeNotionalUsd);
            pos.sumAbsSizeNotionalUsd = uint256(newSizeNotionalUsd > 0 ? newSizeNotionalUsd : -newSizeNotionalUsd);
        }
        pos.lastInteractionTimestamp = block.timestamp;

        int256 feeBps = isLiquidation ? int256(0) : (isTaker ? mCfg.takerTradeFeeBps : mCfg.makerTradeFeeBps);
        if (feeBps > 0) {
            tradeFeeUsdc = Math.mulDiv(absTradeSizeNotionalUsd, uint256(feeBps), MARGIN_RATIO_PRECISION);
        } else if (feeBps < 0 && !isLiquidation) {
            uint256 rebateUsdc = Math.mulDiv(absTradeSizeNotionalUsd, uint256(-feeBps), MARGIN_RATIO_PRECISION);
            realizedPnlUsdc += int256(rebateUsdc); // Add rebate to PnL (positive for trader)
        }

        // Update Open Interest: OI is sum of all longs (or all shorts).
        // This update reflects change in one side of the market.
        // If tradeSizeNotionalUsd is positive (taker bought), long OI potentially increases, short OI potentially increases (maker sold).
        // For simplicity, use tradeSizeNotionalUsd (absolute) as the amount changing hands.
        // Proper OI needs tracking if it's opening or closing overall market OI.
        // This simplified version updates based on the *net effect* of this specific trade on the sum of long/short notionals.
        if(tradeSizeNotionalUsd > 0){ // Taker bought, so overall long notional increased by this amount OR short notional decreased
            mState.openInterestNotionalLongUsd += absTradeSizeNotionalUsd;
        } else { // Taker sold
            mState.openInterestNotionalShortUsd += absTradeSizeNotionalUsd;
        }
        // This needs refinement for perfect OI. Example: if taker closes a short by buying, long OI increases, short OI decreases.

        emit PositionChanged(trader, marketId, newSizeNotionalUsd, _getAverageEntryPrice(pos), realizedPnlUsdc, tradeFeeUsdc);
        return (realizedPnlUsdc, tradeFeeUsdc);
    }

    function _applyRealizedPnlToCollateral(address trader, int256 pnlUsdc) internal {
        TraderAccount storage acc = _traderAccounts[trader];
        if (pnlUsdc > 0) {
            acc.usdcCollateralBalance += uint256(pnlUsdc);
        } else if (pnlUsdc < 0) {
            uint256 lossUsdc = uint256(-pnlUsdc);
            if (acc.usdcCollateralBalance >= lossUsdc) {
                acc.usdcCollateralBalance -= lossUsdc;
            } else { // Bankruptcy
                uint256 shortfall = lossUsdc - acc.usdcCollateralBalance;
                acc.usdcCollateralBalance = 0;
                if (address(insuranceFundAddress) != address(0) && shortfall > 0) {
                    // Notify insurance fund or transfer from it IF this contract holds IF funds.
                    // For now, this contract doesn't directly pull from IF.
                    // The PerpLiquidationEngine or a separate process would handle IF payouts.
                    // Emitting an event for bankruptcy is important.
                    // event TraderBankruptcy(trader, marketId_if_specific, shortfall);
                }
            }
        }
    }

    function _handleFeeCollection(address trader, bytes32 marketId, uint256 feeUsdc, bool isTaker) internal {
        TraderAccount storage acc = _traderAccounts[trader];
        // Fee is already accounted for if PnL was net of fee, or if it's to be deducted now.
        // The _updatePositionAndOI now returns fee separately.
        if (feeUsdc > 0) {
            require(acc.usdcCollateralBalance >= feeUsdc, "PCH: Insufficient collateral for trade fee");
            acc.usdcCollateralBalance -= feeUsdc;
            if (address(feeCollector) != address(0)) {
                usdcToken.safeTransfer(address(feeCollector), feeUsdc);
                // Optionally tell feeCollector more details:
                // feeCollector.collectTradingFee(trader, marketId, address(usdcToken), feeUsdc, isTaker);
            }
        }
    }
    
    // --- View Functions ---
    function _getAverageEntryPrice(TraderPosition storage pos) internal view returns (uint256 avgEntryPrice1e18) {
        if (pos.sumAbsSizeNotionalUsd == 0) return 0;
        return pos.sumEntryPriceXSizeNotional / pos.sumAbsSizeNotionalUsd;
    }

    function _calculateUnrealizedPnlForPosition(TraderPosition storage pos, uint256 markPrice1e18)
        internal view returns (int256 unrealizedPnlUsdc)
    {
        if (pos.sizeNotionalUsd == 0) return 0;

        uint256 avgEntryPrice1e18 = _getAverageEntryPrice(pos);
        if (avgEntryPrice1e18 == 0) return 0;

        int256 priceDiff1e18 = int256(markPrice1e18) - int256(avgEntryPrice1e18);
        unrealizedPnlUsdc = (pos.sizeNotionalUsd * priceDiff1e18) / int256(avgEntryPrice1e18);
    }

    function _getAccountTotalUnrealizedPnlUsd(TraderAccount storage acc) internal view returns (int256 totalUpnlUsdc) {
        for (uint i = 0; i < acc.openMarketIds.length(); ++i) {
            bytes32 marketId = acc.openMarketIds.at(i);
            // Need to pass trader address to _calculateUnrealizedPnlForPosition if it doesn't take TraderPosition storage directly
            // Or, it needs to be a free function taking TraderPosition.
            // For now, assume direct access or refactor _calcUnrealizedPnl to take TraderPosition by value or trader addr.
            // Let's pass trader and marketId.
            // No, _calculateUnrealizedPnlForPosition takes TraderPosition storage.
            // So, we need to pass acc.positions[marketId].

            PerpMarketConfig storage mCfg = _marketConfigs[marketId];
            uint256 markPrice1e18 = markPriceOracle.getPrice(mCfg.underlyingAssetIdOracle);
            totalUpnlUsdc += _calculateUnrealizedPnlForPosition(acc.positions[marketId], markPrice1e18);
        }
    }

    function _getAccountTotalMarginBalanceUsd(TraderAccount storage acc) internal view returns (uint256) {
        int256 totalUpnl = _getAccountTotalUnrealizedPnlUsd(acc);
        int256 marginBalance = int256(acc.usdcCollateralBalance) + totalUpnl;
        return marginBalance > 0 ? uint256(marginBalance) : 0;
    }

    function _calculateTotalMarginRequirements(TraderAccount storage acc)
        internal view returns (uint256 totalMmrUsdc, uint256 totalImrUsdc)
    {
        for (uint i = 0; i < acc.openMarketIds.length(); ++i) {
            bytes32 marketId = acc.openMarketIds.at(i);
            TraderPosition storage pos = acc.positions[marketId];
            PerpMarketConfig storage mCfg = _marketConfigs[marketId];
            uint256 absPosNotionalUsd = uint256(pos.sizeNotionalUsd > 0 ? pos.sizeNotionalUsd : -pos.sizeNotionalUsd);
            
            totalMmrUsdc += Math.mulDiv(absPosNotionalUsd, mCfg.maintenanceMarginRatioBps, MARGIN_RATIO_PRECISION);
            totalImrUsdc += Math.mulDiv(absPosNotionalUsd, mCfg.initialMarginRatioBps, MARGIN_RATIO_PRECISION);
        }
    }
    
    function _calculateTotalMarginRequirementsAfterPotentialTrade(TraderAccount storage acc, bytes32 marketIdTrade, int256 tradeSizeNotionalUsd)
        internal view returns (uint256 totalMmrUsdc, uint256 totalImrUsdc)
    {
        bool tradeMarketProcessed = false;
        for (uint i = 0; i < acc.openMarketIds.length(); ++i) {
            bytes32 marketIdCurrentLoop = acc.openMarketIds.at(i);
            TraderPosition storage pos = acc.positions[marketIdCurrentLoop];
            PerpMarketConfig storage mCfg = _marketConfigs[marketIdCurrentLoop];
            int256 currentSize = pos.sizeNotionalUsd;

            if(marketIdCurrentLoop == marketIdTrade){
                currentSize += tradeSizeNotionalUsd;
                tradeMarketProcessed = true;
            }
            if (currentSize != 0) { // Only consider if there's a position (or will be one)
                uint256 absPosNotionalUsd = uint256(currentSize > 0 ? currentSize : -currentSize);
                totalMmrUsdc += Math.mulDiv(absPosNotionalUsd, mCfg.maintenanceMarginRatioBps, MARGIN_RATIO_PRECISION);
                totalImrUsdc += Math.mulDiv(absPosNotionalUsd, mCfg.initialMarginRatioBps, MARGIN_RATIO_PRECISION);
            }
        }
        // If marketIdTrade is a new market for the trader (not in openMarketIds yet)
        if (!tradeMarketProcessed && tradeSizeNotionalUsd != 0) {
            PerpMarketConfig storage mCfgTrade = _marketConfigs[marketIdTrade];
            uint256 absTradeNotionalUsd = uint256(tradeSizeNotionalUsd > 0 ? tradeSizeNotionalUsd : -tradeSizeNotionalUsd);
            totalMmrUsdc += Math.mulDiv(absTradeNotionalUsd, mCfgTrade.maintenanceMarginRatioBps, MARGIN_RATIO_PRECISION);
            totalImrUsdc += Math.mulDiv(absTradeNotionalUsd, mCfgTrade.initialMarginRatioBps, MARGIN_RATIO_PRECISION);
        }
    }

    // --- Public View Functions ---
    function getTraderCollateralBalance(address trader) external view returns (uint256 usdcBalance) {
        return _traderAccounts[trader].usdcCollateralBalance;
    }
    function getTraderPositionInfo(address trader, bytes32 marketId) external view returns (TraderPosition memory position) {
        return _traderAccounts[trader].positions[marketId];
    }
    function getTraderAverageEntryPrice(address trader, bytes32 marketId) external view returns (uint256 avgEntryPrice1e18) {
        return _getAverageEntryPrice(_traderAccounts[trader].positions[marketId]);
    }
    function getTraderUnrealizedPnl(address trader, bytes32 marketId) external view returns (int256 pnlUsdc) {
        PerpMarketConfig storage mCfg = _marketConfigs[marketId];
        require(mCfg.isListed, "PCH: Market not listed");
        uint256 markPrice1e18 = markPriceOracle.getPrice(mCfg.underlyingAssetIdOracle);
        return _calculateUnrealizedPnlForPosition(_traderAccounts[trader].positions[marketId], markPrice1e18);
    }
    function getAccountSummary(address trader)
        external view
        returns (
            uint256 usdcCollateral, int256 totalUnrealizedPnlUsdc, uint256 totalMarginBalanceUsdc,
            uint256 totalMaintenanceMarginReqUsdc, uint256 totalInitialMarginReqUsdc, bool isCurrentlyLiquidatable
        )
    {
        TraderAccount storage acc = _traderAccounts[trader];
        usdcCollateral = acc.usdcCollateralBalance;
        totalUnrealizedPnlUsdc = _getAccountTotalUnrealizedPnlUsd(acc);
        totalMarginBalanceUsdc = _getAccountTotalMarginBalanceUsd(acc);
        (totalMaintenanceMarginReqUsdc, totalInitialMarginReqUsdc) = _calculateTotalMarginRequirements(acc);
        
        uint256 totalAbsNotionalForLiqCheck = 0;
        for (uint i = 0; i < acc.openMarketIds.length(); ++i) {
            bytes32 marketId = acc.openMarketIds.at(i);
            TraderPosition storage pos = acc.positions[marketId];
             totalAbsNotionalForLiqCheck += uint256(pos.sizeNotionalUsd > 0 ? pos.sizeNotionalUsd : -pos.sizeNotionalUsd);
        }
        isCurrentlyLiquidatable = totalMarginBalanceUsdc < totalMaintenanceMarginReqUsdc && totalAbsNotionalForLiqCheck > 0;
    }
    function getMarketConfiguration(bytes32 marketId) external view returns (PerpMarketConfig memory config) {
        require(_marketConfigs[marketId].isListed, "PCH: Market not listed");
        return _marketConfigs[marketId];
    }
    function getMarketCurrentState(bytes32 marketId) external view returns (PerpMarketState memory state) {
        require(_marketConfigs[marketId].isListed, "PCH: Market not listed");
        return _marketStates[marketId]; // Returns stored state; funding settlement updates it.
    }
    function getListedMarketIds() external view returns (bytes32[] memory) {
        return listedMarketIdsArray;
    }
    function isMarketActuallyListed(bytes32 marketId) external view returns (bool) {
        return _isMarketIdActuallyListed[marketId];
    }

    // Public getter functions for the private mappings
    function getMarketConfig(bytes32 marketId) public view returns (PerpMarketConfig memory) {
        return _marketConfigs[marketId];
    }

    function getMarketState(bytes32 marketId) public view returns (PerpMarketState memory) {
        return _marketStates[marketId];
    }

    function getTraderAccount(address trader) public view returns (
        uint256 usdcCollateralBalance,
        bytes32[] memory openMarketIds
    ) {
        TraderAccount storage account = _traderAccounts[trader];
        return (
            account.usdcCollateralBalance,
            account.openMarketIds.values()
        );
    }
}