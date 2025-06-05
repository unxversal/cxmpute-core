// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol"; // For burning uTokens
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // uToken itself is Ownable by CorePool or LendAdmin for init
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../common/libraries/SafeDecimalMath.sol"; // For exchange rate math

// Forward declaration or interface for CorePool to avoid circular deps if CorePool imports uToken interface
interface ICorePool {
    function accrueInterest(address uTokenAddress) external returns (uint256 newBorrowIndex);
    function totalBorrowsCurrent(address uTokenAddress) external view returns (uint256);
    function totalReserves(address uTokenAddress) external view returns (uint256);
    // Potentially other functions CorePool exposes that uToken might need, though uToken is usually passive.
}

/**
 * @title uToken
 * @author Unxversal Team
 * @notice Interest-bearing token representing a user's supply in a lending pool.
 * @dev ERC20 token that holds the underlying asset. Exchange rate against underlying
 *      increases as interest accrues in the CorePool for this market.
 *      Minting/burning controlled by CorePool.
 */
contract uToken is ERC20, ERC20Burnable, Ownable {
    using SafeDecimalMath for uint256;

    IERC20 public immutable underlying; // The underlying asset (e.g., USDC, WETH)
    ICorePool public corePool;       // The CorePool contract managing this uToken market

    // Precision for exchange rate calculations (1e18)
    uint256 internal constant EXCHANGE_RATE_PRECISION = 1e18;

    // Initial exchange rate is 1 uToken = 1 underlying unit (scaled by precision and decimals)
    // More accurately, the initial exchange rate is often fixed, e.g., 0.02 * 1e18 if 1 uToken = 0.02 underlying.
    // For simplicity, let's start with an initial rate that implies 1:1 value scaling,
    // considering underlying decimals.
    // For example, if underlying has 6 decimals, and uToken has 18,
    // initial rate might be 1 * 10^(18-6) * 1e18.
    // A common starting point for uTokens is an initialExchangeRateMantissa.
    // Let's set initial exchange rate to effectively be 1 underlying = 1 uToken in value terms, adjusted for decimals.
    // The actual stored exchange rate will be scaled by 1e18.
    // exchangeRate = (total cash + total borrows - total reserves) / totalSupply of uTokens
    // For V1, let's simplify and assume uToken decimals are always 18.
    // Initial exchange rate can be set such that 1 uToken represents a certain value of underlying.
    // For now, the exchange rate is derived dynamically.

    // Event for exchange rate updates (though it changes implicitly with interest accrual)
    // event ExchangeRateUpdated(uint256 newExchangeRateMantissa);


    /**
     * @param _underlyingAsset Address of the underlying ERC20 token.
     * @param _corePoolAddress Address of the CorePool contract.
     * @param name_ Name of this uToken (e.g., "Unxversal USDC").
     * @param symbol_ Symbol of this uToken (e.g., "uUSDC").
     * @param _admin The address that will be the owner of this uToken contract
     *               (typically the CorePool or LendAdmin for setup).
     */
    constructor(
        address _underlyingAsset,
        address _corePoolAddress,
        string memory name_,
        string memory symbol_,
        address _admin
    ) ERC20(name_, symbol_) Ownable(_admin) {
        require(_underlyingAsset != address(0), "uToken: Zero underlying");
        require(_corePoolAddress != address(0), "uToken: Zero CorePool");
        underlying = IERC20(_underlyingAsset);
        corePool = ICorePool(_corePoolAddress);
    }

    // --- Core Logic controlled by CorePool ---

    /**
     * @notice Mints uTokens to a user. Only callable by CorePool.
     * @param minter The address to mint uTokens to.
     * @param mintAmount The amount of uTokens to mint.
     */
    function mintTokens(address minter, uint256 mintAmount) external {
        require(msg.sender == address(corePool), "uToken: Caller not CorePool");
        _mint(minter, mintAmount);
    }

    /**
     * @notice Burns uTokens from a user. Only callable by CorePool.
     * @dev This function calls the internal _burn. CorePool will have ensured the user
     *      has sufficient uTokens and that the burn is valid.
     *      This is different from ERC20Burnable.burn(amount) which burns msg.sender's tokens.
     * @param burner The address to burn uTokens from.
     * @param burnAmount The amount of uTokens to burn.
     */
    function burnTokens(address burner, uint256 burnAmount) external {
        require(msg.sender == address(corePool), "uToken: Caller not CorePool");
        _burn(burner, burnAmount); // Burns `burner`'s tokens
    }

    /**
     * @notice Transfers underlying tokens from this uToken contract to a recipient.
     * @dev Only callable by CorePool, typically during withdrawals or borrows.
     * @param recipient The address to receive the underlying tokens.
     * @param amount The amount of underlying tokens to transfer.
     */
    function transferUnderlyingTo(address recipient, uint256 amount) external returns (bool) {
        require(msg.sender == address(corePool), "uToken: Caller not CorePool");
        SafeERC20.safeTransfer(underlying, recipient, amount);
        return true;
    }

    /**
     * @notice Fetches underlying tokens into this uToken contract from a sender.
     * @dev Only callable by CorePool, typically during supplies or repayments.
     *      Sender must have approved CorePool (or this uToken via CorePool) for the amount.
     * @param sender The address to pull underlying tokens from.
     * @param amount The amount of underlying tokens to fetch.
     */
    function fetchUnderlyingFrom(address sender, uint256 amount) external returns (bool) {
        require(msg.sender == address(corePool), "uToken: Caller not CorePool");
        // CorePool should ensure that `sender` has approved `address(corePool)`
        // and CorePool then calls `underlying.transferFrom(sender, address(this_uToken), amount)`
        // OR, sender approves this uToken contract directly, and CorePool triggers this.
        // The first pattern is more common (approve controller, controller pulls).
        // This uToken function assumes the allowance is set up for CorePool to manage.
        // If CorePool is msg.sender, it can instruct this uToken to pull from `sender` if `sender` approved `CorePool`.
        // This requires `underlying.transferFrom(sender, address(this), amount)` but needs CorePool's context.

        // Simpler: CorePool pulls tokens from user to ITSELF, then transfers to this uToken.
        // Or, User approves this uToken contract, CorePool calls this.
        // Let's assume user approves this uToken contract.
        SafeERC20.safeTransferFrom(underlying, sender, address(this), amount);
        return true;
    }

    // --- Exchange Rate Logic ---

    /**
     * @notice Calculates the current exchange rate of uTokens to underlying tokens.
     * @dev exchangeRate = (totalUnderlyingBalance + totalBorrows - totalReserves) / totalUTokenSupply
     *      All scaled by EXCHANGE_RATE_PRECISION.
     *      Returns 0 if total uToken supply is 0.
     * @return The exchange rate, scaled by 1e18.
     */
    function exchangeRateCurrent() public returns (uint256) {
        // Accrue interest first to get the latest totalBorrows and totalReserves
        corePool.accrueInterest(address(this)); // Modifies state, so not view.
                                                // This is a common pattern for on-demand accrual.

        return exchangeRateStored(); // Now read the stored/calculated rate post-accrual
    }

    /**
     * @notice Returns the stored exchange rate. Call `exchangeRateCurrent()` to accrue interest first.
     * @dev This value is only updated when `accrueInterest` is called on the CorePool for this market.
     * @return The stored exchange rate, scaled by 1e18.
     */
    function exchangeRateStored() public view returns (uint256) {
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            // Typically, there's an initial exchange rate if supply is 0.
            // For Compound, it's initialExchangeRateMantissa (e.g., 0.02 * 1e18).
            // Let's assume a scenario where if no supply, rate is effectively based on 1 unit for simplicity,
            // or return a defined initial exchange rate.
            // For now, if no uTokens, it implies no underlying value managed by it in this context.
            // A common initial rate if _totalSupply is 0 could be 1 underlying unit scaled.
            // Let's define an initial exchange rate or handle this carefully.
            // For now, returning 0 if no supply is problematic.
            // The first minter will establish the initial rate effectively.
            // Let's use a fixed initial exchange rate if totalSupply is 0.
            // e.g., 1 uToken = 1 underlying unit, scaled.
            // This requires knowing underlying decimals.
            // For simplicity, let's assume uTokens and underlying have same "value" basis initially.
            // A common start is 1 uToken = X underlying, and X is fixed. Let's use 1e18 as default.
            return EXCHANGE_RATE_PRECISION; // Placeholder for a proper initial exchange rate
        }

        uint256 cash = underlying.balanceOf(address(this));
        uint256 borrows = corePool.totalBorrowsCurrent(address(this)); // Current total borrows for this uToken's market
        uint256 reserves = corePool.totalReserves(address(this)); // Current reserves for this market

        // exchangeRate = (cash + borrows - reserves) * 1e18 / totalSupply
        // (cash + borrows - reserves) is the total underlying asset value backing the uTokens
        uint256 totalAssetValue = cash + borrows;
        if (totalAssetValue < reserves) { // Should not happen if reserves are derived from interest
            totalAssetValue = 0;
        } else {
            totalAssetValue -= reserves;
        }
        
        return totalAssetValue.multiplyDecimal(_totalSupply); // multiplyDecimal is x * y / 1e18. We want (X * 1e18) / Y
                                                              // So, (totalAssetValue * EXCHANGE_RATE_PRECISION) / _totalSupply
        // Using Math.mulDiv directly for clarity:
        return Math.mulDiv(totalAssetValue, EXCHANGE_RATE_PRECISION, _totalSupply);
    }

    /**
     * @notice Accrues interest for this uToken market by calling CorePool.
     * @dev This is a wrapper and also a state-changing operation.
     */
    function accrueMarketInterest() external {
        corePool.accrueInterest(address(this));
    }


    // --- ERC20Burnable Override ---
    // `burn(uint256 amount)` burns msg.sender's tokens.
    // `burnFrom(address account, uint256 amount)` burns from account if msg.sender has allowance.
    // These are standard and don't need overriding unless specific uToken logic required.
    // CorePool will call `burnTokens` which uses internal `_burn`.

    // --- Ownable functions (e.g., to change corePool address by admin) ---
    function setCorePool(address _newCorePoolAddress) external onlyOwner {
        require(_newCorePoolAddress != address(0), "uToken: Zero CorePool");
        corePool = ICorePool(_newCorePoolAddress);
    }
}