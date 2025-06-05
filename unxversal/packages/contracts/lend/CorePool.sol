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
import "./uToken.sol"; // Now uToken.sol directly, not just interface, for casting
import "./interestModels/IInterestRateModel.sol";
import "./LendRiskController.sol"; // For permission checks
// LendLiquidationEngine is not directly called by CorePool typically, but might update it.
// import "./LendLiquidationEngine.sol";
import "../common/libraries/SafeDecimalMath.sol";


/**
 * @title CorePool
 * @author Unxversal Team
 * @notice Central contract for Unxversal Lend protocol, managing markets, user balances, and interest.
 * @dev Handles supply, borrow, withdraw, repay operations, interacting with uTokens,
 *      InterestRateModels, and LendRiskController.
 */
contract CorePool is Ownable, ReentrancyGuard, Pausable, ICorePoolLens {
    using SafeERC20 for IERC20;
    using SafeDecimalMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // --- Market State ---
    struct Market {
        bool isListed;
        address uTokenAddress;          // Address of the associated uToken
        address interestRateModel;    // Address of the IInterestRateModel for this market
        uint256 totalBorrows;           // Total underlying currently borrowed out
        uint256 totalReserves;          // Total underlying reserves accumulated from interest
        uint256 borrowIndex;            // Accumulator for borrow interest, scaled by 1e18
        uint256 reserveFactorMantissa;  // Share of borrow interest allocated to reserves (1e18 scaled, e.g., 0.1e18 for 10%)
        uint256 lastAccrualBlock;       // Block number of last interest accrual
        // uint8 underlyingDecimals;    // Decimals of the underlying asset
    }
    mapping(address => Market) public markets; // underlyingAssetAddress => Market
    EnumerableSet.AddressSet private listedMarketUnderlyings; // Tracks all listed underlying assets

    // --- User State ---
    // User's uToken balances are tracked by the uToken contracts (uToken.balanceOf(user)).
    // User's borrow balances are tracked here.
    struct UserBorrowData {
        uint256 principal;      // Total principal borrowed by user for this asset (raw underlying amount)
        uint256 interestIndex;  // The market's borrowIndex when user last borrowed/repaid this asset
    }
    mapping(address => mapping(address => UserBorrowData)) public userBorrowData; // user => underlyingAsset => Data

    // To implement getAssetsUserSupplied/Borrowed efficiently for ICorePoolLens
    mapping(address => EnumerableSet.AddressSet) private _userSuppliedAssets; // user => set of underlying assets they supplied
    mapping(address => EnumerableSet.AddressSet) private _userBorrowedAssets; // user => set of underlying assets they borrowed

    // --- Dependencies ---
    LendRiskController public riskController;
    address public liquidationEngineAddress; // Authorized to update borrow balances during liquidation

    // --- Constants ---
    uint256 public constant BORROW_INDEX_PRECISION = 1e18; // borrowIndex is scaled by this

    // --- Events ---
    event MarketListed(address indexed underlying, address indexed uToken, address indexed interestRateModel);
    event MarketInterestAccrued(address indexed underlying, uint256 newBorrowIndex, uint256 newTotalBorrows, uint256 newTotalReserves);
    event Supply(address indexed user, address indexed underlying, uint256 amountUnderlying, uint256 amountUTokensMinted);
    event Withdraw(address indexed user, address indexed underlying, uint256 amountUnderlying, uint256 amountUTokensBurned);
    event Borrow(address indexed user, address indexed underlying, uint256 amountBorrowed);
    event RepayBorrow(address indexed payer, address indexed borrower, address indexed underlying, uint256 amountRepaid, uint256 newBorrowBalance);
    event ReserveFactorSet(address indexed underlying, uint256 newReserveFactorMantissa);
    event NewInterestRateModel(address indexed underlying, address indexed newIrm);
    event RiskControllerSet(address indexed newRiskController);
    event LiquidationEngineSet(address indexed newEngine);
    // event ReservesAdded(address indexed underlying, uint256 amountAdded, uint256 newTotalReserves); // Covered by MarketInterestAccrued
    event ReservesWithdrawn(address indexed underlying, address indexed recipient, uint256 amountWithdrawn);


    constructor(address _riskControllerAddress, address _initialOwner) Ownable(_initialOwner) {
        setRiskController(_riskControllerAddress);
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

    /**
     * @notice Lists a new asset market or updates its uToken/IRM.
     * @dev Only callable by the owner (LendAdmin). uToken and IRM must be valid contracts.
     *      Initializes borrowIndex to BORROW_INDEX_PRECISION.
     * @param underlyingAsset The address of the underlying ERC20 token.
     * @param _uTokenAddress The address of the uToken contract for this market.
     * @param _irmAddress The address of the IInterestRateModel for this market.
     */
    function listMarket(address underlyingAsset, address _uTokenAddress, address _irmAddress) external onlyOwner {
        require(underlyingAsset != address(0), "CorePool: Zero underlying");
        require(_uTokenAddress != address(0), "CorePool: Zero uToken");
        require(_irmAddress != address(0), "CorePool: Zero IRM");

        Market storage market = markets[underlyingAsset];
        require(!market.isListed || market.uTokenAddress != _uTokenAddress || market.interestRateModel != _irmAddress,
                "CorePool: Market already listed with same params or no change");

        // Basic checks on the provided contracts (can be more thorough)
        require(uToken(_uTokenAddress).underlying() == underlyingAsset, "CorePool: uToken underlying mismatch");
        // IInterestRateModel(_irmAddress).getBorrowRate(0,0,0); // Try to call to check if it's a valid IRM (can revert)

        if (!market.isListed) {
            market.isListed = true;
            market.borrowIndex = BORROW_INDEX_PRECISION; // Initial borrow index
            market.lastAccrualBlock = block.number;
            // market.underlyingDecimals = IERC20(underlyingAsset).decimals(); // Store for convenience
            listedMarketUnderlyings.add(underlyingAsset);
        }
        
        market.uTokenAddress = _uTokenAddress;
        market.interestRateModel = _irmAddress;
        // totalBorrows and totalReserves remain or are 0 if new.

        emit MarketListed(underlyingAsset, _uTokenAddress, _irmAddress);
    }

    function setReserveFactor(address underlyingAsset, uint256 newReserveFactorMantissa) external onlyOwner {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(newReserveFactorMantissa <= BORROW_INDEX_PRECISION, "CorePool: Reserve factor too high"); // Max 100%
        market.reserveFactorMantissa = newReserveFactorMantissa;
        emit ReserveFactorSet(underlyingAsset, newReserveFactorMantissa);
    }
    
    function setInterestRateModel(address underlyingAsset, address newIrmAddress) external onlyOwner {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(newIrmAddress != address(0), "CorePool: Zero IRM");
        market.interestRateModel = newIrmAddress;
        emit NewInterestRateModel(underlyingAsset, newIrmAddress);
    }

    /**
     * @notice Allows owner to withdraw accumulated reserves for a market.
     * @param underlyingAsset The market from which to withdraw reserves.
     * @param amountToWithdraw The amount of underlying reserves to withdraw.
     * @param recipient The address to send the withdrawn reserves to (e.g., Treasury).
     */
    function withdrawReserves(address underlyingAsset, uint256 amountToWithdraw, address recipient) external onlyOwner nonReentrant {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(recipient != address(0), "CorePool: Zero recipient");
        require(amountToWithdraw > 0, "CorePool: Zero withdraw amount");

        accrueInterest(underlyingAsset); // Ensure reserves are up-to-date

        require(market.totalReserves >= amountToWithdraw, "CorePool: Insufficient reserves");
        market.totalReserves -= amountToWithdraw;
        
        // Reserves are held within the uToken contract. Instruct uToken to transfer them out.
        uToken(market.uTokenAddress).transferUnderlyingTo(recipient, amountToWithdraw);
        emit ReservesWithdrawn(underlyingAsset, recipient, amountToWithdraw);
    }

    function pauseProtocol() external onlyOwner { _pause(); }
    function unpauseProtocol() external onlyOwner { _unpause(); }


    // --- Core Logic ---

    /**
     * @notice Accrues interest for a market, updating its borrowIndex, totalBorrows, and totalReserves.
     * @param underlyingAsset The underlying asset of the market to accrue interest for.
     * @return newBorrowIndex The updated borrow index for the market.
     */
    function accrueInterest(address underlyingAsset) public virtual returns (uint256 newBorrowIndex) {
        Market storage market = markets[underlyingAsset];
        if (!market.isListed) return market.borrowIndex; // Market not listed, no accrual
        if (market.lastAccrualBlock == block.number) return market.borrowIndex; // Already accrued this block

        uint256 currentTotalBorrows = market.totalBorrows;
        uint256 currentBorrowIndex = market.borrowIndex;
        uint256 currentTotalReserves = market.totalReserves;
        uint256 blockDelta = block.number - market.lastAccrualBlock;

        if (currentTotalBorrows > 0 && blockDelta > 0) {
            IInterestRateModel irm = IInterestRateModel(market.interestRateModel);
            uint256 cashInUToken = IERC20(underlyingAsset).balanceOf(market.uTokenAddress); // This is slightly off, uToken holds underlying

            // Correct cash: uToken contract holds underlying.
            uint256 uTokenUnderlyingBalance = IERC20(uToken(market.uTokenAddress).underlying()).balanceOf(market.uTokenAddress);


            uint256 simpleInterestFactor = irm.getBorrowRate(
                uTokenUnderlyingBalance, // Cash available for lending
                currentTotalBorrows,
                currentTotalReserves  // Reserves are part of (cash + borrows)
            ).multiplyDecimal(blockDelta); // ratePerBlock * numBlocks

            uint256 interestAccumulated = currentTotalBorrows.multiplyDecimal(simpleInterestFactor);
            
            newBorrowIndex = currentBorrowIndex.multiplyDecimal(BORROW_INDEX_PRECISION + simpleInterestFactor); // (1 + simpleInterestFactor)
            uint256 reservesAdded = interestAccumulated.multiplyDecimal(market.reserveFactorMantissa);
            
            market.totalBorrows = currentTotalBorrows + interestAccumulated;
            market.totalReserves = currentTotalReserves + reservesAdded;
            market.borrowIndex = newBorrowIndex;
        } else {
            newBorrowIndex = currentBorrowIndex; // No borrows or no time passed, index unchanged
        }

        market.lastAccrualBlock = block.number;
        emit MarketInterestAccrued(underlyingAsset, newBorrowIndex, market.totalBorrows, market.totalReserves);
        return newBorrowIndex;
    }


    /**
     * @notice User supplies underlying assets to a market.
     * @param underlyingAsset The address of the underlying asset to supply.
     * @param amount The amount of underlying asset to supply.
     */
    function supply(address underlyingAsset, uint256 amount) external nonReentrant whenNotPaused {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(amount > 0, "CorePool: Zero supply amount");

        accrueInterest(underlyingAsset); // Accrue interest before any balance changes

        uToken uTokenContract = uToken(market.uTokenAddress);
        uint256 exchangeRate = uTokenContract.exchangeRateStored(); // Get rate AFTER interest accrual
        require(exchangeRate > 0, "CorePool: Invalid exchange rate");

        // User must have approved this CorePool contract for the underlying tokens
        IERC20(uTokenContract.underlying()).safeTransferFrom(_msgSender(), address(uTokenContract), amount);
        // Tokens go directly to the uToken contract, which holds them.

        // Calculate uTokens to mint: amountUnderlying * 1e18 / exchangeRate
        uint256 uTokensToMint = amount.multiplyDecimal(exchangeRate); // (amount * 1e18) / exchangeRate
                                                                      // (amount * 1e18) / ((cash+borrows-reserves)*1e18 / uTotalSupply)
                                                                      // = amount * uTotalSupply / (cash+borrows-reserves)

        uTokenContract.mintTokens(_msgSender(), uTokensToMint);
        _userSuppliedAssets[_msgSender()].add(underlyingAsset);

        emit Supply(_msgSender(), underlyingAsset, amount, uTokensToMint);
        // No direct risk check on supply, as it improves user's collateral position generally.
    }

    /**
     * @notice User withdraws underlying assets by redeeming their uTokens.
     * @param underlyingAsset The address of the underlying asset to withdraw.
     * @param uTokensToRedeem The amount of uTokens to redeem.
     */
    function withdraw(address underlyingAsset, uint256 uTokensToRedeem) external nonReentrant whenNotPaused {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(uTokensToRedeem > 0, "CorePool: Zero redeem amount");

        accrueInterest(underlyingAsset);

        uToken uTokenContract = uToken(market.uTokenAddress);
        uint256 exchangeRate = uTokenContract.exchangeRateStored();
        require(exchangeRate > 0, "CorePool: Invalid exchange rate");

        // Amount of underlying to withdraw: uTokensToRedeem * exchangeRate / 1e18
        uint256 underlyingToWithdraw = uTokensToRedeem.multiplyDecimal(exchangeRate); // (uTokens * exRate) / 1e18

        // Risk Check: Ensure withdrawal doesn't make user undercollateralized
        require(address(riskController) != address(0), "CorePool: RiskController not set");
        riskController.preWithdrawCheck(_msgSender(), underlyingAsset, underlyingToWithdraw);

        // Burn user's uTokens
        uTokenContract.burnTokens(_msgSender(), uTokensToRedeem); // CorePool tells uToken to burn from user

        // Transfer underlying from uToken contract to user
        uTokenContract.transferUnderlyingTo(_msgSender(), underlyingToWithdraw);

        if (uTokenContract.balanceOf(_msgSender()) == 0) {
            _userSuppliedAssets[_msgSender()].remove(underlyingAsset);
        }
        emit Withdraw(_msgSender(), underlyingAsset, underlyingToWithdraw, uTokensToRedeem);
    }

    /**
     * @notice User borrows an underlying asset from a market.
     * @param underlyingAsset The address of the underlying asset to borrow.
     * @param amountToBorrow The amount of underlying asset to borrow.
     */
    function borrow(address underlyingAsset, uint256 amountToBorrow) external nonReentrant whenNotPaused {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(amountToBorrow > 0, "CorePool: Zero borrow amount");

        uint256 newBorrowIndex = accrueInterest(underlyingAsset); // Accrue market interest first

        // Risk Check: Ensure user has enough collateral
        require(address(riskController) != address(0), "CorePool: RiskController not set");
        riskController.preBorrowCheck(_msgSender(), underlyingAsset, amountToBorrow);

        uToken uTokenContract = uToken(market.uTokenAddress);
        uint256 cashInUToken = IERC20(uTokenContract.underlying()).balanceOf(market.uTokenAddress);
        require(cashInUToken >= amountToBorrow, "CorePool: Insufficient liquidity in market");

        // Update user's borrow balance and snapshot
        UserBorrowData storage borrowData = userBorrowData[_msgSender()][underlyingAsset];
        uint256 accountBorrowsPrior = _calculateAccountBorrowBalance(borrowData, newBorrowIndex);
        uint256 accountBorrowsNew = accountBorrowsPrior + amountToBorrow;
        
        borrowData.principal = accountBorrowsNew; // Store new total principal (which is already interest-compounded)
        borrowData.interestIndex = newBorrowIndex; // Snapshot current market index

        market.totalBorrows += amountToBorrow; // Increase market total borrows

        // Transfer underlying from uToken contract to user
        uTokenContract.transferUnderlyingTo(_msgSender(), amountToBorrow);

        _userBorrowedAssets[_msgSender()].add(underlyingAsset);
        emit Borrow(_msgSender(), underlyingAsset, amountToBorrow);
    }

    /**
     * @notice User repays their borrowed underlying asset.
     * @param underlyingAsset The address of the underlying asset being repaid.
     * @param amountToRepay The amount of underlying asset to repay. Use type(uint256).max for full repayment.
     */
    function repayBorrow(address underlyingAsset, uint256 amountToRepay) external nonReentrant whenNotPaused {
        _repayBorrowInternal(_msgSender(), _msgSender(), underlyingAsset, amountToRepay);
    }

    /**
     * @notice A third party repays a borrow on behalf of a user.
     * @param borrower The address of the user whose borrow is being repaid.
     * @param underlyingAsset The address of the underlying asset being repaid.
     * @param amountToRepay The amount of underlying asset to repay. Use type(uint256).max for full repayment.
     */
    function repayBorrowBehalf(address borrower, address underlyingAsset, uint256 amountToRepay) external nonReentrant whenNotPaused {
        _repayBorrowInternal(_msgSender(), borrower, underlyingAsset, amountToRepay);
    }

    function _repayBorrowInternal(address payer, address borrower, address underlyingAsset, uint256 amountToRepayInput) internal {
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed");
        require(amountToRepayInput > 0, "CorePool: Zero repay amount");

        uint256 newBorrowIndex = accrueInterest(underlyingAsset);

        UserBorrowData storage borrowData = userBorrowData[borrower][underlyingAsset];
        uint256 accountBorrowsPrior = _calculateAccountBorrowBalance(borrowData, newBorrowIndex);
        require(accountBorrowsPrior > 0, "CorePool: No outstanding borrow for asset");

        uint256 actualRepayAmount;
        if (amountToRepayInput == type(uint256).max || amountToRepayInput >= accountBorrowsPrior) {
            actualRepayAmount = accountBorrowsPrior; // Full repayment
            borrowData.principal = 0;
            borrowData.interestIndex = 0; // Or newBorrowIndex, but 0 signifies cleared debt
            _userBorrowedAssets[borrower].remove(underlyingAsset);
        } else {
            actualRepayAmount = amountToRepayInput;
            borrowData.principal = accountBorrowsPrior - actualRepayAmount;
            borrowData.interestIndex = newBorrowIndex; // Update index for remaining principal
        }

        market.totalBorrows -= actualRepayAmount; // Decrease market total borrows

        // Payer must have approved this CorePool contract for the underlying tokens
        // Tokens are transferred from payer to the uToken contract (where liquidity is pooled)
        uToken uTokenContract = uToken(market.uTokenAddress);
        IERC20(uTokenContract.underlying()).safeTransferFrom(payer, address(uTokenContract), actualRepayAmount);

        emit RepayBorrow(payer, borrower, underlyingAsset, actualRepayAmount, borrowData.principal);
    }

    /** @dev Calculates a user's current borrow balance including accrued interest. */
    function _calculateAccountBorrowBalance(UserBorrowData storage borrowData, uint256 marketBorrowIndex)
        internal view returns (uint256)
    {
        if (borrowData.principal == 0) return 0;
        // balance = principal * marketBorrowIndex / userSnapshotIndex
        return borrowData.principal.multiplyDecimal(marketBorrowIndex).divideDecimal(borrowData.interestIndex);
    }


    // --- Liquidation Interaction ---
    /**
     * @notice Called by the LiquidationEngine to reduce a user's borrow balance after a liquidation event.
     * @dev Only callable by the authorized LiquidationEngine.
     * @param borrower The user whose borrow is being reduced.
     * @param underlyingAsset The asset for which the borrow is reduced.
     * @param amountRepaidByLiquidator The amount of underlying asset effectively repaid.
     */
    function reduceBorrowBalanceForLiquidation(
        address borrower,
        address underlyingAsset,
        uint256 amountRepaidByLiquidator
    ) external nonReentrant {
        require(msg.sender == liquidationEngineAddress, "CorePool: Caller not LiquidationEngine");
        Market storage market = markets[underlyingAsset];
        require(market.isListed, "CorePool: Market not listed for liq");

        uint256 newBorrowIndex = accrueInterest(underlyingAsset); // Accrue first

        UserBorrowData storage borrowData = userBorrowData[borrower][underlyingAsset];
        uint256 accountBorrowsPrior = _calculateAccountBorrowBalance(borrowData, newBorrowIndex);
        
        require(accountBorrowsPrior >= amountRepaidByLiquidator, "CorePool: Liq repay > borrow balance");

        uint256 accountBorrowsNew = accountBorrowsPrior - amountRepaidByLiquidator;
        
        borrowData.principal = accountBorrowsNew;
        borrowData.interestIndex = newBorrowIndex;
        if (accountBorrowsNew == 0) {
             _userBorrowedAssets[borrower].remove(underlyingAsset);
        }

        market.totalBorrows -= amountRepaidByLiquidator;

        // Event for this specific action, or rely on LiquidationEngine's event
        emit RepayBorrow(liquidationEngineAddress, borrower, underlyingAsset, amountRepaidByLiquidator, accountBorrowsNew);
    }

    // --- ICorePoolLens Implementation (View Functions) ---
    function getUserSupplyAndBorrowBalance(address user, address underlyingAsset)
        external view override
        returns (uint256 uTokenSupplyBalance, uint256 underlyingBorrowBalance)
    {
        Market storage market = markets[underlyingAsset];
        if (!market.isListed) return (0, 0);

        uTokenSupplyBalance = uToken(market.uTokenAddress).balanceOf(user);
        
        // For borrow balance, need to apply current interest
        uint256 marketBorrowIndex = market.borrowIndex;
        if (market.lastAccrualBlock != block.number && market.totalBorrows > 0) {
            // Simulate accrual for view function without state change
            uint256 blockDelta = block.number - market.lastAccrualBlock;
            IInterestRateModel irm = IInterestRateModel(market.interestRateModel);
            uint256 uTokenUnderlyingBalance = IERC20(uToken(market.uTokenAddress).underlying()).balanceOf(market.uTokenAddress);
            uint256 simpleInterestFactor = irm.getBorrowRate(
                uTokenUnderlyingBalance, market.totalBorrows, market.totalReserves
            ).multiplyDecimal(blockDelta);
            marketBorrowIndex = market.borrowIndex.multiplyDecimal(BORROW_INDEX_PRECISION + simpleInterestFactor);
        }
        underlyingBorrowBalance = _calculateAccountBorrowBalance(userBorrowData[user][underlyingAsset], marketBorrowIndex);
    }

    function getAssetsUserSupplied(address user) external view override returns (address[] memory) {
        return _userSuppliedAssets[user].values();
    }

    function getAssetsUserBorrowed(address user) external view override returns (address[] memory) {
        return _userBorrowedAssets[user].values();
    }

    function getUTokenForUnderlying(address underlyingAsset) external view override returns (address) {
        return markets[underlyingAsset].uTokenAddress; // Returns address(0) if not listed
    }

    function getInterestRateModelForUnderlying(address underlyingAsset) external view override returns (address) {
        return markets[underlyingAsset].interestRateModel; // Returns address(0) if not listed
    }

    // --- Public View Functions for Market State ---
    function totalBorrowsCurrent(address underlyingAsset) external view returns (uint256) {
        // Note: This does NOT accrue interest. For latest, call accrueInterest then read market.totalBorrows
        // Or, for a pure view, simulate accrual like in getUserSupplyAndBorrowBalance
        Market storage market = markets[underlyingAsset];
        if (!market.isListed || market.lastAccrualBlock == block.number || market.totalBorrows == 0) {
            return market.totalBorrows;
        }
        uint256 blockDelta = block.number - market.lastAccrualBlock;
        IInterestRateModel irm = IInterestRateModel(market.interestRateModel);
        uint256 uTokenUnderlyingBalance = IERC20(uToken(market.uTokenAddress).underlying()).balanceOf(market.uTokenAddress);
        uint256 simpleInterestFactor = irm.getBorrowRate(
            uTokenUnderlyingBalance, market.totalBorrows, market.totalReserves
        ).multiplyDecimal(blockDelta);
        return market.totalBorrows + market.totalBorrows.multiplyDecimal(simpleInterestFactor);
    }

    function totalReserves(address underlyingAsset) external view returns (uint256) {
        // Similar to totalBorrowsCurrent, this is a snapshot unless accrued.
        // For a pure view, would need to simulate accrual.
        return markets[underlyingAsset].totalReserves; // Returns stored value; accrueInterest updates it.
    }

    function getMarketBorrowIndex(address underlyingAsset) external view returns (uint256) {
        // Similar to totalBorrowsCurrent, this is a snapshot unless accrued.
        return markets[underlyingAsset].borrowIndex;
    }
}