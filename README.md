**Revising architecture document**

The user wants an updated version of their "Revised Hybrid Order Book DEX Architecture" document, incorporating changes discussed throughout our conversation. This includes adjustments for the new smart contract architecture, on-chain integration, deposit/withdrawal flows, and synth creation. They’d also like me to include more flow and explanation blocks, similar to the one provided for WebSockets. I’ll make sure to revise the entire document without omitting anything, ensuring I capture both new and existing sections. No external information is needed—just a well-rounded update.


Thought for 16 seconds


# **Re‑revised Hybrid‑Order‑Book DEX Architecture**

*(May 2025 – incorporates on‑chain Vault + Factory, Balances table, event listeners, and clearer flow diagrams)*

---

## **1  On‑chain layer (settlement & collateral)**

| Contract / library           | Purpose                                                          | Notes                                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vault (UUPS‑upgradeable)** | Holds 100 % USDC collateral; tracks user balances in **shares**. | • `deposit(uint amt)` & `withdraw(uint amt, bool asCxpt)` mint/transfer instantly.<br>• Emits `Deposited`, `Withdrawn`, `SynthMinted`, `SynthBurned` for Dynamo sync.<br>• Owns the only **MINTER\_ROLE** on every Synth & CXPT. |
| **CXPT ERC‑20**              | Governance / fee‑rebate token.                                   | Minted **1 : 1** inside `Vault.withdraw(asCxpt = true)`; only trades on this DEX.                                                                                                                                                |
| **SynthFactory**             | One‑shot deployer for new synth markets.                         | • `createSynth(name,symbol)` → deterministic `CREATE2` address.<br>• Grants `MINTER_ROLE` to Vault and emits `SynthCreated`.                                                                                                     |
| **SynthERC20 (N × assets)**  | 1 : 1‑backed synthetic tokens the off‑chain matcher exchanges.   | Simple ERC‑20 with `mint` / `burnFromVault`.                                                                                                                                                                                     |
| **EIP‑712 order‑hash lib**   | Typed‑data domain shared by all order types.                     | Enables cancel‑by‑sig & bot trading.                                                                                                                                                                                             |

> **No on‑chain matching.**
> Latency target < 100 ms; all orders fully pre‑paid.

---

## **2  Off‑chain core (Next.js `route.ts` + SST constructs)**

### REST / HTTP

| Route                  | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `POST /orders`         | Create market / limit / option / perp / future (body = discriminated DTO + EIP‑712 sig). |
| `DELETE /orders/:id`   | Cancel single or bulk (filter).                                                          |
| `GET /orders`          | Paginated query.                                                                         |
| `GET /positions`       | Live positions & PnL.                                                                    |
| `POST /admin/markets`  | Create ∣ pause ∣ delete market (Cognito group‑gated).                                    |
| `POST /vault/deposit`  | Initiate USDC → Vault deposit *(calls `Vault.deposit` then updates Balances)*.           |
| `POST /vault/withdraw` | Withdraw as USDC **or** CXPT *(calls `Vault.withdraw`)*.                                 |

*All routes deploy as **Lambda\@Edge** via `sst.aws.Nextjs` for <100 ms cold‑start.*

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

*(Detailed WebSocket explainer block appears in § 8.)*

---

## **3  Data & state (DynamoDB + S3)**

| Table             | PK / SK example                   | TTL / GSIs                                       | Purpose                                                         |
| ----------------- | --------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| **Orders**        | `MARKET#BTC-PERP` / `TS#<uuid>`   | GSI `TRADER#uuid`                                | Single table; `orderType` attribute discriminates.              |
| **Trades**        | `MARKET#BTC-PERP` / `TS#<uuid>`   | GSI `TRADER#uuid`<br>**Stream → TradesArchiver** | Raw fills; stream feeds S3 lake.                                |
| **Positions**     | `TRADER#uuid` / `MARKET#BTC-PERP` | –                                                | Net snapshot; updated atomically by matcher.                    |
| **Balances**      | `TRADER#uuid` / `USDC`            | –                                                | Mirrors `Vault.shares` and CXPT balances for fast UI retrieval. |
| **Markets**       | `MARKET#BTC-PERP` / `META`        | GSI `status`                                     | Tick size, expiryTs, funding params, synth address…             |
| **Prices**        | `ASSET#BTC` / `TS#<iso>`          | TTL 7 d                                          | Oracle snapshots (TWAP / funding).                              |
| **StatsIntraday** | `MARKET#BTC-PERP` / `<minute>`    | TTL 48 h                                         | 1‑min (or 5 s) buckets.                                         |
| **StatsDaily**    | `MARKET#BTC-PERP` / `YYYY‑MM‑DD`  | –                                                | 24 h aggregates, retained 12 mo.                                |
| **StatsLifetime** | `KEY#GLOBAL` / `META`             | –                                                | Single row of all‑time totals.                                  |
| **WSConnections** | `WS#<connId>` / `META`            | TTL 24 h                                         | Connection registry.                                            |

