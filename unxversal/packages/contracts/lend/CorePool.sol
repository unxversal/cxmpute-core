// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/ICorePoolLens.sol";
import "./uToken.sol"; // Actual uToken contract for casting and interaction
import "./interestModels/IInterestRateModel.sol";
import "./LendRiskController.sol"; // For permission checks
// LendLiquidationEngine is not directly called by CorePool but CorePool is called by it.
import "../common/libraries/SafeDecimalMath.sol";


/**
 * @title CorePool
 * @author Unxversal Team
 * @notice Central contract for Unxversal Lend, managing markets, user balances, and interest.
 */
contract CorePool is Ownable, ReentrancyGuard, Pausable, ICorePoolLens {
    using SafeERC20 for IERC20;
    using SafeDecimalMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // --- Market State ---
    struct Market {
        bool isListed;
        address uTokenAddress;
        address interestRateModel;
        uint256 totalBorrowsPrincipal;  // Sum of all outstanding borrow principals (before interest)
        uint256 totalReserves;          // Total underlying reserves accumulated
        uint256 borrowIndex;            // Accumulator for borrow interest, scaled by BORROW_INDEX_PRECISION
        uint256 reserveFactorMantissa;  // Share of borrow interest for reserves (1e18 scaled)
        uint256 lastAccrualBlock;
        uint8 underlyingDecimals;       // Decimals of the underlying asset
    }
    mapping(address => Market) public markets; // underlyingAssetAddress => Market
    EnumerableSet.AddressSet private _listedMarketUnderlyings;

    // --- User State ---
    struct UserBorrowData {
        uint256 principal;      // User's current borrow principal for this asset
        uint256 interestIndex;  // Market's borrowIndex when user's principal was last updated
    }
    mapping(address => mapping(address => UserBorrowData)) public userBorrowData; // user => underlyingAsset => Data
    mapping(address => EnumerableSet.AddressSet) private _userSuppliedAssets;
    mapping(address => EnumerableSet.AddressSet) private _userBorrowedAssets;

    // --- Dependencies ---
    LendRiskController public riskController;
    address public liquidationEngineAddress; // Authorized to update balances and seize collateral

    // --- Constants ---
    uint256 public constant BORROW_INDEX_PRECISION = 1e18;

    // --- Events ---
    event MarketListed(address indexed underlying, address indexed uToken, address indexed irm);
    event MarketInterestAccrued(address indexed underlying, uint256 newBorrowIndex, uint256 newTotalBorrowsPrincipal, uint256 newTotalReserves);
    event Supply(address indexed user, address indexed underlying, uint256 amountUnderlying, uint256 amountUTokensMinted);
    event Withdraw(address indexed user, address indexed underlying, uint256 amountUnderlying, uint256 amountUTokensBurned);
    event Borrow(address indexed user, address indexed underlying, uint256 amountBorrowed);
    event RepayBorrow(address indexed payer, address indexed borrower, address indexed underlying, uint256 amountRepaid, uint256 newBorrowPrincipal);
    event ReserveFactorSet(address indexed underlying, uint256 newReserveFactorMantissa);
    event NewInterestRateModel(address indexed underlying, address indexed newIrm);
    event RiskControllerSet(address indexed newRiskController);
    event LiquidationEngineSet(address indexed newEngine);
    event ReservesWithdrawn(address indexed underlying, address indexed recipient, uint256 amountWithdrawn);
    event CollateralSeized(address indexed borrower, address indexed liquidator, address indexed collateralAsset, uint256 amountUnderlyingSeized);


    constructor(address _riskControllerAddress, address _initialOwner) Ownable(_initialOwner) {
        setRiskController(_riskControllerAddress); // Emits event
    }

    // --- Admin Functions ---
    function setRiskController(address _newRiskControllerAddress) public onlyOwner {
        require(_newRiskControllerAddress != address(0), "CorePool: Zero RiskController");
        riskController = LendRiskController(_newRiskControllerAddress);
        emit RiskControllerSet(_newRiskControllerAddress);
    }

    function setLiquidationEngine(address _newEngineAddress) public onlyOwner {
        require(_newEngineAddress != address(0), "CorePool: Zero LiquidationEngine");
        liquidationEngineAddress = _newEngineAddress;
        emit LiquidationEngineSet(_newEngineAddress);
    }

    function listMarket(address underlyingAsset, address _uTokenAddress, address _irmAddress) external onlyOwner {
        require(underlyingAsset != address(0) && _uTokenAddress != address(0) && _irmAddress != address(0), "CorePool: Zero address");
        Market storage market = markets[underlyingAsset];
        require(!market.isListed, "CorePool: Market already listed"); // For updates, use specific setters

        // Validate uToken and IRM (basic checks)
        require(uToken(_uTokenAddress).underlying() == underlyingAsset, "CorePool: uToken mismatch");
        // IInterestRateModel(_irmAddress).getBorrowRate(0,0,0); // Test call, can be gas intensive or revert

        market.isListed = true;
        market.uTokenAddress = _uTokenAddress;
        market.interestRateModel = _irmAddress;
        market.borrowIndex = BORROW_INDEX_PRECISION;
        market.lastAccrualBlock = block.number;
        market.underlyingDecimals = IERC20(underlyingAsset).decimals();
        _listedMarketUnderlyings.add(underlyingAsset);

        emit MarketListed(underlyingAsset, _uTokenAddress, _irmAddress);
    }

    function setReserveFactor(address underlyingAsset, uint256 newReserveFactorMantissa) external onlyOwner {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(newReserveFactorMantissa <= BORROW_INDEX_PRECISION, "CorePool: Reserve factor too high");
        // Accrue interest before changing a parameter that affects its calculation
        accrueInterest(underlyingAsset);
        market.reserveFactorMantissa = newReserveFactorMantissa;
        emit ReserveFactorSet(underlyingAsset, newReserveFactorMantissa);
    }
    
    function setInterestRateModel(address underlyingAsset, address newIrmAddress) external onlyOwner {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(newIrmAddress != address(0), "CorePool: Zero IRM");
        // Accrue interest with old model before switching
        accrueInterest(underlyingAsset);
        market.interestRateModel = newIrmAddress;
        emit NewInterestRateModel(underlyingAsset, newIrmAddress);
    }

    function withdrawReserves(address underlyingAsset, uint256 amountToWithdraw, address recipient) external onlyOwner nonReentrant {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(recipient != address(0) && amountToWithdraw > 0, "CorePool: Invalid params");
        accrueInterest(underlyingAsset);
        require(market.totalReserves >= amountToWithdraw, "CorePool: Insufficient reserves");
        
        market.totalReserves -= amountToWithdraw;
        uToken(market.uTokenAddress).transferUnderlyingTo(recipient, amountToWithdraw);
        emit ReservesWithdrawn(underlyingAsset, recipient, amountToWithdraw);
    }

    function pause() public override onlyOwner { _pause(); } // OZ Pausable
    function unpause() public override onlyOwner { _unpause(); }


    // --- Interest Accrual ---
    function accrueInterest(address underlyingAsset) public override returns (uint256 newBorrowIndex) {
        Market storage market = markets[underlyingAsset];
        if (!market.isListed || market.lastAccrualBlock == block.number) {
            return market.borrowIndex;
        }

        uint256 currentTotalBorrowsPrincipal = market.totalBorrowsPrincipal;
        uint256 currentBorrowIndex = market.borrowIndex;
        uint256 currentTotalReserves = market.totalReserves;
        uint256 blockDelta = block.number - market.lastAccrualBlock;

        newBorrowIndex = currentBorrowIndex; // Default if no borrows

        if (currentTotalBorrowsPrincipal > 0 && blockDelta > 0) {
            IInterestRateModel irm = IInterestRateModel(market.interestRateModel);
            // Cash in uToken is its balance of underlying
            uint256 cashInUToken = IERC20(underlyingAsset).balanceOf(market.uTokenAddress);
            
            // Total current borrows with interest = principal * currentIndex / snapshotIndex (but we need rate)
            // The IRM takes current total borrows (with interest up to previous block)
            // For IRM, `totalBorrows` should be the current outstanding balance before new interest.
            uint256 totalBorrowsWithPrevInterest = currentTotalBorrowsPrincipal; // For IRM input, effectively

            uint256 borrowRatePerBlock = irm.getBorrowRate(
                cashInUToken, totalBorrowsWithPrevInterest, currentTotalReserves
            );

            // simpleInterestFactor = borrowRatePerBlock * blockDelta (both 1e18 scaled)
            uint256 simpleInterestFactor = borrowRatePerBlock.multiplyDecimal(blockDelta);
            uint256 interestAccumulated = totalBorrowsWithPrevInterest.multiplyDecimal(simpleInterestFactor);
            
            newBorrowIndex = currentBorrowIndex.multiplyDecimal(BORROW_INDEX_PRECISION + simpleInterestFactor);
            uint256 reservesAdded = interestAccumulated.multiplyDecimal(market.reserveFactorMantissa);
            
            market.totalBorrowsPrincipal = totalBorrowsWithPrevInterest + interestAccumulated - reservesAdded; // Principal grows by net interest
            market.totalReserves = currentTotalReserves + reservesAdded;
            market.borrowIndex = newBorrowIndex;
        }

        market.lastAccrualBlock = block.number;
        emit MarketInterestAccrued(underlyingAsset, newBorrowIndex, market.totalBorrowsPrincipal, market.totalReserves);
        return newBorrowIndex;
    }


    // --- User Operations ---
    function supply(address underlyingAsset, uint256 amount) external nonReentrant whenNotPaused {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(amount > 0, "CorePool: Zero supply");
        accrueInterest(underlyingAsset);

        uToken uTokenContract = uToken(payable(market.uTokenAddress)); // payable for OZv5 uToken constructor casting
        uint256 exchangeRate = uTokenContract.exchangeRateStored();
        require(exchangeRate > 0, "CorePool: Invalid exchange rate");

        // User (msg.sender) approves CorePool. CorePool pulls, then transfers to uToken.
        IERC20(underlyingAsset).safeTransferFrom(_msgSender(), address(uTokenContract), amount);

        uint256 uTokensToMint = Math.mulDiv(amount, BORROW_INDEX_PRECISION, exchangeRate); // (amount * 1e18) / exRate
        uTokenContract.mintTokens(_msgSender(), uTokensToMint);
        
        _userSuppliedAssets[_msgSender()].add(underlyingAsset);
        emit Supply(_msgSender(), underlyingAsset, amount, uTokensToMint);
    }

    function withdraw(address underlyingAsset, uint256 uTokensToRedeem) external nonReentrant whenNotPaused {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(uTokensToRedeem > 0, "CorePool: Zero redeem");
        accrueInterest(underlyingAsset);

        uToken uTokenContract = uToken(payable(market.uTokenAddress));
        uint256 exchangeRate = uTokenContract.exchangeRateStored();
        require(exchangeRate > 0, "CorePool: Invalid exchange rate");
        uint256 underlyingToWithdraw = Math.mulDiv(uTokensToRedeem, exchangeRate, BORROW_INDEX_PRECISION);

        require(address(riskController) != address(0), "CorePool: RiskController not set");
        riskController.preWithdrawCheck(_msgSender(), underlyingAsset, underlyingToWithdraw);

        // User must have uTokensToRedeem. uToken.burnTokens will check this.
        uTokenContract.burnTokens(_msgSender(), uTokensToRedeem);
        uTokenContract.transferUnderlyingTo(_msgSender(), underlyingToWithdraw);

        if (uTokenContract.balanceOf(_msgSender()) == 0) {
            _userSuppliedAssets[_msgSender()].remove(underlyingAsset);
        }
        emit Withdraw(_msgSender(), underlyingAsset, underlyingToWithdraw, uTokensToRedeem);
    }

    function borrow(address underlyingAsset, uint256 amountToBorrow) external nonReentrant whenNotPaused {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(amountToBorrow > 0, "CorePool: Zero borrow");
        uint256 currentMarketBorrowIndex = accrueInterest(underlyingAsset);

        require(address(riskController) != address(0), "CorePool: RiskController not set");
        riskController.preBorrowCheck(_msgSender(), underlyingAsset, amountToBorrow);

        uToken uTokenContract = uToken(payable(market.uTokenAddress));
        uint256 cashInUToken = IERC20(underlyingAsset).balanceOf(market.uTokenAddress);
        require(cashInUToken >= amountToBorrow, "CorePool: Insufficient market liquidity");

        UserBorrowData storage borrowData = userBorrowData[_msgSender()][underlyingAsset];
        uint256 accountBorrowsPrior = _getAccountBorrowBalanceSnapshot(borrowData, currentMarketBorrowIndex);
        uint256 newBorrowPrincipalSnapshot = accountBorrowsPrior + amountToBorrow;
        
        borrowData.principal = newBorrowPrincipalSnapshot;
        borrowData.interestIndex = currentMarketBorrowIndex;
        market.totalBorrowsPrincipal += amountToBorrow; // Add to market's principal debt

        uTokenContract.transferUnderlyingTo(_msgSender(), amountToBorrow);
        _userBorrowedAssets[_msgSender()].add(underlyingAsset);
        emit Borrow(_msgSender(), underlyingAsset, amountToBorrow);
    }

    function repayBorrow(address underlyingAsset, uint256 amountToRepay) external nonReentrant whenNotPaused {
        _repayBorrowInternal(_msgSender(), _msgSender(), underlyingAsset, amountToRepay);
    }

    function repayBorrowBehalf(address borrower, address underlyingAsset, uint256 amountToRepay) external nonReentrant whenNotPaused {
        _repayBorrowInternal(_msgSender(), borrower, underlyingAsset, amountToRepay);
    }

    function _repayBorrowInternal(address payer, address borrower, address underlyingAsset, uint256 amountToRepayInput) internal {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(amountToRepayInput > 0, "CorePool: Zero repay");
        uint256 currentMarketBorrowIndex = accrueInterest(underlyingAsset);

        UserBorrowData storage borrowData = userBorrowData[borrower][underlyingAsset];
        uint256 accountBorrowsPrior = _getAccountBorrowBalanceSnapshot(borrowData, currentMarketBorrowIndex);
        require(accountBorrowsPrior > 0, "CorePool: No outstanding borrow");

        uint256 actualRepayAmount;
        if (amountToRepayInput == type(uint256).max || amountToRepayInput >= accountBorrowsPrior) {
            actualRepayAmount = accountBorrowsPrior;
            borrowData.principal = 0;
            borrowData.interestIndex = 0; // Cleared
            _userBorrowedAssets[borrower].remove(underlyingAsset);
        } else {
            actualRepayAmount = amountToRepayInput;
            borrowData.principal = accountBorrowsPrior - actualRepayAmount;
            borrowData.interestIndex = currentMarketBorrowIndex;
        }

        market.totalBorrowsPrincipal -= actualRepayAmount; // Reduce market's principal debt
        uToken uTokenContract = uToken(payable(market.uTokenAddress));
        IERC20(underlyingAsset).safeTransferFrom(payer, address(uTokenContract), actualRepayAmount);

        emit RepayBorrow(payer, borrower, underlyingAsset, actualRepayAmount, borrowData.principal);
    }

    /** @dev Gets snapshot of borrow balance based on stored principal and market index. */
    function _getAccountBorrowBalanceSnapshot(UserBorrowData storage borrowData, uint256 marketBorrowIndex)
        internal view returns (uint256)
    {
        if (borrowData.principal == 0) return 0;
        return Math.mulDiv(borrowData.principal, marketBorrowIndex, borrowData.interestIndex);
    }

    // --- Liquidation Hooks ---
    modifier onlyLiquidationEngine() {
        require(_msgSender() == liquidationEngineAddress, "CorePool: Caller not LiquidationEngine");
        _;
    }

    function reduceBorrowBalanceForLiquidation(
        address borrower, address underlyingAsset, uint256 amountRepaidByLiquidator
    ) external nonReentrant onlyLiquidationEngine {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed for liq reduce");
        uint256 currentMarketBorrowIndex = accrueInterest(underlyingAsset);

        UserBorrowData storage borrowData = userBorrowData[borrower][underlyingAsset];
        uint256 accountBorrowsPrior = _getAccountBorrowBalanceSnapshot(borrowData, currentMarketBorrowIndex);
        require(accountBorrowsPrior >= amountRepaidByLiquidator, "CorePool: Liq repay > borrow bal");

        uint256 accountBorrowsNewPrincipal = accountBorrowsPrior - amountRepaidByLiquidator;
        borrowData.principal = accountBorrowsNewPrincipal;
        borrowData.interestIndex = currentMarketBorrowIndex;
        if (accountBorrowsNewPrincipal == 0) {
             _userBorrowedAssets[borrower].remove(underlyingAsset);
        }
        market.totalBorrowsPrincipal -= amountRepaidByLiquidator;
        // Note: The actual underlying tokens for this repayment are handled by LendLiquidationEngine
        // by transferring them to the debtAsset's uToken.
        emit RepayBorrow(liquidationEngineAddress, borrower, underlyingAsset, amountRepaidByLiquidator, accountBorrowsNewPrincipal);
    }

    /**
     * @notice Called by the LiquidationEngine to facilitate a debt repayment by a liquidator on behalf of a borrower.
     * @dev The liquidator must have approved CorePool to spend `amountToRepay` of `underlyingAsset`.
     *      This function is essentially a specialized version of `repayBorrowBehalf` for liquidations.
     * @param liquidator The address of the liquidator who is providing the funds for repayment.
     * @param borrower The address of the user whose borrow is being repaid.
     * @param underlyingAsset The address of the underlying asset being repaid.
     * @param amountToRepay The amount of underlying asset to repay.
     */
    function repayBorrowBehalfByEngine(
        address liquidator,
        address borrower,
        address underlyingAsset,
        uint256 amountToRepay
    ) external nonReentrant onlyLiquidationEngine { // Note: no whenNotPaused, liquidation should work even if user actions are paused
        // Call the existing internal repay logic, but with `liquidator` as the payer
        _repayBorrowInternal(liquidator, borrower, underlyingAsset, amountToRepay);
    }

    function seizeAndTransferCollateral(
        address borrower, address liquidator,
        address underlyingCollateralAsset, uint256 amountUnderlyingToSeize
    ) external nonReentrant onlyLiquidationEngine {
        Market storage market = markets[underlyingCollateralAsset];
        require(market.isListed, "CorePool: Collateral market not listed for seize");
        require(amountUnderlyingToSeize > 0, "CorePool: Zero seize amount");
        accrueInterest(underlyingCollateralAsset);

        uToken uTokenCollateral = uToken(payable(market.uTokenAddress));
        uint256 exchangeRate = uTokenCollateral.exchangeRateStored();
        require(exchangeRate > 0, "CorePool: Invalid collateral exchange rate");

        // Calculate uTokens corresponding to the amount of underlying to seize
        uint256 uTokensToSeize = Math.mulDiv(amountUnderlyingToSeize, BORROW_INDEX_PRECISION, exchangeRate);
        require(uTokenCollateral.balanceOf(borrower) >= uTokensToSeize, "CorePool: Borrower insufficient uTokens to seize");

        // Burn borrower's uTokens representing the seized collateral portion
        uTokenCollateral.burnTokens(borrower, uTokensToSeize);
        // Transfer the underlying collateral from uToken contract to the liquidator
        uTokenCollateral.transferUnderlyingTo(liquidator, amountUnderlyingToSeize);

        if (uTokenCollateral.balanceOf(borrower) == 0) {
            _userSuppliedAssets[borrower].remove(underlyingCollateralAsset);
        }
        emit CollateralSeized(borrower, liquidator, underlyingCollateralAsset, amountUnderlyingToSeize);
    }

    // --- ICorePoolLens Implementation ---
    function getUserSupplyAndBorrowBalance(address user, address underlyingAsset)
        external view override
        returns (uint256 uTokenSupplyBalance, uint256 underlyingBorrowBalanceWithInterest)
    {
        Market storage market = markets[underlyingAsset];
        if (!market.isListed) return (0, 0);
        uTokenSupplyBalance = uToken(market.uTokenAddress).balanceOf(user);
        
        uint256 marketIdx = _getViewMarketBorrowIndex(underlyingAsset);
        underlyingBorrowBalanceWithInterest = _getAccountBorrowBalanceSnapshot(userBorrowData[user][underlyingAsset], marketIdx);
    }

    function getAssetsUserSupplied(address user) external view override returns (address[] memory) {
        return _userSuppliedAssets[user].values();
    }

    function getAssetsUserBorrowed(address user) external view override returns (address[] memory) {
        return _userBorrowedAssets[user].values();
    }

    function getUTokenForUnderlying(address underlyingAsset) external view override returns (address) {
        return markets[underlyingAsset].uTokenAddress;
    }

    function getInterestRateModelForUnderlying(address underlyingAsset) external view override returns (address) {
        return markets[underlyingAsset].interestRateModel;
    }

    // --- Public View Functions for Market State ---
    function _getViewMarketBorrowIndex(address underlyingAsset) internal view returns (uint256) {
        Market storage market = markets[underlyingAsset];
        if (!market.isListed || market.lastAccrualBlock == block.number || market.totalBorrowsPrincipal == 0) {
            return market.borrowIndex;
        }
        uint256 blockDelta = block.number - market.lastAccrualBlock;
        IInterestRateModel irm = IInterestRateModel(market.interestRateModel);
        uint256 cash = IERC20(underlyingAsset).balanceOf(market.uTokenAddress);
        uint256 simpleInterestFactor = irm.getBorrowRate(
            cash, market.totalBorrowsPrincipal, market.totalReserves
        ).multiplyDecimal(blockDelta);
        return market.borrowIndex.multiplyDecimal(BORROW_INDEX_PRECISION + simpleInterestFactor);
    }

    function totalBorrowsCurrent(address underlyingAsset) external view returns (uint256) {
        Market storage market = markets[underlyingAsset];
        if (!market.isListed || market.totalBorrowsPrincipal == 0) return 0;
        uint256 marketIdx = _getViewMarketBorrowIndex(underlyingAsset);
        // This is not quite right. totalBorrowsPrincipal needs to be scaled by marketIdx / some_initial_index (which is 1e18)
        // Total borrows principal already includes accrued interest conceptually.
        // The `market.totalBorrowsPrincipal` after accrual *is* the current total borrows.
        // So, for a view, we need to simulate the accrual's effect on `totalBorrowsPrincipal`.
        
        if (market.lastAccrualBlock == block.number) return market.totalBorrowsPrincipal;
        
        uint256 blockDelta = block.number - market.lastAccrualBlock;
        IInterestRateModel irm = IInterestRateModel(market.interestRateModel);
        uint256 cash = IERC20(underlyingAsset).balanceOf(market.uTokenAddress);
        uint256 borrowRate = irm.getBorrowRate(cash, market.totalBorrowsPrincipal, market.totalReserves);
        uint256 interestAccumulated = market.totalBorrowsPrincipal.multiplyDecimal(borrowRate.multiplyDecimal(blockDelta));
        return market.totalBorrowsPrincipal + interestAccumulated - interestAccumulated.multiplyDecimal(market.reserveFactorMantissa);
    }

    function totalReserves(address underlyingAsset) external view override returns (uint256) {
        Market storage market = markets[underlyingAsset];
         if (!market.isListed || market.lastAccrualBlock == block.number || market.totalBorrowsPrincipal == 0) {
            return market.totalReserves;
        }
        uint256 blockDelta = block.number - market.lastAccrualBlock;
        IInterestRateModel irm = IInterestRateModel(market.interestRateModel);
        uint256 cash = IERC20(underlyingAsset).balanceOf(market.uTokenAddress);
        uint256 borrowRate = irm.getBorrowRate(cash, market.totalBorrowsPrincipal, market.totalReserves);
        uint256 interestAccumulated = market.totalBorrowsPrincipal.multiplyDecimal(borrowRate.multiplyDecimal(blockDelta));
        uint256 reservesAdded = interestAccumulated.multiplyDecimal(market.reserveFactorMantissa);
        return market.totalReserves + reservesAdded;
    }

    function getMarketBorrowIndex(address underlyingAsset) external view returns (uint256) {
        return _getViewMarketBorrowIndex(underlyingAsset);
    }

     function getMarketState(address underlyingAsset) external view returns (
        uint256 _totalBorrows, uint256 _totalReserves, uint256 _borrowIndex,
        uint256 _lastAccrualBlock, uint256 _reserveFactorMantissa, uint8 _underlyingDecimals
    ) {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        // For view, simulate accrual to show current values
        _totalBorrows = totalBorrowsCurrent(underlyingAsset);
        _totalReserves = totalReserves(underlyingAsset);
        _borrowIndex = _getViewMarketBorrowIndex(underlyingAsset);
        _lastAccrualBlock = market.lastAccrualBlock; // Stored last accrual
        _reserveFactorMantissa = market.reserveFactorMantissa;
        _underlyingDecimals = market.underlyingDecimals;
    }
}