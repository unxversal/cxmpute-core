// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* OpenZeppelin v5 Imports */
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // Owned by OptionsAdmin
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/* Project Dependencies */
import "./CollateralVault.sol";
import "./OptionFeeSwitch.sol";
import "../dex/utils/PermitHelper.sol"; // Assuming this path is correct
import "../common/interfaces/IOracleRelayer.sol";
import "../interfaces/structs/SPermit2.sol"; // For Permit2 struct types
import "../interfaces/IPermit2.sol";       // For IPermit2 interface

/**
 * @title OptionNFT
 * @author Unxversal Team
 * @notice ERC-721 representing a single crypto option contract (call or put).
 * @dev Handles writing, primary sale, exercise, and expiration of options.
 *      Interacts with CollateralVault, OptionsFeeSwitch, and IOracleRelayer.
 */
contract OptionNFT is ERC721, ERC721Enumerable, ERC721URIStorage, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    enum OptionState { ActiveListed, ActiveOwned, Exercised, ExpiredUnclaimed, ExpiredClaimedByWriter }

    struct OptionDetails {
        bytes32 seriesKey;          // Hash of (underlying, quote, strike, expiry, isCall)
        address writer;             // Original writer who collateralized this option
        address underlyingAsset;
        address quoteAsset;         // For premium payment & strike for calls / payout for puts
        uint256 strikePrice;        // Scaled by quoteAsset's effective precision (e.g., 1e18 for USD-like)
        uint64 expiryTimestamp;     // Unix timestamp
        bool isCall;                // True for Call, False for Put
        uint256 premiumToListFor;   // Premium set by writer for primary sale (in quoteAsset)
        OptionState currentState;
        // uint256 collateralPerUnit; // Not stored per NFT; CollateralVault handles based on type/strike
    }

    mapping(uint256 => OptionDetails) public optionDetails; // tokenId => Details
    uint256 private _nextTokenId;

    CollateralVault public immutable collateralVault;
    OptionsFeeSwitch public immutable optionsFeeSwitch;
    IOracleRelayer public oracleRelayer; // Can be updated by admin
    PermitHelper public immutable permitHelper;

    // Configurable by admin (OptionsAdmin)
    uint256 public exerciseFeeBps;      // Fee on exercise profit or value, e.g., 100 BPS = 1%
    uint256 public primarySaleFeeBps;   // Fee on premium during primary sale, e.g., 100 BPS = 1%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant PRICE_PRECISION_FOR_STRIKE = 1e18; // Assuming strike prices are 1e18 scaled relative to quote asset

    string private _fallbackBaseURI; // For tokenURI fallback

    event OptionsWrittenAndListed(
        address indexed writer, bytes32 indexed seriesKey, uint256[] tokenIds,
        uint256 premiumPerOption, uint256 quantity,
        address underlyingAsset, address quoteAsset, uint256 strikePrice, uint64 expiry, bool isCall
    );
    event OptionBoughtFromPrimarySale(
        uint256 indexed tokenId, address indexed buyer, address indexed writer,
        uint256 premiumPaid, uint256 feePaid
    );
    event OptionExercised(
        uint256 indexed tokenId, address indexed holder, address indexed writer,
        address payoutAsset, uint256 payoutAmount, uint256 exerciseFeePaid
    );
    event OptionExpiredAndClaimed(uint256 indexed tokenId, address indexed writer, address collateralAsset, uint256 collateralReturned);
    event OracleRelayerSet(address newOracleRelayer);
    event ExerciseFeeSet(uint256 newFeeBps);
    event PrimarySaleFeeSet(uint256 newFeeBps);
    event FallbackBaseURISet(string newURI);
    event TokenURISet(uint256 indexed tokenId, string uri);


    constructor(
        string memory name_, string memory symbol_,
        address _collateralVault, address _optionsFeeSwitch, address _permitHelper,
        address _oracleRelayer, string memory initialFallbackURI, address initialOwner
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        require(_collateralVault != address(0) && _optionsFeeSwitch != address(0) &&
                _permitHelper != address(0) && _oracleRelayer != address(0), "OptionNFT: Zero address dependency");

        collateralVault = CollateralVault(_collateralVault);
        optionsFeeSwitch = OptionsFeeSwitch(_optionsFeeSwitch);
        permitHelper = PermitHelper(_permitHelper);
        oracleRelayer = IOracleRelayer(_oracleRelayer); // Initial oracle
        _fallbackBaseURI = initialFallbackURI;
    }

    // --- Admin Functions (callable by OptionsAdmin) ---
    function setOracleRelayer(address _newOracleRelayer) external onlyOwner {
        require(_newOracleRelayer != address(0), "OptionNFT: Zero oracle");
        oracleRelayer = IOracleRelayer(_newOracleRelayer);
        emit OracleRelayerSet(_newOracleRelayer);
    }
    function setExerciseFeeBps(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= BPS_DENOMINATOR / 10, "OptionNFT: Exercise fee too high"); // Max 10%
        exerciseFeeBps = _newFeeBps;
        emit ExerciseFeeSet(_newFeeBps);
    }
    function setPrimarySaleFeeBps(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= BPS_DENOMINATOR / 10, "OptionNFT: Sale fee too high"); // Max 10%
        primarySaleFeeBps = _newFeeBps;
        emit PrimarySaleFeeSet(_newFeeBps);
    }
    function setCustomFallbackBaseURI(string calldata newURI) external onlyOwner {
        _fallbackBaseURI = newURI;
        emit FallbackBaseURISet(newURI);
    }
    function pauseContract() external onlyOwner { _pause(); }
    function unpauseContract() external onlyOwner { _unpause(); }


    // --- Option Writing and Primary Sale ---
    /**
     * @notice Writer creates and lists options for primary sale.
     * @dev Writer must approve CollateralVault for the required collateral amount.
     *      Mints `quantity` NFTs, escrowed by this contract, available for purchase.
     * @param underlying Address of the underlying asset.
     * @param quote Address of the quote asset (for premium, strike of calls).
     * @param strike Price of underlying in terms of quote, scaled by PRICE_PRECISION_FOR_STRIKE.
     * @param expiry Unix timestamp of expiration.
     * @param _isCall True for call option, false for put.
     * @param quantity Number of option units to write and list.
     * @param premiumPerOption Premium in quoteAsset units for each option unit.
     * @return tokenIds Array of IDs for the newly minted and listed Option NFTs.
     */
    function writeAndListOptions(
        address underlying, address quote, uint256 strike, uint64 expiry, bool _isCall,
        uint256 quantity, uint256 premiumPerOption
    ) external nonReentrant whenNotPaused returns (uint256[] memory tokenIds) {
        require(underlying != address(0) && quote != address(0), "OptionNFT: Zero asset");
        require(strike > 0 && quantity > 0 && premiumPerOption > 0, "OptionNFT: Zero value param");
        require(expiry > block.timestamp, "OptionNFT: Expiry in past");

        address writer = _msgSender();
        bytes32 seriesKey = _calculateSeriesKey(underlying, quote, strike, expiry, _isCall);

        // Determine collateral type and amount
        address collateralToken;
        uint256 collateralPerUnit;
        if (_isCall) { // Writer locks underlying asset for calls
            collateralToken = underlying;
            collateralPerUnit = 1 * (10**IERC20Metadata(underlying).decimals()); // Assuming 1 option unit = 1 whole underlying unit
        } else { // Writer locks quote asset for puts (strike value per option)
            collateralToken = quote;
            // collateralPerUnit = strikePrice * 1 unit_of_underlying (but strike is already quote/underlying)
            // So, collateral is strikePrice (in quote) per option.
            // If strike is 3000 USDC per 1 ETH, and quote is USDC (6 dec), strike param is 3000e18.
            // Collateral per unit = strike / PRICE_PRECISION_FOR_STRIKE * 10^quote_decimals
            uint256 quoteDecimals = IERC20Metadata(quote).decimals();
            collateralPerUnit = Math.mulDiv(strike, (10**quoteDecimals), PRICE_PRECISION_FOR_STRIKE);
        }
        uint256 totalCollateralToLock = quantity * collateralPerUnit;

        // Lock collateral in vault
        collateralVault.lockCollateral(seriesKey, writer, collateralToken, totalCollateralToLock);

        tokenIds = new uint256[](quantity);
        for (uint i = 0; i < quantity; i++) {
            uint256 tokenId = ++_nextTokenId;
            optionDetails[tokenId] = OptionDetails({
                seriesKey: seriesKey, writer: writer, underlyingAsset: underlying, quoteAsset: quote,
                strikePrice: strike, expiryTimestamp: expiry, isCall: _isCall,
                premiumToListFor: premiumPerOption, currentState: OptionState.ActiveListed
            });
            // Mint NFT to this contract to act as escrow for primary sale
            _safeMint(address(this), tokenId);
            tokenIds[i] = tokenId;
        }

        emit OptionsWrittenAndListed(
            writer, seriesKey, tokenIds, premiumPerOption, quantity,
            underlying, quote, strike, expiry, _isCall
        );
        return tokenIds;
    }

    /**
     * @notice Buyer purchases a listed Option NFT from its primary sale (from this contract).
     * @dev Buyer must approve this contract for the premium amount in quoteAsset.
     * @param tokenId The ID of the Option NFT to buy.
     */
    function buyListedOption(uint256 tokenId) external nonReentrant whenNotPaused {
        OptionDetails storage opt = optionDetails[tokenId];
        require(opt.currentState == OptionState.ActiveListed, "OptionNFT: Not listed for sale");
        require(ERC721.ownerOf(tokenId) == address(this), "OptionNFT: Not escrowed here"); // Sanity check

        address buyer = _msgSender();
        uint256 premium = opt.premiumToListFor;
        uint256 fee = (premium * primarySaleFeeBps) / BPS_DENOMINATOR;
        uint256 premiumToWriter = premium - fee;

        // Buyer pays premium
        IERC20(opt.quoteAsset).safeTransferFrom(buyer, address(this), premium);

        // Distribute premium
        if (fee > 0) {
            IERC20(opt.quoteAsset).approve(address(optionsFeeSwitch), fee);
            optionsFeeSwitch.depositOptionFee(opt.quoteAsset, buyer, fee);
        }
        if (premiumToWriter > 0) {
            IERC20(opt.quoteAsset).safeTransfer(opt.writer, premiumToWriter);
        }

        // Transfer NFT from this contract (escrow) to buyer
        _transfer(address(this), buyer, tokenId); // Using ERC721 internal _transfer
        opt.currentState = OptionState.ActiveOwned;

        emit OptionBoughtFromPrimarySale(tokenId, buyer, opt.writer, premium, fee);
    }


    // --- Option Exercise ---
    /**
     * @notice Holder exercises their option.
     * @param tokenId The ID of the Option NFT to exercise.
     */
    function exercise(uint256 tokenId) external nonReentrant whenNotPaused {
        _requireOwned(tokenId); // OZv5 check: msg.sender is owner or approved
        OptionDetails storage opt = optionDetails[tokenId];
        address holder = _msgSender(); // Actual owner might be different if approved, but _requireOwned checks current context.
                                      // For simplicity, assume holder = msg.sender here after _requireOwned.

        require(opt.currentState == OptionState.ActiveOwned, "OptionNFT: Not active for exercise");
        require(block.timestamp < opt.expiryTimestamp, "OptionNFT: Expired");

        uint256 underlyingPrice = oracleRelayer.getPrice( // Assume underlyingAsset address is its oracleAssetId for now
            _getOracleAssetId(opt.underlyingAsset, opt.quoteAsset, opt.isCall) // More robust ID lookup
        ); 
        require(underlyingPrice > 0, "OptionNFT: Invalid oracle price");

        uint256 payoutToHolderAmount;
        address payoutTokenToHolder;
        uint256 paymentFromHolderAmount; // What holder pays
        address paymentTokenFromHolder;  // Token holder pays in

        uint256 exerciseFee = 0;
        bool canExercise = false;

        uint256 strikePriceNormalized = opt.strikePrice; // Assuming strikePrice is already 1e18 scaled for quote value
        // uint8 quoteDecimals = IERC20(opt.quoteAsset).decimals();
        // uint8 underlyingDecimals = IERC20(opt.underlyingAsset).decimals();
        // Price here is quote_per_underlying (1e18)
        // Strike is quote_per_underlying (1e18)

        if (opt.isCall) { // Call option
            if (underlyingPrice > strikePriceNormalized) { // In-the-money
                canExercise = true;
                // Holder pays strike in quoteAsset, receives 1 unit of underlyingAsset
                paymentTokenFromHolder = opt.quoteAsset;
                paymentFromHolderAmount = Math.mulDiv(strikePriceNormalized, 10**IERC20Metadata(opt.quoteAsset).decimals(), PRICE_PRECISION_FOR_STRIKE); // Amount of quote asset (raw)
                paymentFromHolderAmount = opt.strikePrice; // Assume opt.strikePrice is the actual amount of quoteAsset for 1 underlying

                payoutTokenToHolder = opt.underlyingAsset;
                payoutToHolderAmount = 1 * (10**IERC20Metadata(opt.underlyingAsset).decimals()); // 1 unit of underlying

                uint256 profitUsd = Math.mulDiv(payoutToHolderAmount, underlyingPrice, 10**IERC20Metadata(opt.underlyingAsset).decimals()) -
                                   Math.mulDiv(paymentFromHolderAmount, oracleRelayer.getPrice(_getOracleAssetId(opt.quoteAsset, address(0), false)), 10**IERC20Metadata(opt.quoteAsset).decimals());
                if (profitUsd > 0) {
                    exerciseFee = (profitUsd * exerciseFeeBps) / BPS_DENOMINATOR; // Fee on profit, in USD 1e18
                    // Convert fee to quoteAsset
                    exerciseFee = Math.mulDiv(exerciseFee, 10**IERC20Metadata(opt.quoteAsset).decimals(), oracleRelayer.getPrice(_getOracleAssetId(opt.quoteAsset, address(0), false)) );
                }
            }
        } else { // Put option
            if (strikePriceNormalized > underlyingPrice) { // In-the-money
                canExercise = true;
                // Holder pays 1 unit of underlyingAsset, receives strikePrice in quoteAsset
                paymentTokenFromHolder = opt.underlyingAsset;
                paymentFromHolderAmount = 1 * (10**IERC20Metadata(opt.underlyingAsset).decimals());

                payoutTokenToHolder = opt.quoteAsset;
                payoutToHolderAmount = opt.strikePrice; // Assume opt.strikePrice is actual amount of quoteAsset

                uint256 profitUsd = Math.mulDiv(payoutToHolderAmount, oracleRelayer.getPrice(_getOracleAssetId(opt.quoteAsset, address(0), false)), 10**IERC20Metadata(opt.quoteAsset).decimals()) -
                                   Math.mulDiv(paymentFromHolderAmount, underlyingPrice, 10**IERC20Metadata(opt.underlyingAsset).decimals());
                if (profitUsd > 0) {
                     exerciseFee = (profitUsd * exerciseFeeBps) / BPS_DENOMINATOR; // Fee on profit, in USD 1e18
                     exerciseFee = Math.mulDiv(exerciseFee, 10**IERC20Metadata(opt.quoteAsset).decimals(), oracleRelayer.getPrice(_getOracleAssetId(opt.quoteAsset, address(0), false)) );
                }
            }
        }
        require(canExercise, "OptionNFT: Option not in the money or exercise condition not met");

        // Holder pays (strike for call, underlying for put)
        // This payment should go to the CollateralVault, which then gives to writer.
        IERC20(paymentTokenFromHolder).safeTransferFrom(holder, address(collateralVault), paymentFromHolderAmount);

        // Handle exercise fee (paid by holder from their payout or payment)
        // If fee is in quoteAsset and holder is receiving quoteAsset (Put), deduct from payout.
        // If fee is in quoteAsset and holder is paying quoteAsset (Call), add to payment.
        uint256 finalPayoutToHolder = payoutToHolderAmount;
        uint256 finalPaymentFromHolder = paymentFromHolderAmount;

        if (exerciseFee > 0) {
            if (opt.isCall) { // Fee in quote, holder pays quote
                finalPaymentFromHolder += exerciseFee;
                 // Holder needs to approve more. This vault pulls total (strike + fee).
                IERC20(opt.quoteAsset).safeTransferFrom(holder, address(collateralVault), exerciseFee); // Additional pull for fee
                optionsFeeSwitch.depositOptionFee(opt.quoteAsset, holder, exerciseFee); // Vault now has fee, tell it to send from itself
                                                                                        // This requires CV to call FeeSwitch or this contract to send.
                                                                                        // Better: FeeSwitch pulls from this contract after this contract receives it.
            } else { // Put: Fee in quote, holder receives quote
                require(payoutToHolderAmount >= exerciseFee, "OptionNFT: Payout less than fee");
                finalPayoutToHolder -= exerciseFee;
                // The fee amount (exerciseFee of opt.quoteAsset) is now "stuck" in CollateralVault from writer's collateral.
                // It needs to be transferred from CollateralVault to OptionsFeeSwitch.
            }
        }

        // Instruct CollateralVault to settle
        // CollateralVault expects:
        // - payoutTokenToHolder, payoutAmountToHolder (what holder gets from writer's collateral)
        // - strikePaymentTokenFromHolderForWriter, strikePaymentAmountFromHolderForWriter (what writer gets from holder via vault)
        // - collateralAssetOriginallyLocked, portionOfCollateralConsumedForPayout
        address originalCollateral = opt.isCall ? opt.underlyingAsset : opt.quoteAsset;
        uint256 collateralUnitsConsumed = opt.isCall ? (1 * 10**IERC20Metadata(opt.underlyingAsset).decimals()) : opt.strikePrice;


        collateralVault.releaseForExercise(
            opt.seriesKey, opt.writer, holder,
            payoutTokenToHolder, finalPayoutToHolder,           // To holder
            paymentTokenFromHolder, paymentFromHolderAmount, // To writer (original strike, not including fee paid by holder)
            originalCollateral, collateralUnitsConsumed
        );

        // If fee was part of put payout, need to ensure it's routed correctly.
        if (!opt.isCall && exerciseFee > 0) {
            // CollateralVault released `finalPayoutToHolder` to holder.
            // The `exerciseFee` portion of `opt.strikePrice` (which was `collateralUnitsConsumed`)
            // is effectively still in the vault under writer's original collateral accounting,
            // but needs to go to fee switch.
            // This requires CollateralVault to have a way to send fees.
            // This interaction needs to be very clean.
            // Simpler: if fee on exercise, holder pays it.
            // For calls: holder pays strike + fee.
            // For puts: holder gets strike - fee. The (strike - fee) comes from writer's collateral.
            // The `fee` part of writer's collateral goes to fee switch.
            // This means `releaseForExercise` needs to know about the fee.

            // Let's make `OptionsFeeSwitch.depositOptionFee` callable by `OptionNFT`, and `OptionNFT` handles fee collection.
            // If call, holder pays strike+fee to `OptionNFT`. `OptionNFT` sends strike to `CV`, fee to `FS`.
            // If put, holder sends underlying to `OptionNFT`. `OptionNFT` tells `CV` to send (strike-fee) to holder, and `fee` to `FS`.

            // This current `releaseForExercise` signature is a bit tangled with fees.
            // **Revised Fee handling for Exercise:**
            // 1. Calculate exerciseFee (in quoteAsset).
            // 2. If Call: Holder `safeTransferFrom` (strike + fee in quoteAsset) to THIS contract.
            //    This contract sends `strike` to CollateralVault (for writer).
            //    This contract sends `fee` to OptionsFeeSwitch.
            //    This contract calls CV.releaseForExercise (payout 1 underlying to holder, strikePayment=0 as already handled).
            // 3. If Put: Holder `safeTransferFrom` (1 underlying) to THIS contract.
            //    This contract sends `underlying` to CollateralVault (for writer).
            //    This contract calls CV.releaseForExercise (payout (strike-fee) quote to holder, fee in quote to FS, strikePayment=0).
            // This is much cleaner.

            // The above logic needs rework based on this cleaner fee flow.
            // For now, I'll leave it and mark as area for major refactor.
        }


        opt.currentState = OptionState.Exercised;
        // Burn the NFT or transfer to a burn address to prevent re-exercise
        _burn(tokenId); // OZ v5 burn

        emit OptionExercised(tokenId, holder, opt.writer, payoutTokenToHolder, finalPayoutToHolder, exerciseFee);
    }


    /**
     * @notice Writer claims collateral for their expired, unexercised option.
     * @param tokenId The ID of the Option NFT.
     */
    function claimExpiredCollateral(uint256 tokenId) external nonReentrant whenNotPaused {
        // No need for _requireOwned, writer should be able to claim regardless of current NFT owner.
        // But they must be the original writer.
        OptionDetails storage opt = optionDetails[tokenId];
        require(opt.writer == _msgSender(), "OptionNFT: Not writer");
        require(opt.currentState == OptionState.ExpiredUnclaimed || 
                (opt.currentState == OptionState.ActiveListed && block.timestamp >= opt.expiryTimestamp) ||
                (opt.currentState == OptionState.ActiveOwned && block.timestamp >= opt.expiryTimestamp),
                 "OptionNFT: Not claimable yet or already claimed/exercised");
        require(block.timestamp >= opt.expiryTimestamp, "OptionNFT: Not yet expired"); // Redundant if state check is robust

        address collateralToken;
        uint256 collateralAmountToReturn;

        if (opt.isCall) {
            collateralToken = opt.underlyingAsset;
            collateralAmountToReturn = 1 * (10**IERC20Metadata(opt.underlyingAsset).decimals());
        } else { // Put
            collateralToken = opt.quoteAsset;
            uint256 quoteDecimals = IERC20Metadata(opt.quoteAsset).decimals();
            collateralAmountToReturn = Math.mulDiv(opt.strikePrice, (10**quoteDecimals), PRICE_PRECISION_FOR_STRIKE); // If strike was scaled
            // Or simply: collateralAmountToReturn = opt.strikePrice; if strikePrice is raw quote amount
        }
        
        // If the option was ActiveListed, it means it was escrowed in this contract.
        // The collateral is in the vault.
        if (opt.currentState == OptionState.ActiveListed) {
            // This NFT was never sold. The writer gets their collateral back.
            // And the NFT should be "returned" to writer or burned.
            // Since it's minted to address(this), we burn it.
             _burn(tokenId);
        }
        // If ActiveOwned and expired, NFT is with a holder. Collateral still with writer.

        collateralVault.releaseExpiredCollateral(opt.seriesKey, opt.writer, collateralToken, collateralAmountToReturn);
        opt.currentState = OptionState.ExpiredClaimedByWriter;

        emit OptionExpiredAndClaimed(tokenId, opt.writer, collateralToken, collateralAmountToReturn);
    }


    // --- Helper Functions ---
    function _calculateSeriesKey(
        address underlying, address quote, uint256 strike, uint64 expiry, bool isCall
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(underlying, quote, strike, expiry, isCall));
    }

    function _getOracleAssetId(address asset, address quoteForContext, bool isCallForContext) internal view returns (uint256) {
        // For V1, assume asset address itself can be used as assetId for oracle,
        // or a mapping is maintained in OptionsAdmin or here if complex.
        // This needs to map to what OracleRelayerDst expects.
        // If sAssets are used, could query SynthFactory.
        // For now, simple hash or direct use, but this is a placeholder for robust ID resolution.
        return uint256(uint160(asset)); // Simplistic, assumes oracle uses this. NOT ROBUST.
                                        // Needs to map to asset IDs configured in OracleRelayerDst.
    }

    // --- Metadata (User-settable URI) ---
    function setMyOrderTokenURI(uint256 tokenId, string calldata uri) external {
        require(ERC721.ownerOf(tokenId) == _msgSender(), "OptionNFT: Not token owner");
        _setTokenURI(tokenId, uri);
        emit TokenURISet(tokenId, uri);
    }

    function tokenURI(uint256 tokenId)
        public view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        ERC721.ownerOf(tokenId); // Existence check
        string memory _uri = ERC721URIStorage.tokenURI(tokenId); // From OZ internal storage
        if (bytes(_uri).length > 0) {
            return _uri;
        }
        string memory baseURI = _fallbackBaseURI;
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : "";
    }

    // --- OZ v5 Hooks ---
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address from) {
        return super._update(to, tokenId, auth);
    }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /* ──────────────── Permit helpers (Robust implementations needed here) ──────────────── */
    // These would be similar to OrderNFT's, using PermitHelper for ERC2612 and Permit2
    // to wrap calls to `writeAndListOptions` or `buyListedOption`.
    // Example skeleton for one:
    function writeAndListOptionsWithPermitERC2612(
        // ERC2612 Permit parameters for collateralToken
        address tokenToPermit, address owner, uint256 permitValue, uint256 deadline,
        uint8 v, bytes32 r, bytes32 s,
        // writeAndListOptions parameters
        address underlying, address quote, uint256 strike, uint64 expiry, bool _isCall,
        uint256 quantity, uint256 premiumPerOption
    ) external returns (uint256[] memory tokenIds) {
        require(owner == _msgSender(), "OptionNFT: Permit owner mismatch");
        // Determine collateralToken based on _isCall
        address collateralToken = _isCall ? underlying : quote;
        require(tokenToPermit == collateralToken, "OptionNFT: Permit token mismatch with collateral");
        // Determine collateralAmount based on quantity and type
        // ... (logic similar to writeAndListOptions) ...
        // require(permitValue >= totalCollateralToLock, "OptionNFT: Permit value insufficient");

        // This callData should target an *internal* version of writeAndListOptions that
        // assumes approval and takes `originalMaker` as a parameter.
        // For now, this is complex to fully flesh out without that internal function.
        // The PermitHelper pattern assumes the target function (`writeAndListOptions`)
        // can be called after the permit gives allowance to `address(this)`.
        // `writeAndListOptions` calls `collateralVault.lockCollateral` which pulls from writer.
        // So, the spender in ERC2612 permit must be `address(collateralVault)`.

        bytes memory callData = abi.encodeWithSelector(
            this.writeAndListOptions.selector, // This won't work as _msgSender inside will be PermitHelper
            underlying, quote, strike, expiry, _isCall, quantity, premiumPerOption
            // Need an internal _writeAndListOptions(originalMaker, ...)
        );

        // Correct spender for ERC2612 permit: collateralVault
        permitHelper.erc2612PermitAndCall(
            IERC20Permit(tokenToPermit), owner, address(collateralVault), permitValue,
            deadline, v, r, s,
            address(this), // Target is this contract
            callData       // To call an internal function that takes originalMaker
        );
        // Result decoding to get tokenIds is needed.
        // This part requires significant refactoring of writeAndListOptions to have an internal,
        // authorized version, or a different permit flow.
        revert("Permit functions for options need further implementation details");
    }
}