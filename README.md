### 0.  Guiding idea  
All *complex* math and matching lives **off-chain in serverless Lambdas**; the chain is only a custody & settlement root-of-truth.  
Everything is wire-framed with SST components so you can `sst dev` the whole stack locally.

---

## 1.  Bird’s-eye diagram

```
┌────────────────┐      REST / WebSocket      ┌──────────────────────┐
│  React  (FE)   │◄──────────────────────────►│  Next.js API routes  │──┐
└────────────────┘                             └─────────┬────────────┘  │
                                                        SQS (FIFO)       │
                                             OrdersQueue ────────► Match λ│
                                                                        │ │
                                DynamoDB (Orders, Trades, Positions, Markets)
                              Stream        │          │          │       │
                                ▼           ▼          ▼          ▼       │
                        depth λ → WS   pnl λ → DB   expiry λ   oracle λ   │
                                                                        ▼ │
                                                          SettlementQueue │
                                                                        ▼ │
                                                      Settlement λ (viem) │
                                                                        ▼ │
                                                        Engine + Vault  ◄─┘
                                                         (Solidity)
```

* **Front-end**: Next.js app router, React, TanStack Query, listens on WebSocket topics (`depth:BTC-USDC`, `trade:*`, `pnl:<uid>`).  
* **Next.js backend**: normal `/app/api/*.ts` routes compiled by **`sst.aws.Nextjs`** → Lambda@Edge.  
* **OrdersQueue (SQS FIFO)**: enforces price-time priority, eliminates duplicates.  
* **Match Lambda**: single source of truth for crossing; uses Dynamo conditional writes.  
* **Dynamo tables**:  
  * `Orders` — open status rows  
  * `Trades` — immutable fills  
  * `Positions` — net positions & PnL per user / product  
  * `Markets` — metadata, index prices, expiries  
* **Streams & fan-out**: Dynamo Streams trigger tiny Lambdas that push updates to WebSocket or run accounting.  
* **Settlement path**: match λ writes fill to **SettlementQueue** → settlement λ batches `Engine.settleBatch()` txs; **Vault** moves USDC.  
* **Side cars**:  
  * **Cron** (`sst.aws.Cron`) for funding & expiry.  
  * **Bus** (EventBridge) for admin ops (`market.pause`).  
  * **KinesisStream** for on-chain event indexing → S3 parquet.

---

## 2.  Placing an order (all products share steps ❶-❹)

| # | Component | What happens |
|---|-----------|--------------|
| ❶ Browser | Builds EIP-712 order struct, signs it, `POST /api/order`. |
| ❷ API route | – Validates JWT & nonce<br>– *Optional* pre-check `sharesOf()` on Vault<br>– `SendMessage` into **OrdersQueue** with `MessageGroupId = market`, `DedupId = hash`. |
| ❸ SQS FIFO | Guarantees arrival order within a market. |
| ❹ **Match λ** | Pops 1-10 msgs → loops:<br>• scans opposite side in `Orders`<br>• conditional `transactWrite` to insert `Trades` & update rows<br>• puts remaining qty back if needed<br>• pushes fills to **SettlementQueue**. |
| ❺ Dynamo Stream | Triggers:<br>a) `depthBroadcast.handler` → WS<br>b) `pnl.handler` (spot) → `Positions` |
| ❻ Settlement λ | Every ≤30 s or 500 fills—calls Solidity `Engine.settleBatch`. |
| ❼ Engine contract | Verifies EIP-712 digest list, moves USDC in **Vault** with a single `transferFrom` per fill, emits `Fill` event. |

---

### Product-specific tweaks

| Product | Matcher logic | Settlement λ logic | Periodic jobs |
|---------|---------------|--------------------|---------------|
| **Spot (Market/Limit)** | Nothing special. | Settle each fill immediately. | — |
| **Perpetual** | Same as spot. | Settle notional USDC; positions stay in `Positions`. | Hourly `fundingCron` adjusts PnL via synthetic fill. |
| **Futures** | Same as spot. | Settle notional; leave open until expiry date in `Markets`. | `expiryCron` enqueues `FUTURE_SETTLE`, Engine nets PnL at index price. |
| **Options** | Stores `premium` & greeks on put order; crossing swaps premium USDC. | Immediate premium transfer; collateral stays locked in Vault. | `expiryCron` exercises ITM → Vault pays intrinsic. |

---

## 3.  DynamoDB schema cheat-sheet

| Table | PK / SK pattern | GSI examples |
|-------|-----------------|--------------|
| `Orders` | `MARKET#BTC-USDC` / `SIDE#BUY#P=30000#TS=...#OID` | `UserOrdersGSI (PK=USER#xyz)` |
| `Trades` | `MARKET#BTC-USDC` / `TS#...#TID` | `UserTradesGSI` |
| `Positions` | `USER#xyz` / `MARKET#BTC-PERP` | — |
| `Markets` | `MARKET#BTC-PERP` / `INFO` | `ExpiryIndex (expiryTimestamp)` |

