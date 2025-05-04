// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/**
 * Helper to create / verify EIP‑712 order hashes consistently between
 * off‑chain matcher and on‑chain settlement (future‑proof).
 *
 * NOTE: This is deployed as a library; you may embed in a helper contract
 *       if you want view‑based signature checks on‑chain.
 */
abstract contract OrderHashLib is EIP712 {
    /* -------- ORDER STRUCT DEFINITION (must match off‑chain) -------- */
    struct Order {
        address trader;
        bytes32 market;   // eg. keccak256("BTC-PERP")
        uint8   side;     // 0 = BUY, 1 = SELL
        uint8   orderType;
        uint256 qty;
        uint256 price;    // 0 for pure market orders
        uint256 expiry;   // 0 if not expiring
        uint256 nonce;
    }

    bytes32 internal constant ORDER_TYPEHASH =
        keccak256(
            "Order(address trader,bytes32 market,uint8 side,uint8 orderType,uint256 qty,uint256 price,uint256 expiry,uint256 nonce)"
        );

    constructor() EIP712("CXPT‑DEX", "1") {}

    /* ------------------------------------------------------------ */
    /*                         Hash helper                          */
    /* ------------------------------------------------------------ */

    function hashOrder(Order memory order) public view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        ORDER_TYPEHASH,
                        order.trader,
                        order.market,
                        order.side,
                        order.orderType,
                        order.qty,
                        order.price,
                        order.expiry,
                        order.nonce
                    )
                )
            );
    }

    /* ------------------------------------------------------------ */
    /*                 Off‑chain / on‑chain verification            */
    /* ------------------------------------------------------------ */

    function verify(
        Order memory order,
        bytes calldata sig
    ) public view returns (bool) {
        bytes32 digest = hashOrder(order);
        return SignatureChecker.isValidSignatureNow(order.trader, digest, sig);
    }
}