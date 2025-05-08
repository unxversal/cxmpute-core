
# Public Trading API: `/api/v1/trade`

This endpoint allows authenticated traders to manage their orders (create, cancel, view) on the DEX for both **REAL** and **PAPER** trading modes.

## Authentication

All requests to this endpoint **must** include the trader's unique access key in the `X-Trader-Ak` header.

```
X-Trader-Ak: <your_unique_trader_access_key>
```

If the key is missing, invalid, or the associated trader account is inactive, a `401 Unauthorized` or `403 Forbidden` error will be returned.

## CORS

This endpoint is configured with permissive CORS headers (`Access-Control-Allow-Origin: *`), allowing requests from any origin (e.g., browser-based applications, scripts).

A preflight `OPTIONS` request is supported and will respond with allowed methods (`GET, POST, DELETE`) and headers (`Content-Type, X-Trader-Ak`).

## Methods

---

### 1. `POST /api/v1/trade` - Create a New Order

Places a new order on the specified market and trading mode.

**Request Headers:**

*   `Content-Type: application/json`
*   `X-Trader-Ak: <your_trader_access_key>`

**Request Body:**

```jsonc
// All fields except where noted are required
{
  "mode": "REAL" | "PAPER",         // Required: The trading mode
  "market": "string",               // Required: e.g., "BTC-PERP", "ETH-USD-SPOT", "SOL-DEC24-FUT", "PEAQ-100-CALL-30SEP24"
  "orderType": "MARKET" | "LIMIT" | "PERP" | "FUTURE" | "OPTION", // Required
  "side": "BUY" | "SELL",            // Required
  "qty": number,                    // Required: Order quantity (must be > 0)
  "price": number,                  // Required for LIMIT, PERP, FUTURE, OPTION (must be > 0)
  // --- Optional / Type-Specific ---
  "expiryTs": number,               // Required for FUTURE, OPTION (Unix ms timestamp > now)
  "strike": number,                 // Required for OPTION (must be > 0)
  "optionType": "CALL" | "PUT"      // Required for OPTION
}
```

**Successful Response (`201 Created`):**

Returns the full order object as created in the system, including the generated `orderId` and the internal primary key (`pk`).

```jsonc
{
  "orderId": "uuid...",
  "traderId": "uuid...", // Authenticated trader's ID
  "market": "BTC-PERP",
  "orderType": "LIMIT",
  "side": "BUY",
  "qty": 0.1,
  "price": 65000,
  "filledQty": 0,
  "createdAt": 1725500000000, // ms timestamp
  "status": "OPEN",
  "feeBps": 50,
  "sk": "TS#uuid...",
  "pk": "MARKET#BTC-PERP#REAL", // Internal key
  "mode": "REAL"
  // + expiryTs, strike, optionType for futures/options
}
```

**Example cURL:**

```bash
curl -X POST https://<your-dex-api-host>/api/v1/trade \
  -H "Content-Type: application/json" \
  -H "X-Trader-Ak: your_trader_access_key_here" \
  -d '{
        "mode": "PAPER",
        "market": "ETH-PERP",
        "orderType": "LIMIT",
        "side": "SELL",
        "qty": 1.5,
        "price": 3550.75
      }'
```

---

### 2. `DELETE /api/v1/trade` - Cancel an Order

Cancels an existing `OPEN` or `PARTIAL` order belonging to the authenticated trader.

**Request Headers:**

*   `Content-Type: application/json`
*   `X-Trader-Ak: <your_trader_access_key>`

**Request Body:**

```jsonc
{
  "orderId": "string" // Required: The ID of the order to cancel
}
```

**Successful Response (`200 OK`):**

```json
{
  "ok": true,
  "message": "Order <orderId> cancelled."
}
```

**Example cURL:**

```bash
curl -X DELETE https://<your-dex-api-host>/api/v1/trade \
  -H "Content-Type: application/json" \
  -H "X-Trader-Ak: your_trader_access_key_here" \
  -d '{
        "orderId": "a1b2c3d4e5f6..."
      }'
```

---

### 3. `GET /api/v1/trade` - Get Orders

Retrieves a list of orders placed by the authenticated trader, with optional filters. Orders are returned most recent first.

**Request Headers:**

*   `X-Trader-Ak: <your_trader_access_key>`

**Query Parameters:**

*   `mode=REAL|PAPER` ( **Required** ) - Filter orders by trading mode.
*   `market=string` (Optional) - Filter orders for a specific market (e.g., `BTC-PERP`).
*   `status=OPEN|PARTIAL|FILLED|CANCELLED|EXPIRED` (Optional) - Filter orders by status.

**Successful Response (`200 OK`):**

Returns an array of order objects matching the filters. Each object has the same structure as the response from the `POST` request.

```jsonc
[
  {
    "orderId": "uuid...",
    "traderId": "uuid...",
    "market": "BTC-PERP",
    "orderType": "LIMIT",
    "side": "BUY",
    "qty": 0.1,
    "price": 65000,
    "filledQty": 0.05,
    "createdAt": 1725500000000,
    "status": "PARTIAL",
    "feeBps": 50,
    "sk": "TS#uuid...",
    "pk": "MARKET#BTC-PERP#REAL",
    "mode": "REAL",
    "updatedAt": 1725501000000 // Example: includes update timestamp if available
  },
  // ... more orders
]
```

**Example cURL (Get open PAPER orders for ETH-PERP):**

```bash
curl -G https://<your-dex-api-host>/api/v1/trade \
  -H "X-Trader-Ak: your_trader_access_key_here" \
  --data-urlencode "mode=PAPER" \
  --data-urlencode "market=ETH-PERP" \
  --data-urlencode "status=OPEN"
```

---

## Error Handling

The API uses standard HTTP status codes and returns JSON error objects:

| Status Code | Example Error Message                                                       | Meaning                                                                |
| :---------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `400 Bad Request` | `invalid or missing 'mode' (REAL or PAPER)`                               | Required field missing or invalid value in request body/query params.  |
| `400 Bad Request` | `price required and must be positive for non-market orders`               | Business logic violation (e.g., trying to cancel a filled order).        |
| `401 Unauthorized` | `Missing X-Trader-Ak header` or `Invalid Trader Access Key`             | Authentication failed.                                                 |
| `403 Forbidden` | `Trader account is not active` or `You can only cancel your own orders` | Authentication succeeded, but the action is not permitted for this user. |
| `404 Not Found` | `Order not found`                                                           | The specified `orderId` (for DELETE) does not exist.                   |
| `409 Conflict`  | `Order creation conflict (possible duplicate)` or `Order status changed...` | Resource conflict (e.g., duplicate order, race condition on cancel).   |
| `500 Internal Server Error` | `Internal server error ...`                                       | An unexpected error occurred on the server.                            |

All error responses include the `Access-Control-Allow-Origin: *` header.
