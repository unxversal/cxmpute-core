// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* ──────────────── OpenZeppelin ──────────────── */
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/* ──────────────── Project deps ──────────────── */
import "./DexFeeSwitch.sol";
import "./utils/PermitHelper.sol";
import "../interfaces/structs/SPermit2.sol";
import "../interfaces/IPermit2.sol";

/**
 * @title OrderNFT
 * @author Unxversal Team
 * @notice ERC-721 that escrows sell-tokens and represents a limit order.
 */
contract OrderNFT is ERC721, ERC721Enumerable, ERC721URIStorage, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /* ──────────────── Storage ──────────────── */

    struct Order {
        address  maker;
        uint32   expiry;
        uint24   feeBpsTaken;
        uint8    sellDecimals;
        uint256  amountInitial;
        uint256  amountRemaining;
        address  sellToken;
        address  buyToken;
        uint256  price;          // PRICE_PRECISION scaled
        bool     isConcluded;
    }

    mapping(uint256 => Order) public orders;
    uint256 private _nextTokenId;

    DexFeeSwitch public immutable dexFeeSwitch;
    PermitHelper public immutable permitHelper;

    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MAX_FEE_BPS     = 1000; // 10 %
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /* ──────────────── Events ──────────────── */
    // ↳ max. 3 indexed parameters allowed
    event OrderCreated(
        uint256 indexed tokenId,
        address indexed maker,
        address indexed sellToken,
        address buyToken,
        uint256 price,
        uint256 amountInitial,
        uint32  expiry,
        uint8   sellDecimals,
        uint24  feeBps
    );

    event OrderFilled(
        uint256 indexed tokenId,
        address indexed taker,
        address indexed maker,
        uint256 amountSold,
        uint256 amountBoughtNet,
        uint256 feeAmount,
        uint256 amountRemainingInOrder
    );

    event OrderCancelled(
        uint256 indexed tokenId,
        address  indexed maker,
        uint256 amountReturned
    );

    /* ──────────────── Constructor ──────────────── */
    constructor(
        string memory name_,
        string memory symbol_,
        address      _dexFeeSwitch,
        address      _permitHelper,
        address      initialOwner
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        require(_dexFeeSwitch  != address(0), "OrderNFT: fee switch 0");
        require(_permitHelper  != address(0), "OrderNFT: permit helper 0");
        dexFeeSwitch = DexFeeSwitch(_dexFeeSwitch);
        permitHelper = PermitHelper(_permitHelper);
    }

    /* ──────────────── Order creation (manual approve) ──────────────── */
    function createOrder(
        address sellTokenAddr,
        address buyTokenAddr,
        uint256 pricePerUnitOfSellToken,
        uint256 amountToSell,
        uint32  expiry_,
        uint8   sellDecimals_,
        uint24  orderFeeBps_
    ) external nonReentrant returns (uint256 tokenId) {
        /* validation */
        require(sellTokenAddr != address(0) && buyTokenAddr != address(0), "OrderNFT: zero token");
        require(sellTokenAddr != buyTokenAddr,                         "OrderNFT: same token");
        require(amountToSell   > 0,                                    "OrderNFT: zero amount");
        require(pricePerUnitOfSellToken > 0,                           "OrderNFT: zero price");
        require(expiry_  > block.timestamp,                            "OrderNFT: expiry past");
        require(orderFeeBps_ <= MAX_FEE_BPS,                           "OrderNFT: fee > max");

        /* escrow sell-token */
        IERC20(sellTokenAddr).safeTransferFrom(msg.sender, address(this), amountToSell);

        /* mint order NFT */
        tokenId = ++_nextTokenId;
        orders[tokenId] = Order({
            maker:           msg.sender,
            expiry:          expiry_,
            feeBpsTaken:     orderFeeBps_,
            sellDecimals:    sellDecimals_,
            amountInitial:   amountToSell,
            amountRemaining: amountToSell,
            sellToken:       sellTokenAddr,
            buyToken:        buyTokenAddr,
            price:           pricePerUnitOfSellToken,
            isConcluded:     false
        });

        _safeMint(msg.sender, tokenId);

        emit OrderCreated(
            tokenId, msg.sender, sellTokenAddr, buyTokenAddr, pricePerUnitOfSellToken,
            amountToSell, expiry_, sellDecimals_, orderFeeBps_
        );
    }

    /* ──────────────── Filling orders ──────────────── */
    function fillOrders(
        uint256[] calldata tokenIds,
        uint256[] calldata amountsToFill /* sell-token amounts */
    ) external nonReentrant {
        require(tokenIds.length == amountsToFill.length && tokenIds.length != 0,
                "OrderNFT: length mismatch");

        address taker = msg.sender;

        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId  = tokenIds[i];
            uint256 wantSell = amountsToFill[i];
            require(wantSell > 0, "OrderNFT: zero fill");

            Order storage o = orders[tokenId];
            require(!o.isConcluded,                "OrderNFT: concluded");
            require(ownerOf(tokenId) == o.maker,   "OrderNFT: maker no hold");
            require(block.timestamp < o.expiry,    "OrderNFT: expired");
            require(o.amountRemaining > 0,         "OrderNFT: filled");

            uint256 sellAmt = Math.min(wantSell, o.amountRemaining);
            uint256 buyGross = Math.mulDiv(sellAmt, o.price, PRICE_PRECISION);

            uint256 fee = (buyGross * o.feeBpsTaken) / BPS_DENOMINATOR;
            uint256 buyNet = buyGross - fee;

            /* taker pays buyToken */
            IERC20(o.buyToken).safeTransferFrom(taker, address(this), buyGross);

            if (fee > 0) {
                IERC20(o.buyToken).approve(address(dexFeeSwitch), fee);
                dexFeeSwitch.depositFee(o.buyToken, address(this), fee);
            }
            if (buyNet > 0) IERC20(o.buyToken).safeTransfer(o.maker, buyNet);

            /* taker receives sellToken */
            IERC20(o.sellToken).safeTransfer(taker, sellAmt);

            /* state update */
            o.amountRemaining -= sellAmt;
            if (o.amountRemaining == 0) o.isConcluded = true;

            emit OrderFilled(
                tokenId, taker, o.maker, sellAmt, buyNet, fee, o.amountRemaining
            );
        }
    }

    /* ──────────────── Cancel order ──────────────── */
    function cancelOrder(uint256 tokenId) external nonReentrant {
        Order storage o = orders[tokenId];
        require(ownerOf(tokenId) == msg.sender, "OrderNFT: not owner");
        require(o.maker           == msg.sender, "OrderNFT: not maker");
        require(!o.isConcluded,                 "OrderNFT: done");

        uint256 refund = o.amountRemaining;
        o.amountRemaining = 0;
        o.isConcluded     = true;

        if (refund > 0) IERC20(o.sellToken).safeTransfer(o.maker, refund);
        emit OrderCancelled(tokenId, o.maker, refund);
    }

    /* ──────────────── Permit helpers (unchanged) ──────────────── */
    /// …  (createOrderWithPermitERC2612 / createOrderWithPermit2 and _createOrderAuthorized unchanged)
    /// For brevity, these functions are identical to the previous code block
    /// and are omitted here. The compilation fixes concern only OZ-5 clashes.

    /* ──────────────── Metadata ──────────────── */
    function _baseURI() internal pure override returns (string memory) {
        return "https://example.com/";
    }

    function tokenURI(uint256 tokenId)
        public view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        _requireOwned(tokenId);
        return string(abi.encodePacked(_baseURI(), Strings.toString(tokenId)));
    }

    /* ──────────────── OpenZeppelin 5 hook reconciliation ──────────────── */
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value); // Enumerable keeps its own counters
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address from)
    {
        from = super._update(to, tokenId, auth); // each base updates its own state
    }

    /* ──────────────── Interface support ──────────────── */
    function supportsInterface(bytes4 interfaceId)
        public view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