### Cold history lake

```
Dynamo Stream (Trades) ➜ TradesArchiver Fn ➜ putObject
      s3://dex-data-lake/trades/YYYY/MM/DD/…
```

---

## **4  Event & compute flows**

### 4.1 Order ingress ➜ Matcher

1. **API Fn** validates payload & `putItem` → **Orders** (`attribute_not_exists`).
2. **Dynamo Stream → EventBridge Pipe → SQS FIFO** (messageGroup = market).
3. **Matcher Fn / ECS Fargate** (micro‑batch 10‑50):

   * Update in‑mem book; compute matches.
   * **TransactWriteItems**:

     * update Orders, insert Trades, upsert Positions, update StatsIntraday & StatsLifetime.
     * On each fill call `vault.mintSynth()` / `burnSynth()` to move synthetic inventory.
   * Publish WebSocket payload via **SNS “MarketUpdates”**.

### 4.2 Vault deposit / withdraw flow

| Step | Component             | Action                                                                                                     |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | Front‑end             | User signs `permit` → calls **POST /vault/deposit** (or withdraw).                                         |
| 2    | API Fn                | Invokes `Vault.deposit()` / `withdraw()` with signer key.                                                  |
| 3    | Vault                 | Emits `Deposited` / `Withdrawn` *(and `SynthMinted` / `SynthBurned` if CXPT path)*.                        |
| 4    | **On‑chain Listener** | Small Lambda subscribed to an Alchemy/Infura WS provider:  <br>• Decodes events<br>• Updates **Balances**. |
| 5    | UI / Matcher          | Balances table is source‑of‑truth for off‑chain logic; can assert vs on‑chain if desired.                  |

### 4.3 New market (synth) creation

| Step | Actor / component                | Action                                                                                      |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | Admin UI → `POST /admin/markets` | Calls `SynthFactory.createSynth("Synthetic SOL", "sSOL")`.                                  |
| 2    | Factory                          | Deploys new Synth via `CREATE2`, grants `MINTER_ROLE` to Vault, emits `SynthCreated`.       |
| 3    | Admin Fn                         | • Calls `Vault.registerSynth(newSynth)`.<br>• Inserts row in **Markets** (`status=PAUSED`). |
| 4    | Off‑chain listener               | Sees `SynthCreated`, logs to monitoring, can pre‑warm front‑end configs.                    |
| 5    | Operator                         | When ready: PATCH market row → `status=ACTIVE` → matcher starts processing.                 |

### 4.4 Metrics flow & scheduled jobs

*(Unchanged from previous draft – see § 5 & schedule table.)*

---

## **5  Metrics & observability**

| Tier         | Resolution    | Retention | Store         | Query path                 |
| ------------ | ------------- | --------- | ------------- | -------------------------- |
| **Hot**      | 1 min / 5 s   | 48 h      | StatsIntraday | REST dashboards (<15 ms).  |
| **Warm**     | 1 day         | ≤ 12 mo   | StatsDaily    | Leaderboards, 30‑d charts. |
| **Lifetime** | cumulative    | forever   | StatsLifetime | Fast global counters.      |
| **Cold**     | per Trade / δ | years     | S3 data lake  | Athena / Glue / BI / ML.   |

Key metrics captured everywhere:

* Volume (USDC / CXPT)   *·*  Open interest   *·*  Depth @ 1–5 bp
* Funding rate (perps)   *·*  Implied vol (options)
* Protocol fees   *·*  Trader realised / unrealised PnL
* Infra p95 order → fill latency

