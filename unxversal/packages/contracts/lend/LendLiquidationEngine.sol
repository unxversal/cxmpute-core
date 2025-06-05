// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./CorePool.sol"; // For interacting with CorePool
import "./LendRiskController.sol"; // For risk parameters and health checks
import "../common/interfaces/IOracleRelayer.sol"; // For prices
import "../common/libraries/SafeDecimalMath.sol"; // If complex ratio math is done here

/**
 * @title LendLiquidationEngine
 * @author Unxversal Team
 * @notice Handles the liquidation of undercollateralized borrow positions in the Unxversal Lend protocol.
 * @dev Allows anyone (keepers/liquidators) to repay a portion of a borrower's debt
 *      and seize collateral at a discount (liquidation bonus).
 */
contract LendLiquidationEngine is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using SafeDecimalMath for uint256; // Using our decimal math library

    CorePool public corePool;
    LendRiskController public riskController;
    IOracleRelayer public oracle;

    // Max percentage of a single borrowed asset's outstanding balance that can be repaid in one liquidation call.
    // e.g., 5000 for 50%. (0-10000 BPS)
    uint256 public closeFactorBps;

    event LiquidationCall(
        address indexed liquidator,
        address indexed borrower,
        address indexed debtAssetRepaid,
        uint256 amountDebtRepaid, // In debt asset's native decimals
        address indexed collateralAssetSeized,
        uint256 amountCollateralSeized, // In collateral asset's native decimals
        uint256 debtRepaidUsdValue,     // USD value of debt repaid (1e18 scaled)
        uint256 collateralSeizedUsdValue // USD value of collateral seized (1e18 scaled)
    );

    // Admin parameter change events
    event CorePoolSet(address indexed poolAddress);
    event RiskControllerSet(address indexed controllerAddress);
    event OracleSet(address indexed oracleAddress);
    event CloseFactorSet(uint256 newCloseFactorBps);

    constructor(
        address _corePoolAddress,
        address _riskControllerAddress,
        address _oracleAddress,
        address _initialOwner
    ) Ownable(_initialOwner) {
        setCorePool(_corePoolAddress);
        setRiskController(_riskControllerAddress);
        setOracle(_oracleAddress);
        // closeFactorBps should be set by owner post-deployment.
    }

    // --- Admin Functions ---
    function setCorePool(address _newPoolAddress) public onlyOwner {
        require(_newPoolAddress != address(0), "LLE: Zero CorePool");
        corePool = CorePool(_newPoolAddress);
        emit CorePoolSet(_newPoolAddress);
    }

    function setRiskController(address _newControllerAddress) public onlyOwner {
        require(_newControllerAddress != address(0), "LLE: Zero RiskController");
        riskController = LendRiskController(_newControllerAddress);
        emit RiskControllerSet(_newControllerAddress);
    }

    function setOracle(address _newOracleAddress) public onlyOwner {
        require(_newOracleAddress != address(0), "LLE: Zero Oracle");
        oracle = IOracleRelayer(_newOracleAddress);
        emit OracleSet(_newOracleAddress);
    }

    /**
     * @notice Sets the close factor, determining max portion of a debt that can be liquidated at once.
     * @param _newCloseFactorBps New close factor in BPS (e.g., 5000 for 50%). Must be > 0 and <= 10000.
     */
    function setCloseFactor(uint256 _newCloseFactorBps) external onlyOwner {
        require(_newCloseFactorBps > 0 && _newCloseFactorBps <= LendRiskController.BPS_DENOMINATOR,
            "LLE: Invalid close factor");
        closeFactorBps = _newCloseFactorBps;
        emit CloseFactorSet(_newCloseFactorBps);
    }

    function pauseEngine() external onlyOwner { _pause(); }
    function unpauseEngine() external onlyOwner { _unpause(); }


    // --- Liquidation Function ---
    /**
     * @notice Liquidates an unhealthy borrow position.
     * @dev The caller (liquidator) repays some of the `borrower`'s debt in `debtAssetToRepay`
     *      and receives `collateralAssetToSeize` from the borrower's supplies at a discount.
     *      Liquidator must first approve this contract to spend `amountToRepay` of `debtAssetToRepay`.
     * @param borrower The address of the account to liquidate.
     * @param debtAssetToRepay The address of the underlying token for the debt being repaid.
     * @param collateralAssetToSeize The address of the underlying token for the collateral being seized.
     * @param amountToRepay The amount of `debtAssetToRepay` the liquidator wishes to repay.
     *                      This will be capped by the `closeFactorBps` and the borrower's actual debt.
     */
    function liquidate(
        address borrower,
        address debtAssetToRepay,
        address collateralAssetToSeize,
        uint256 amountToRepay // In native decimals of debtAssetToRepay
    ) external nonReentrant whenNotPaused {
        require(address(corePool) != address(0), "LLE: CorePool not set");
        require(address(riskController) != address(0), "LLE: RiskController not set");
        require(address(oracle) != address(0), "LLE: Oracle not set");
        require(closeFactorBps > 0, "LLE: Close factor not set");
        require(amountToRepay > 0, "LLE: Repay amount is zero");

        // 1. Verify borrower is liquidatable
        require(riskController.isAccountLiquidatable(borrower), "LLE: Account not liquidatable");

        // 2. Get market configs for debt and collateral assets
        LendRiskController.MarketRiskConfig memory debtConfig = riskController.marketRiskConfigs(debtAssetToRepay);
        LendRiskController.MarketRiskConfig memory collConfig = riskController.marketRiskConfigs(collateralAssetToSeize);
        require(debtConfig.isListed, "LLE: Debt asset not listed");
        require(collConfig.isListed && collConfig.canBeCollateral, "LLE: Collateral asset not valid");

        // 3. Accrue interest for both markets in CorePool before proceeding
        corePool.accrueInterest(debtAssetToRepay);
        corePool.accrueInterest(collateralAssetToSeize); // Important if exchange rate of collateral uToken matters

        // 4. Determine actual amount of debt to repay
        (, uint256 borrowerDebtBalance) = corePool.getUserSupplyAndBorrowBalance(borrower, debtAssetToRepay);
        require(borrowerDebtBalance > 0, "LLE: Borrower has no debt for this asset");

        uint256 maxRepayableByCloseFactor = Math.mulDiv(borrowerDebtBalance, closeFactorBps, LendRiskController.BPS_DENOMINATOR);
        uint256 actualAmountDebtToRepay = Math.min(amountToRepay, maxRepayableByCloseFactor);
        actualAmountDebtToRepay = Math.min(actualAmountDebtToRepay, borrowerDebtBalance); // Cannot repay more than exists
        require(actualAmountDebtToRepay > 0, "LLE: Calculated repay amount is zero");

        // 5. Calculate USD value of the debt being repaid
        uint256 debtAssetPrice = oracle.getPrice(debtConfig.oracleAssetId); // 1e18 scaled USD per whole unit
        uint256 debtRepaidUsdValue = Math.mulDiv(actualAmountDebtToRepay, debtAssetPrice, (10**debtConfig.underlyingDecimals));

        // 6. Calculate USD value of collateral to seize (debt repaid + bonus)
        // Liquidation bonus is specific to the collateral asset being seized
        uint256 liquidationBonusBps = collConfig.liquidationBonusBps;
        require(liquidationBonusBps > 0, "LLE: Liquidation bonus not set for collateral");

        uint256 bonusValueUsd = Math.mulDiv(debtRepaidUsdValue, liquidationBonusBps, LendRiskController.BPS_DENOMINATOR);
        uint256 totalCollateralToSeizeUsdValue = debtRepaidUsdValue + bonusValueUsd;

        // 7. Convert seizeable USD value to amount of collateral asset
        uint256 collateralAssetPrice = oracle.getPrice(collConfig.oracleAssetId);
        require(collateralAssetPrice > 0, "LLE: Collateral price is zero");
        uint256 amountCollateralToSeize = Math.mulDiv(totalCollateralToSeizeUsdValue, (10**collConfig.underlyingDecimals), collateralAssetPrice);
        require(amountCollateralToSeize > 0, "LLE: Calculated seize amount is zero");

        // 8. Liquidator repays the debt: Pull `debtAssetToRepay` from liquidator to CorePool (actually to uToken of debt asset)
        // The `_repayBorrowInternal` in CorePool handles moving tokens to the uToken.
        // Liquidator must have approved this LendLiquidationEngine contract.
        IERC20(debtAssetToRepay).safeTransferFrom(_msgSender(), address(corePool), actualAmountDebtToRepay);
        // CorePool needs a way to attribute this incoming transfer to the borrower's repayment.
        // This direct transfer to CorePool is problematic.
        // CorePool's repayBorrowBehalf expects CorePool to pull from payer.
        // So, liquidator approves CorePool, then this engine calls CorePool.repayBorrowBehalf.
        
        // **Revised Debt Repayment Flow:**
        // Liquidator (msg.sender) must approve CorePool for `actualAmountDebtToRepay` of `debtAssetToRepay`.
        // This Engine then calls `corePool.repayBorrowBehalf(borrower, debtAssetToRepay, actualAmountDebtToRepay)`
        // with `msg.sender` implicitly being this Engine if it holds tokens, which it shouldn't.
        // The `repayBorrowBehalf` in `CorePool` expects `msg.sender` to be the payer.
        // So, liquidator calls `debtAsset.approve(address(corePool), amount)`.
        // This engine then calls `corePool.repayBorrowBehalfByEngine(liquidator, borrower, debtAsset, amount)`
        // where `repayBorrowBehalfByEngine` is a new function in CorePool only callable by this engine,
        // and it uses `liquidator` as the payer for `safeTransferFrom`.

        // For V1, let's make it simpler: Liquidator calls `debtAsset.approve(address(this_engine), amount)`.
        // This engine pulls tokens, then calls `CorePool.reduceBorrowBalanceForLiquidation` AND
        // transfers the repaid debt tokens to the respective uToken contract.
        IERC20(debtAssetToRepay).safeTransferFrom(_msgSender(), address(this), actualAmountDebtToRepay); // Engine gets tokens
        IERC20(debtAssetToRepay).safeApprove(collConfig.uTokenAddress, actualAmountDebtToRepay); // Approve uToken of debt
        uToken(payable(debtConfig.uTokenAddress)).fetchUnderlyingFrom(address(this), actualAmountDebtToRepay); // uToken pulls from engine


        // 9. CorePool updates borrower's debt balance
        corePool.reduceBorrowBalanceForLiquidation(borrower, debtAssetToRepay, actualAmountDebtToRepay);

        // 10. CorePool transfers seized collateral (underlying) from borrower's uToken holdings to liquidator
        // This requires a new function in CorePool.
        corePool.seizeAndTransferCollateral(
            borrower,
            _msgSender(), // liquidator
            collateralAssetToSeize,
            amountCollateralToSeize
        );

        emit LiquidationCall(
            _msgSender(), borrower, debtAssetToRepay, actualAmountDebtToRepay,
            collateralAssetToSeize, amountCollateralToSeize,
            debtRepaidUsdValue, totalCollateralToSeizeUsdValue
        );
    }
}