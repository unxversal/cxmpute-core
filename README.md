# **Revised Hybrid‑Order‑Book DEX Architecture (no Firehose, simple metrics tiering)**

---

## **1  On‑chain layer (settlement & collateral)**

| Contract                     | Purpose                                                     | Notes                                                                    |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Vault (UUPS‑upgradeable)** | Holds 100 % USDC collateral; tracks balances in **shares**. | Single `deposit()` / `withdraw(asCxpt?: bool)` entry‑point.              |
| **CXPT ERC‑20**              | Governance + fee‑rebate token.                              | Mint **1 : 1** inside `Vault.withdraw(asCxpt)`; only trades on this DEX. |
| **SynthERC20 (N × assets)**  | 1 : 1‑backed tokens the off‑chain book exchanges.           | Deterministic `CREATE2`; no factory required.                            |
| **EIP‑712 order‑hash lib**   | Typed‑data domain shared by all order types.                | Enables cancel‑by‑sig & bot trading.                                     |

> **No on‑chain matching.**
> Latency target < 100 ms; all orders fully pre‑paid.

---

## **2  Off‑chain core (Next.js `route.ts` + SST constructs)**

### REST / HTTP

| Route                  | Description                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `POST /orders`         | Create market / limit / option / perp / future. Body = discriminated DTO + EIP‑712 sig. |
| `DELETE /orders/:id`   | Cancel single or bulk (filter).                                                         |
| `GET /orders`          | Paginated query.                                                                        |
| `GET /positions`       | Live positions & PnL.                                                                   |
| `POST /admin/markets`  | Create ∣ pause ∣ delete market (Cognito group‑gated).                                   |
| `POST /vault/withdraw` | Withdraw USDC **or** CXPT.                                                              |

*All routes deployed as **Lambda\@Edge** via `sst.aws.Nextjs` for <100 ms cold‑start.*

### WebSocket channels (`sst.ApiGatewayWebSocket`)

| Channel           | Messages                                            | Emitted by |
| ----------------- | --------------------------------------------------- | ---------- |
| `market.<symbol>` | `depth`, `trade`, `markPrice`, `fundingRate`        | Matcher Fn |
| `trader.<uuid>`   | `orderUpdate`, `positionUpdate`, `liquidationAlert` | Matcher Fn |
| `admin.<market>`  | `stateChange`                                       | Admin Fns  |

**Broadcast fan‑out**

```
matcher ➜ SNS Topic “MarketUpdates” ➜ FanOut Fn ➜ postToConnection (batch)
```

Uses `sst.aws.SnsTopic` + `sst.aws.Function`.

---

## **3  Data & state (DynamoDB + S3)**

| Table             | PK                | SK                 | TTL / GSIs                                           | Purpose                                         |
| ----------------- | ----------------- | ------------------ | ---------------------------------------------------- | ----------------------------------------------- |
| **Orders**        | `MARKET#BTC-PERP` | `TS#<uuid>`        | GSI `TRADER#uuid`                                    | One table, `orderType` attribute discriminates. |
| **Trades**        | `MARKET#BTC-PERP` | `TS#<uuid>`        | GSI `TRADER#uuid` <br>**Stream → TradesArchiver Fn** | Raw fills; stream feeds archive.                |
| **Positions**     | `TRADER#uuid`     | `MARKET#BTC-PERP`  | –                                                    | Net snapshot, updated atomically.               |
| **Markets**       | `MARKET#BTC-PERP` | `META`             | GSI `status`                                         | Tick size, expiryTs, funding params …           |
| **Prices**        | `ASSET#BTC`       | `TS#<iso>`         | TTL 7 d                                              | Oracle snapshots (TWAP / funding).              |
| **StatsIntraday** | `MARKET#BTC-PERP` | `2025‑05‑03T20:15` | TTL 48 h                                             | 1‑min (or 5 s) buckets.                         |
| **StatsDaily**    | `MARKET#BTC-PERP` | `2025‑05‑03`       | –                                                    | 24 h aggregates, retained 12 mo.                |
| **StatsLifetime** | `KEY#GLOBAL`      | `META`             | –                                                    | **Single row** holding all‑time totals.         |
| **WSConnections** | `WS#<connId>`     | `META`             | TTL 24 h                                             | Connection registry.                            |