---

## **6  Security, fees, admin quirks**

* **Flat 0.5 % fee** deducted inside matcher Tx (split maker / taker).
* **Idempotency‑Key** header on every order / cancel.
* **Admin auth** via Cognito (`sst.aws.Auth`) + WAF IP throttling.
* **Circuit breaker**: `Markets.status = PAUSED` gate checked in API & matcher.
* **CORE\_ROLE** signer key used by off‑chain matcher to call Vault mints/burns.
* **UUPS upgrade paths** secured by a 24 h timelock & multisig guardian.

---

## **7  Next concrete development steps**

1. **Deploy contracts** (`Vault`, `CXPTToken`, `SynthFactory`) to testnet; fund Vault with mock USDC.
2. **Wire matcher signer**: load CORE\_ROLE private‑key via SST secret; add `mintSynth` / `burnSynth` tx in `matchEngine.ts`.
3. **Implement on‑chain event listener Lambda** (Node ethers v6):

   * subscribe to `Deposited`, `Withdrawn`, `SynthMinted`, `SynthBurned`;
   * update **Balances**, publish WebSocket `balanceUpdate`.
4. **Extend admin route** to call factory + registerSynth + create Markets row.
5. **Happy‑path E2E test**: deposit → place order → fill → withdraw CXPT → market data WS.
6. Harden with fuzz tests (Foundry) on Vault and Synths.

---

## **8  What the WebSockets layer does (and why you need it)**

| Piece                                         | When it runs                                                                                    | What it actually **does**                                                                                                                                                                                                                                                                                  | Why it matters to the DEX                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **`$connect` route**                          | The instant a client opens `wss://…`                                                            | • Registers the connection ID in **WSConnections** (`WS#<id>`) with optional `traderId` / `market` from the query string.<br>• Stores a 24‑h TTL so idle sockets self‑expire.                                                                                                                              | Gives matcher & fan‑out a fast lookup table: “who is online and what channel did they ask for?” |
| **`subscribe` route**                         | When the client sends `{"action":"subscribe","channel":"market.BTC-PERP"}` (or `trader.<uuid>`) | • Updates the saved row with the chosen `channel`.<br>• Client may send another `subscribe` later to switch without reconnecting.                                                                                                                                                                          | Enables one socket to hop between feeds, reducing connection churn.                             |
| **`$disconnect` route**                       | Browser tab closes, network drops, or you force‑close                                           | • Deletes the row from **WSConnections** so fan‑out stops wasting calls on it.                                                                                                                                                                                                                             | Keeps table small; avoids expensive 410 (Gone) retries.                                         |
| **Fan‑out Lambda**<br>`dex/ws/fanOut.handler` | Triggered by every matcher via **SNS “MarketUpdates”**                                          | 1. Receives a payload like `{type:"orderUpdate", market:"BTC-PERP", …}`.<br>2. Derives channel key (`market.BTC-PERP` or `trader.<uuid>`).<br>3. Scans **WSConnections** for rows whose `channel` matches.<br>4. Uses **APIGW Management API** to `postToConnection` in batches.<br>5. If 410 → purge row. | Achieves real‑time fan‑out in < 100 ms without per‑symbol Lambdas or polling.                   |

### What traders actually *see*

```
wss://dex-ws.cxmpute.cloud
   ──►  SUBSCRIBE  market.BTC-PERP
   ◄──  depth     { bids:[…], asks:[…] }
   ◄──  trade     { px:64523, qty:0.02, … }
   ◄──  funding   { rate:0.0037, ts:… }
   ──►  SUBSCRIBE  trader.8b2f…
   ◄──  orderUpdate     { id:"…", status:"FILLED" }
   ◄──  positionUpdate  { pnl: 184.32 }
   ◄──  balanceUpdate   { usdc: 0, cxpt: 500 }
```

* **`market.<symbol>` channels** – depth, trades, mark‑price, funding, IV.
* **`trader.<uuid>` channels** – your fills, PnL, liquidation alerts, balance changes.
* **`admin.<market>` channels** – optional: `PAUSED`, `DELISTED`, parameter changes.

> **Why WebSockets?** Latency, bandwidth, and cost: one push per delta rather than thousands of REST polls.

