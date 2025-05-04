
## 1  On-chain layer  (settlement & collateral)

| Contract | Purpose | Notes |
|---|---|---|
| **Vault (upgradeable)** | Holds 100 % USDC collateral, tracks user balances in shares. | One deposit/withdraw entry-point. |
| **CXPT ERC-20** | Governance / fee-rebate token. | Minted 1 : 1 in Vault when a user chooses `withdraw(asCxpt = true)`. |
| **SynthERC20 (per asset)** | Off-chain order book trades these 1 : 1-backed tokens. | Deterministic `create2`; no factory contract needed. |
| **Order-hashing lib (EIP-712)** | Typed-data domain for off-chain signatures. | Enables cancel-by-sig, self-trade-prevent, MM bots. |

> **No on-chain matching.**  
> Latency target < 100 ms + fully-paid orders → off-chain order book + on-chain net settlement.

---

## 2  Off-chain core  (Next.js `route.ts` + SST constructs)

### REST / HTTP routes

| Route | Description |
|---|---|
| `POST /orders` | Create market / limit / option / perp / future.<br>Body = typed DTO + EIP-712 signature. |
| `DELETE /orders/:id` | Cancel single or bulk (filter). |
| `GET /orders` | Paginated query. |
| `GET /positions` | Live positions & PnL. |
| `POST /admin/markets` | Create / pause / delete market (Cognito group-gated). |
| `POST /vault/withdraw` | Withdraw USDC or CXPT. |

All deployed as **Lambda@Edge** via `sst.Api` for cold-start < 100 ms.

### WebSocket channels  (`sst.ApiGatewayWebSocket`)

| Channel | Message types | Emitted by |
|---|---|---|
| `market.<symbol>` | `depth`, `trade`, `markPrice`, `fundingRate` | Matcher Lambda |
| `trader.<uuid>` | `orderUpdate`, `positionUpdate`, `liquidationAlert` | Matcher Lambda |
| `admin.<market>` | `stateChange` | Admin Lambdas |

**Broadcast fan-out**

```
matcher → SNS Topic “MarketUpdates” → Fan-out Lambda → postToConnection (batch)
```

Uses SST’s **`SnsTopic`** and **`ApiGatewayWebSocket`** constructs—no extra infra.

---

## 3  Data & state

| Table (DynamoDB) | PK | SK | TTL / GSIs | Purpose |
|---|---|---|---|---|
| **Orders** | `MARKET#BTC-PERP` | `TS#<uuid>` | GSI `TRADER#uuid` | One table for all order types (`orderType` attr). |
| **Trades** | `MARKET#BTC-PERP` | `TS#<uuid>` | GSI `TRADER#uuid` <br>**Stream → Firehose** | Raw fills; stream feeds cold archive. |
| **Positions** | `TRADER#uuid` | `MARKET#BTC-PERP` | – | Net position snapshot, updated atomically. |
| **Markets** | `MARKET#BTC-PERP` | `META` | GSI `status` | Tick size, expiryTs, funding params… |
| **Prices** | `ASSET#BTC` | `TS#<iso>` | TTL 7 d | Oracle snapshots for TWAP / funding. |
| **StatsIntraday** | `MARKET#BTC-PERP` | `2025-05-01T14:30` | TTL 48 h | 1-min (or 5 s) buckets for dashboards. |
| **StatsDaily** | `MARKET#BTC-PERP` | `2025-05-01` | none | 24 h aggregates, retained 3–12 mo. |
| **WSConnections** | `WS#<connId>` | `META` | TTL 24 h | Connection registry for push. |

**Cold history lake**

```
Dynamo Streams (Trades) → Kinesis Firehose → S3 parquet:
  s3://dex-analytics/raw/YYYY/MM/DD/...
```

Athena / Glue / Redash query the lake on demand.

---

## 4  Event & compute flows

### 4.1  Order ingress ➜ matcher

1. **API Lambda** validates & `putItem` Order (`condition attribute_not_exists`).
2. **DDB Stream → EventBridge Pipe → SQS FIFO** keyed by market type.
3. **Matcher Lambda / ECS Fargate**  
   *micro-batch 10-50 orders*  
   - Updates in-memory book, finds matches.  
   - `TransactWriteItems`: update Orders, insert Trades, update Positions, update **StatsIntraday** (`ADD volume, trades …`).  
   - Publishes WS payload to SNS.  

### 4.2  Metrics flow

| Step | Component | Action |
|---|---|---|
| **A (Real-time)** | Matcher write | In same transaction, `ADD` to **StatsIntraday** (minute bucket). |
| **B (Archive)** | Streams → Firehose | Each Trade stream record lands in S3 parquet. |
| **C (Roll-up)** | Cron `0 0 * * ? *` | 1. Scan yesterday’s minute rows → aggregate.<br>2. `putItem` → **StatsDaily**.<br>3. Push aggregate JSON to Firehose `daily/` in S3.<br>4. Intraday rows auto-expire after 48 h via TTL. |

### 4.3  Scheduled jobs

| Job | Interval | Logic |
|---|---|---|
| Funding tick | 1 h per perp | `fundingRate = mark - index`; insert Trade. |
| Option expiry | per contract | Cash-settle ITM -> USDC. |
| Future expiry | per contract | Cash-settle at index. |
| Oracle fetch | 30 s | Chainlink / Pyth → **Prices**. |

---

## 5  Metrics & observability

### Storage tiers

| Tier | Resolution | Retention | Store | Query path |
|---|---|---|---|---|
| **Hot** | 1 min (or 5 s) | 48 h | `StatsIntraday` | REST dashboards (`<15 ms`). |
| **Warm** | 1 day | 3–12 mo | `StatsDaily` | Leaderboards, 30-d charts. |
| **Cold** | per Trade / delta | years | S3 parquet | Athena / Glue / BI tools. |

### Key trading metrics (all updated into Stats* tables)

- 24 h volume (USDC / CXPT) - Open interest & Δ% - Depth@1 bp / 5 bp  
- Funding rate (perps) - Implied vol (options) - Protocol fees - Trader realised / unrealised PnL  
- Infra SLOs (order-→-fill p95 latency)

---

## 6  Security, fees, admin quirks

- **Flat 0.5 % fee** deducted in matcher transaction (maker & taker).
- **Idempotency** header on every order/cancel.
- **Admin auth** via SST `Auth` / Cognito groups; Lambdas verify JWT.
- **Circuit breaker**: `Markets.status = PAUSED` checked in API & matcher.
- **Rate-limits**: CloudFront WAF token-bucket keyed by IP + API-key.

---

## 7  Biggest deltas vs the very first draft

| Area | First draft | Final architecture |
|---|---|---|
| Metrics storage | Single 24 h table | **StatsIntraday + StatsDaily + S3 lake** three-tier design. |
| Cold archive | – | Trades stream → Firehose → S3 parquet. |
| Cost profile | All Dynamo forever | Hot/warm in Dynamo, cheap S3 for deep history. |
| Fan-out | “Better approach?” | SNS Topic → Fan-out Lambda → WebSocket. |

---

## 8  Next concrete steps

1. **Define TypeScript interfaces** (`Order`, `Trade`, …) with discriminated `orderType`.  
2. **Prototype in-memory matcher** (single-process) to prove `TransactWriteItems` pattern.  
3. Deploy **Vault + CXPT** contracts on testnet; wire deposit / withdraw.  
4. Ship **Oracle cron** + `Prices` table early to unblock funding math.  
5. Stand up **WebSocket fan-out** path (SNS → Lambda → `postToConnection`) before front-end integration.  
6. Implement **roll-up Lambda** (scan minute rows → daily row → push to Firehose).