### Cold history lake (no Firehose)

```
Dynamo Stream (Trades) ➜ TradesArchiver Fn ➜ putObject
      s3://dex-data-lake/trades/2025/05/03/...
```

`TradesArchiver` is an `sst.aws.Function` subscribed to the **Trades** stream.

---

## **4  Event & compute flows**

### 4.1 Order ingress ➜ Matcher

1. **API Fn** validates & `putItem` **Orders** (`condition attribute_not_exists`).
2. **Dynamo Stream → EventBridge Pipe → SQS FIFO** (partitionKey = market).
3. **Matcher Fn / ECS Fargate** (micro‑batch 10‑50):

   * Update in‑mem book, discover matches.
   * `TransactWriteItems`:

     * update Orders, insert Trades, update Positions, increment StatsIntraday, increment StatsLifetime.
   * Publish WS payload to SNS “MarketUpdates”.

### 4.2 Metrics flow

| Step                  | Component           | Action                                                                                                                                                                                            |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A (Real‑time)**     | Matcher Tx          | `ADD` metrics in **StatsIntraday** + **StatsLifetime**.                                                                                                                                           |
| **B (Daily roll‑up)** | Cron Fn `0 0 * * *` | 1) Scan yesterday’s minute rows → aggregate.<br>2) `putItem` **StatsDaily**.<br>3) Write JSON snapshot to `s3://dex-data-lake/daily/yyyy-mm-dd.json`.<br>4) Intraday rows auto‑expire after 48 h. |

### 4.3 Scheduled jobs (`sst.aws.Cron`)

| Job                   | Interval     | Logic                                                  |
| --------------------- | ------------ | ------------------------------------------------------ |
| Funding tick          | 1 h per perp | `fundingRate = mark - index`; inserts synthetic Trade. |
| Option expiry         | per contract | Cash‑settle ITM → USDC.                                |
| Future expiry         | per contract | Cash‑settle at index.                                  |
| Oracle fetch          | 30 s         | Pull Pyth/Chainlink → **Prices**.                      |
| Daily metrics archive | 24 h         | As in 4.2B.                                            |

---

## **5  Metrics & observability**

| Tier         | Resolution        | Retention | Store                    | Query path                  |
| ------------ | ----------------- | --------- | ------------------------ | --------------------------- |
| **Hot**      | 1 min / 5 s       | 48 h      | `StatsIntraday`          | REST dashboards (<15 ms).   |
| **Warm**     | 1 day             | ≤ 12 mo   | `StatsDaily`             | Leaderboards, 30‑d charts.  |
| **Lifetime** | cumulative        | forever   | `StatsLifetime` (1 item) | Fast global counters.       |
| **Cold**     | per Trade / delta | years     | **S3 data lake**         | Athena/Glue/BI or batch ML. |

Key metrics captured in **all three** Dynamo tables:

* 24 h volume (USDC / CXPT) - Open interest - Depth\@1 bp / 5 bp
* Funding rate (perps) - Implied vol (options) - Protocol fees
* Trader realised / unrealised PnL - Infra p95 order→fill latency

---

## **6  Security, fees, admin quirks**

* **Flat 0.5 % fee** deducted inside matcher Tx (maker + taker).
* **Idempotency** header on every order/cancel to avoid dupes.
* **Admin auth** via `sst.aws.Auth` / Cognito groups.
* **Circuit breaker**: `Markets.status = PAUSED` checked in API & matcher.
* **Rate‑limits**: CloudFront WAF token bucket keyed by IP + API‑key.

---

## **7  Next concrete steps**

1. Finalise **TypeScript interfaces** (`Order`, `Trade`, `Position`, `Stats*`).
2. Ship MVP **Matcher Fn** against local DDB (+ unit tests).
3. Deploy **Vault + CXPT** contracts to testnet and integrate deposit/withdraw routes.
4. Implement **TradesArchiver Fn** & create S3 bucket `dex-data-lake`.
5. Build **DailyRollup Cron Fn** updating `StatsDaily` + S3 snapshot.
6. Wire **WebSocket fan‑out** path (SNS ➜ Lambda ➜ postToConnection).
7. Add **lifecycle policies** on S3 prefixes to transition >3 yr data to Glacier.