All writes are done with **conditional expressions** (`attribute_not_exists`) to ensure idempotence.

---

## 4.  On-chain contracts (Solidity)

| Contract | What it does | Gas footprint |
|----------|--------------|---------------|
| **Vault** (`ERC-4626`-lite) | Single-token custody (USDC). Mint “shares”, burn on withdraw. | ~40 k per deposit |
| **Engine** | `settleBatch(Fill[] calldata)`<br>• loops over fills, verifies EIP-712 digest, moves funds<br>• emits `Fill(bytes32 id)` | 5–7 k per fill (plus loop) |
| **MarketRegistry** | Immutable metadata (base, quote, kind, expiry). | view-only |
| **WithdrawalQueue** | Two-tx withdraw (request → settle) to avoid MEV. | ~25 k |

*A single signer wallet (kept in AWS Secrets Manager) is whitelisted in Engine and used by Settlement λ.*

---

## 5.  Real-time UX channels

| Feed | Source | Transport |
|------|--------|-----------|
| Depth snapshot & deltas | `depthBroadcast.handler` | `ApiGatewayWebSocket broadcast("depth:<market>", json)` |
| Trades ticker | `tradeBroadcast.handler` (triggered by stream) | WS `trade:<market>` |
| User fills / PnL | `pnl.handler` writes `Positions`; same Lambda pushes WS `pnl:<uid>` |
| Admin events (halt, change leverage) | EventBridge | WS `alert:*` |

Front-end subscribes once on connect; updates redraw React charts in <100 ms p95.

---

## 6.  Infrastructure blocks (SST)

```ts
// Orders FIFO queue
const ordersQ = new sst.aws.Queue("OrdersQueue", {
  fifo: { contentBasedDeduplication: true },
  visibilityTimeout: "30 seconds",
});

// Core tables
const ordersTbl = new sst.aws.Dynamo("Orders", {...});
const tradesTbl = new sst.aws.Dynamo("Trades", {...});
const posTbl    = new sst.aws.Dynamo("Positions", {...});
const mktTbl    = new sst.aws.Dynamo("Markets", {...});

// Matcher
ordersQ.subscribe({
  handler: "src/match.handler",
  batch: { size: 10, window: "0 seconds" },
  link: [ordersTbl, tradesTbl, posTbl, mktTbl],
});

// Settlement
const settleQ = new sst.aws.Queue("SettlementQueue");
settleQ.subscribe({
  handler: "src/settle.handler",
  link: [tradesTbl],
  timeout: "60 seconds",
});

// Next.js app + WebSocket + auth pool
new sst.aws.Nextjs("Web", { link: [ordersQ, ordersTbl, posTbl, settleQ] });
new sst.aws.ApiGatewayWebSocket("WS", {...});
new sst.aws.CognitoUserPool("Pool");
```

---

## 7.  Cash-settled multi-pair model

* All books quote **native prices** (\, ETH/BTC = 0.058) ✔.  
* Every fill’s notional is converted to USD using oracle prices; **USDC** is the only asset that ever leaves the Vault.  
* Roadmap:  
  * enable multi-token custody by upgrading Vault, or  
  * auto-swap USDC → asset via Uniswap in Settlement λ.

---

## 8.  Ops & security quick list

* **IAM least-privilege**: match λ cannot talk to chain; settle λ cannot access SQS.  
* **VPC endpoints** for Dynamo/SQS/Secrets-Mgr (no public egress).  
* **SQS DLQs** + CloudWatch alarm for poison pills.  
* **Chaos Lambda** cron randomly kills 1 % of matches in dev to prove idempotence.  
* **Audit pipeline**: Kinesis → S3 parquet → Athena diff vs chain events nightly.

---

### TL;DR

1. **Next.js API routes** act as thin HTTP façades; they *only* enqueue or query Dynamo.  
2. **SQS FIFO → Match Lambda → Dynamo conditional writes** = deterministic, horizontally scalable orderbook.  
3. **Settlement Lambda** is the *only* thing allowed to hit Ethereum, batching hundreds of fills into one cheap tx.  
4. All pairs (even ETH/BTC) are **synthetic** and *cash-settled* in USDC until you add a multi-asset Vault.  
5. Every state change (orders, fills, depth, PnL) is streamed to the front-end in real-time via API-GW WebSockets.

Plug this into SST, push to AWS, and you have a production-grade hybrid order-book DEX with zero servers to babysit. Let me know which file you want to implement first and we’ll code it line-by-line.