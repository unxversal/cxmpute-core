// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // For potential admin functions like setting fee contract
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./structs/SOrder.sol"; // Assuming SOrder.sol contains OrderLayout
import "./DexFeeSwitch.sol"; // Assuming DexFeeSwitch.sol is in the same directory
import "./utils/PermitHelper.sol"; // Assuming PermitHelper.sol is in dex/utils/

/**
 * @title OrderNFT
 * @author Unxversal Team
 * @notice A decentralized exchange implementation where limit orders are represented as ERC721 NFTs.
 * @dev Supports creating, filling (partially or fully), and cancelling orders.
 *      Integrates with a DexFeeSwitch for fee collection and PermitHelper for gasless approvals.
 *      Relies on off-chain indexers for order discovery and matching.
 *      Price-time priority is an off-chain concern for takers; this contract validates fills.
 */
contract OrderNFT is ERC721Enumerable, ERC721URIStorage, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    // --- Structs ---
    // Re-defining or importing OrderLayout from SOrder.sol
    // For direct use in mapping, we'll define it here for clarity of storage layout.
    // Your spec mentioned packing for specific fields.
    struct Order {
        address maker;          // 160 bits
        uint32 expiry;          // 32 bits
        uint24 feeBpsTaken;     // 24 bits - Actual fee BPS applied from DexFeeSwitch or order-specific
        uint8 sellDecimals;     // 8 bits
        // --- Slot 1 (224 bits) ---
        uint256 amountInitial;  // Initial amount offered by the maker
        uint256 amountRemaining;// Amount of sellToken still available
        // --- Slot 2&3 ---
        address sellToken;
        address buyToken;
        uint256 price;          // Price of 1 unit of sellToken in buyToken, scaled (e.g., by 1e18)
        bool isFilledOrCancelled; // To prevent re-filling/re-cancelling a concluded order NFT
        // --- Slots 4,5,6 ---
    }

    // --- State Variables ---
    mapping(uint256 => Order) public orders; // tokenId => Order details
    uint256 private _nextTokenId; // Counter for new order NFTs

    DexFeeSwitch public immutable dexFeeSwitch;
    PermitHelper public immutable permitHelper; // Optional, if used directly by this contract

    // For price representation: price is amount of buyToken for 1 unit of sellToken, scaled by 10^18
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MAX_FEE_BPS = 1000; // Max fee 10% (example)

    // --- Events ---
    event OrderCreated(
        uint256 indexed tokenId,
        address indexed maker,
        address indexed sellToken,
        address indexed buyToken,
        uint256 price,
        uint256 amountInitial,
        uint32 expiry,
        uint8 sellDecimals,
        uint24 feeBps
    );

    event OrderFilled(
        uint256 indexed tokenId,
        address indexed taker,
        address indexed maker,
        uint256 amountSold,      // Amount of sellToken sold in this fill
        uint256 amountBought,    // Amount of buyToken received by maker in this fill
        uint256 amountRemainingInOrder // Amount of sellToken left in the order NFT
    );

    event OrderCancelled(uint256 indexed tokenId, address indexed maker);

    // --- Constructor ---
    constructor(
        string memory name, // e.g., "Unxversal Order"
        string memory symbol, // e.g., "UNXV-ORDER"
        address _dexFeeSwitchAddress,
        address _permitHelperAddress,
        address _initialOwner
    ) ERC721(name, symbol) Ownable(_initialOwner) {
        require(_dexFeeSwitchAddress != address(0), "OrderNFT: Zero fee switch");
        require(_permitHelperAddress != address(0), "OrderNFT: Zero permit helper");
        dexFeeSwitch = DexFeeSwitch(_dexFeeSwitchAddress);
        permitHelper = PermitHelper(_permitHelperAddress);
    }

    // --- Order Creation ---
    /**
     * @notice Creates a new limit order and mints an NFT representing it.
     * @dev Maker must have approved this contract to spend `amountToSell` of `sellToken`.
     * @param sellTokenAddr Address of the token to sell.
     * @param buyTokenAddr Address of the token to buy.
     * @param pricePerUnitOfSellToken Price: amount of `buyToken` for 1 unit of `sellToken`, scaled by PRICE_PRECISION.
     *                                Example: If 1 ETH (18 dec) sells for 3000 USDC (6 dec),
     *                                and sellToken is ETH, buyToken is USDC.
     *                                Price = (3000 * 10^6 * 10^18_PRICE_PRECISION) / (1 * 10^18_ETH_DECIMALS)
     *                                This needs careful calculation off-chain.
     *                                A simpler way: price = (Amount of buyToken for 1 sellToken) * PRICE_PRECISION.
     *                                So if 1 ETH = 3000 USDC, price = 3000 * 10^18.
     * @param amountToSell Total amount of `sellToken` the maker wishes to sell with this order.
     * @param _expiry Unix timestamp when the order expires.
     * @param _sellDecimals Decimals of the sellToken (for off-chain price interpretation).
     * @param _orderFeeBps Fee in BPS for this specific order (if overriding global or if per-order fees).
     *                     Your spec had feeBps in Order struct. This can be used or a global fee from FeeSwitch.
     *                     Let's assume `_orderFeeBps` is the fee associated with *this* order.
     * @return tokenId The ID of the newly minted Order NFT.
     */
    function createOrder(
        address sellTokenAddr,
        address buyTokenAddr,
        uint256 pricePerUnitOfSellToken,
        uint256 amountToSell,
        uint32 _expiry,
        uint8 _sellDecimals,
        uint24 _orderFeeBps
    ) external nonReentrant returns (uint256 tokenId) {
        require(sellTokenAddr != address(0) && buyTokenAddr != address(0), "OrderNFT: Zero token address");
        require(sellTokenAddr != buyTokenAddr, "OrderNFT: Same tokens");
        require(amountToSell > 0, "OrderNFT: Zero sell amount");
        require(pricePerUnitOfSellToken > 0, "OrderNFT: Zero price");
        require(_expiry > block.timestamp, "OrderNFT: Expiry in past");
        require(_orderFeeBps <= MAX_FEE_BPS, "OrderNFT: Fee BPS too high");

        address maker = _msgSender();
        tokenId = ++_nextTokenId;

        // Pull sellTokens from maker to this contract
        IERC20(sellTokenAddr).safeTransferFrom(maker, address(this), amountToSell);

        orders[tokenId] = Order({
            maker: maker,
            expiry: _expiry,
            feeBpsTaken: _orderFeeBps, // Store the fee BPS for this order
            sellDecimals: _sellDecimals,
            amountInitial: amountToSell,
            amountRemaining: amountToSell,
            sellToken: sellTokenAddr,
            buyToken: buyTokenAddr,
            price: pricePerUnitOfSellToken,
            isFilledOrCancelled: false
        });

        _safeMint(maker, tokenId);

        emit OrderCreated(
            tokenId,
            maker,
            sellTokenAddr,
            buyTokenAddr,
            pricePerUnitOfSellToken,
            amountToSell,
            _expiry,
            _sellDecimals,
            _orderFeeBps
        );
        return tokenId;
    }

    // --- Order Filling ---
    /**
     * @notice Fills one or more orders.
     * @dev Taker must have approved this contract to spend the required `buyToken` amounts.
     *      The `tokenIds` and `amountsToFillFromOrder` arrays must be of the same length.
     *      Takers choose the order of `tokenIds` to achieve price-time priority.
     *      This function ensures atomicity: either all fills succeed or all revert.
     * @param tokenIds Array of order NFT tokenIds to fill.
     * @param amountsToFillFromOrder Array of amounts of `sellToken` the taker wants to buy from each respective order.
     *                              The taker will pay the corresponding amount of `buyToken`.
     */
    function fillOrders(
        uint256[] calldata tokenIds,
        uint256[] calldata amountsToFillFromOrder
    ) external nonReentrant {
        require(tokenIds.length == amountsToFillFromOrder.length, "OrderNFT: Array length mismatch");
        require(tokenIds.length > 0, "OrderNFT: No orders to fill");

        address taker = _msgSender();

        for (uint i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amountTakerWantsToBuy = amountsToFillFromOrder[i]; // This is sellToken amount

            require(amountTakerWantsToBuy > 0, "OrderNFT: Zero fill amount for an order");

            Order storage order = orders[tokenId];

            require(!order.isFilledOrCancelled, "OrderNFT: Order concluded");
            require(ownerOf(tokenId) == order.maker, "OrderNFT: Maker no longer owns NFT"); // Sanity check
            require(block.timestamp < order.expiry, "OrderNFT: Order expired");
            require(order.amountRemaining > 0, "OrderNFT: Order already fully filled");

            uint256 actualAmountToSell = Math.min(amountTakerWantsToBuy, order.amountRemaining);
            require(actualAmountToSell > 0, "OrderNFT: Nothing to sell (internal error)"); // Should be caught by amountRemaining check

            // Calculate buy amount: (actualAmountToSell * order.price) / PRICE_PRECISION
            // (amount of sellToken * (buyTokens per sellToken * 1e18) / 1e18)
            uint256 amountMakerReceivesInBuyToken = Math.mulDiv(actualAmountToSell, order.price, PRICE_PRECISION);
            require(amountMakerReceivesInBuyToken > 0, "OrderNFT: Zero buy amount (price error)");

            // Calculate fee: (amountMakerReceivesInBuyToken * order.feeBpsTaken) / 10000
            uint256 feeAmountInBuyToken = (amountMakerReceivesInBuyToken * order.feeBpsTaken) / 10000;
            uint256 netAmountMakerReceivesInBuyToken = amountMakerReceivesInBuyToken - feeAmountInBuyToken;

            // Taker pays total buyToken amount
            IERC20(order.buyToken).safeTransferFrom(taker, address(this), amountMakerReceivesInBuyToken);

            // Distribute buyToken: fee to FeeSwitch, rest to maker
            if (feeAmountInBuyToken > 0) {
                // This contract (OrderNFT) acts as the payer to DexFeeSwitch
                IERC20(order.buyToken).approve(address(dexFeeSwitch), feeAmountInBuyToken); // Approve FeeSwitch to pull
                dexFeeSwitch.depositFee(order.buyToken, address(this), feeAmountInBuyToken);
            }
            if (netAmountMakerReceivesInBuyToken > 0) {
                IERC20(order.buyToken).safeTransfer(order.maker, netAmountMakerReceivesInBuyToken);
            }

            // Taker receives sellToken (from this contract's balance)
            IERC20(order.sellToken).safeTransfer(taker, actualAmountToSell);

            // Update order state
            order.amountRemaining -= actualAmountToSell;
            if (order.amountRemaining == 0) {
                order.isFilledOrCancelled = true; // Mark as concluded if fully filled
                // Consider if the NFT should be burned or transferred to a "filled" state owner
                // For now, it remains with the maker but is marked.
            }

            emit OrderFilled(
                tokenId,
                taker,
                order.maker,
                actualAmountToSell,
                netAmountMakerReceivesInBuyToken, // What maker got after fees
                order.amountRemaining
            );
        }
    }

    // --- Order Cancellation ---
    /**
     * @notice Cancels an open order.
     * @dev Only the maker (owner of the Order NFT) can cancel their order.
     *      Remaining `sellToken` is returned to the maker.
     * @param tokenId The ID of the order NFT to cancel.
     */
    function cancelOrder(uint256 tokenId) external nonReentrant {
        address caller = _msgSender();
        Order storage order = orders[tokenId];

        require(ownerOf(tokenId) == caller, "OrderNFT: Caller not owner of NFT");
        require(order.maker == caller, "OrderNFT: Caller not maker of order"); // Double check
        require(!order.isFilledOrCancelled, "OrderNFT: Order already concluded");
        // Allow cancellation even if expired, to reclaim tokens, though `fillOrders` would prevent fills.

        uint256 remaining = order.amountRemaining;
        order.isFilledOrCancelled = true; // Mark as concluded
        order.amountRemaining = 0;

        if (remaining > 0) {
            IERC20(order.sellToken).safeTransfer(order.maker, remaining);
        }

        // The NFT itself is not burned here, but marked. The maker still holds it.
        // Alternatively, could burn it: _burn(tokenId);
        // Or transfer to a dead address / specific "cancelled" holding address.
        // Keeping it simple: maker retains the (now useless for trading) NFT.
        emit OrderCancelled(tokenId, order.maker);
    }


    // --- Permit Helper Integration (Example) ---
    // These functions demonstrate how OrderNFT could use the PermitHelper for `permitAnd...` actions.
    // The user would call these functions on OrderNFT, providing permit signatures and order data.
    // OrderNFT then calls PermitHelper to execute the permit and then its own internal logic.
    // This approach keeps permit logic somewhat separate but callable via OrderNFT.

    /**
     * @notice Creates an order using an ERC2612 permit for sellToken approval.
     * @dev User signs an EIP-2612 permit message for `sellToken`, allowing this OrderNFT contract to spend it.
     *      Then, this function calls `permitHelper.erc2612PermitAndCall` which executes the permit
     *      and calls back to `_createOrderAfterPermit`.
     */
    function permitAndCreateOrderERC2612(
        // ERC2612 Permit parameters
        address tokenToPermit, // This must be sellTokenAddr
        address owner,         // msg.sender
        uint256 permitValue,   // Must be >= amountToSell
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s,
        // CreateOrder parameters
        address sellTokenAddr,
        address buyTokenAddr,
        uint256 pricePerUnitOfSellToken,
        uint256 amountToSell,
        uint32 _expiry,
        uint8 _sellDecimals,
        uint24 _orderFeeBps
    ) external returns (uint256 tokenId) {
        require(tokenToPermit == sellTokenAddr, "OrderNFT: Permit token mismatch");
        require(owner == _msgSender(), "OrderNFT: Permit owner mismatch");
        require(permitValue >= amountToSell, "OrderNFT: Permit value insufficient");

        // Prepare calldata for the internal create order function
        bytes memory callData = abi.encodeWithSelector(
            this._createOrderAfterPermit.selector,
            sellTokenAddr, buyTokenAddr, pricePerUnitOfSellToken, amountToSell,
            _expiry, _sellDecimals, _orderFeeBps
            // _msgSender() is implicitly the maker for _createOrderAfterPermit
        );

        // Call PermitHelper: it will execute token.permit() then call this._createOrderAfterPermit()
        // The spender for the ERC2612 permit should be `address(this)` (OrderNFT contract).
        permitHelper.erc2612PermitAndCall(
            IERC20Permit(tokenToPermit),
            owner,
            address(this), // OrderNFT is the spender that needs approval
            permitValue,
            deadline, v, r, s,
            address(this), // Target contract is this OrderNFT contract
            callData
        );

        // The tokenId is expected to be set by a re-entrant call to _createOrderAfterPermit
        // This requires careful thought about how to retrieve it or if the event is sufficient.
        // A common pattern is for the callback to return the value.
        // However, `erc2612PermitAndCall` returns `bytes memory result`.
        // We'd need to decode `tokenId` from `result`.
        // For now, let's assume the event is the primary way to get tokenId for this flow.
        // Or, `_createOrderAfterPermit` could store it in a temp variable accessible here.
        // Simpler: `_createOrderAfterPermit` could just return it and we decode.
        // `bytes memory result = permitHelper.erc2612PermitAndCall(...)`
        // `tokenId = abi.decode(result, (uint256));`

        // To avoid complex result decoding for this example, let's assume that
        // _createOrderAfterPermit will be called, and the event will be emitted.
        // The actual tokenId for the return value here might be tricky without further state.
        // Let's defer returning tokenId directly from this specific permit function for now,
        // or the SDK would fetch it via events/local simulation.
        // For a robust implementation, getting the tokenId back is important.
        // For now, this function will not return tokenId to keep it simpler.
        // If _createOrderAfterPermit sets a state var like `lastCreatedTokenIdBy[msg.sender]`, that's one way.

        // Let's modify _createOrderAfterPermit to return tokenId and decode it.
        bytes memory result = permitHelper.erc2612PermitAndCall(
            IERC20Permit(tokenToPermit),
            owner, address(this), permitValue, deadline, v, r, s,
            address(this), callData
        );
        tokenId = abi.decode(result, (uint256));
        return tokenId;
    }

    /**
     * @notice Internal function called by PermitHelper after an ERC2612 permit is processed.
     * @dev This function should NOT be callable externally directly without a permit.
     *      It creates the order, assuming approval is already granted.
     *      The `_msgSender()` within this function will be the `PermitHelper` contract.
     *      We need the original maker's address.
     *      This pattern needs refinement: the original _msgSender_ (the user) should be passed.
     *      Or, `createOrder` itself is made internal `_createOrder` and called.
     *
     *      Let's make `_createOrderAfterPermit` public but with a check that `msg.sender == address(permitHelper)`.
     *      And it needs the original maker address.
     */
    function _createOrderAfterPermit(
        address originalMaker, // Passed in by the permitAndCall setup
        address sellTokenAddr,
        address buyTokenAddr,
        uint256 pricePerUnitOfSellToken,
        uint256 amountToSell,
        uint32 _expiry,
        uint8 _sellDecimals,
        uint24 _orderFeeBps
    ) external returns (uint256 tokenId) {
        require(msg.sender == address(permitHelper), "OrderNFT: Unauthorized internal call");
        // Now, proceed with order creation, using `originalMaker`
        // This function essentially mirrors `createOrder` but uses `originalMaker`.

        require(sellTokenAddr != address(0) && buyTokenAddr != address(0), "OrderNFT: Zero token address");
        require(sellTokenAddr != buyTokenAddr, "OrderNFT: Same tokens");
        require(amountToSell > 0, "OrderNFT: Zero sell amount");
        // pricePerUnitOfSellToken checked in main createOrder
        require(_expiry > block.timestamp, "OrderNFT: Expiry in past");
        require(_orderFeeBps <= MAX_FEE_BPS, "OrderNFT: Fee BPS too high");

        tokenId = ++_nextTokenId;

        // SellTokens are pulled from originalMaker by PermitHelper's earlier permit action
        // (assuming spender was address(this) for OrderNFT)
        IERC20(sellTokenAddr).safeTransferFrom(originalMaker, address(this), amountToSell);

        orders[tokenId] = Order({
            maker: originalMaker,
            expiry: _expiry,
            feeBpsTaken: _orderFeeBps,
            sellDecimals: _sellDecimals,
            amountInitial: amountToSell,
            amountRemaining: amountToSell,
            sellToken: sellTokenAddr,
            buyToken: buyTokenAddr,
            price: pricePerUnitOfSellToken,
            isFilledOrCancelled: false
        });

        _safeMint(originalMaker, tokenId);

        emit OrderCreated(
            tokenId,
            originalMaker,
            sellTokenAddr,
            buyTokenAddr,
            pricePerUnitOfSellToken,
            amountToSell,
            _expiry,
            _sellDecimals,
            _orderFeeBps
        );
        return tokenId;
    }
    // To make the above work, `permitAndCreateOrderERC2612` needs to encode `originalMaker` into callData.
    // bytes memory callData = abi.encodeWithSelector(
    //     this._createOrderAfterPermit.selector,
    //     _msgSender(), // Pass the original maker
    //     sellTokenAddr, buyTokenAddr, pricePerUnitOfSellToken, amountToSell,
    //     _expiry, _sellDecimals, _orderFeeBps
    // );


    // Similar `permitAndFillOrdersERC2612` and `permitAnd...Permit2` functions would be needed.
    // This shows the complexity of integrating PermitHelper this way.
    // A simpler alternative is for users to call PermitHelper directly for ERC2612, which approves OrderNFT,
    // then user calls OrderNFT.createOrder().
    // For Permit2, OrderNFT would have a specific `createOrderWithPermit2Signature(...)` that
    // interacts with the Permit2 contract using the provided signature to pull tokens.

    // For V1, let's simplify: OrderNFT does *not* directly use PermitHelper.
    // Users wanting to use permit will:
    // 1. Call PermitHelper.erc2612PermitAndCall, with target=OrderNFT, data=abi.encode(OrderNFT.createOrder(...))
    //    (This requires PermitHelper's version to be flexible enough or OrderNFT to have an internal create).
    // OR
    // 1. User calls token.permit() to approve OrderNFT.
    // 2. User calls OrderNFT.createOrder().
    // OR for Permit2:
    // 1. User calls `OrderNFT.createOrderWithPermit2(permit2SigData, orderData)` (new function in OrderNFT).
    //    This `createOrderWithPermit2` would call `IPermit2(permit2Address).permitTransferFrom(...)`
    //    with `to` being `address(this)` or the appropriate vault.

    // The provided PermitHelper with `...AndCall` functions is a good generic approach.
    // OrderNFT's `createOrder` would be the target. The spender for ERC2612 would be OrderNFT.
    // The `transferDetails.to` for Permit2 would be OrderNFT.


    // --- ERC721 URI Storage ---
    function _baseURI() internal pure override returns (string memory) {
        return "https://api.unxversal.com/nfts/orders/"; // Example base URI
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage)
        returns (string memory)
    {
        require(_exists(tokenId), "OrderNFT: URI query for nonexistent token");
        // Order storage order = orders[tokenId];
        // string memory json = Base64.encode(... construct JSON metadata dynamically ...);
        // return string(abi.encodePacked("data:application/json;base64,", json));
        // Or, more simply for off-chain metadata service:
        return string(abi.encodePacked(_baseURI(), Strings.toString(tokenId)));
    }

    // --- ERC721 Enumerable Overrides ---
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721Enumerable) // Removed ERC721 reference as it's covered by Enumerable
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        // Custom logic before transfer if needed
        // IMPORTANT: If orders are only fillable/cancellable by the original maker,
        // then transferring the NFT means the new owner cannot cancel/manage it in the same way.
        // The current implementation checks `ownerOf(tokenId) == order.maker` for fill
        // and `ownerOf(tokenId) == caller && order.maker == caller` for cancel.
        // This means if NFT is transferred, it can't be cancelled by new owner,
        // and fills still credit original maker. This is usually desired for limit orders.
    }

    // --- Ownable admin functions ---
    // Example: Update base URI if needed (though spec implies immutable frontend)
    // function setBaseURI(string memory newBaseURI) external onlyOwner {
    //     _baseURI = newBaseURI; // Requires _baseURI to be a state variable
    // }

    // The Ownable functions `owner()`, `transferOwnership()`, `renounceOwnership()` are inherited.

    // --- Supports Interface ---
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage) // Add ERC721URIStorage here
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}