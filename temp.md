Thought for a few seconds


### What the WebSockets layer does (and why you need it)

| Piece                                         | When it runs                                                                                    | What it actually **does**                                                                                                                                                                                                                                                                                                                                                       | Why it matters to the DEX                                                                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`$connect` route**                          | The instant a client opens `wss://…`                                                            | • Registers the connection ID in **WSConnections** (PK =`WS#<id>`) with an optional `traderId` and/or `market` taken from the query string.<br>• Sets a 24‑hour TTL so idle sockets clean themselves up.                                                                                                                                                                        | Gives the matcher & fan‑out code a fast lookup table: “who is online and what channel did they ask for?”                                                                          |
| **`subscribe` route**                         | When the client sends `{"action":"subscribe","channel":"market.BTC-PERP"}` (or `trader.<uuid>`) | • Updates the row it created at `$connect` and saves the chosen `channel`.<br>• Client can call this again any time to switch channels.                                                                                                                                                                                                                                         | Lets a single socket stream different feeds without reconnecting.                                                                                                                 |
| **`$disconnect` route**                       | When the browser closes, the network drops, or you force‑close from the AWS console             | • Deletes the row from **WSConnections** so fan‑out stops wasting calls on it.                                                                                                                                                                                                                                                                                                  | Keeps the table small and fan‑out cheap; avoids 410 (Gone) errors.                                                                                                                |
| **Fan‑out Lambda**<br>`dex/ws/fanOut.handler` | Triggered by every matcher via **SNS** `MarketUpdatesTopic`                                     | 1. Receives a payload like `{type:"orderUpdate", market:"BTC-PERP", …}`.<br>2. Derives the channel key (`market.BTC-PERP`, `trader.<uuid>`).<br>3. Scans **WSConnections** for rows whose `channel` matches.<br>4. Uses the **API Gateway Management API** to `postToConnection` for each match.<br>5. If the post fails with 410 (stale connection) it purge‑deletes that row. | Turns a single matcher event into thousands of real‑time pushes (<100 ms end‑to‑end).  No per‑connection polling, no per‑symbol Lambda fan‑out—just one SNS topic and one Lambda. |

#### What clients actually *see*

```text
wss://dex-ws.cxmpute.cloud          ──►  SUBSCRIBE  market.BTC-PERP
                                 ◄──  depth     { bids:[…], asks:[…] }
                                 ◄──  trade     { px:64523, qty:0.02, … }
                                 ◄──  funding   { rate:0.0037, ts:… }
                                 ──►  SUBSCRIBE  trader.b7f0…
                                 ◄──  orderUpdate   { id:"…", status:"FILLED" }
                                 ◄──  positionUpdate{ pnl: 184.32 }
```

* **`market.<symbol>` channels**
  Depth, recent trades, mark‑price, funding ticks, option IV, etc.—anything all traders care about.

* **`trader.<uuid>` channels**
  Private stream of your own order fills, position deltas, liquidation alerts, PnL updates.

* **`admin.<market>` channels** (if you ever expose them)
  Market state changes (`PAUSED`, `DELISTED`) that trading UIs and monitoring bots should react to.

#### Why WebSockets instead of HTTP polling?

* **Latency** – You broadcast in‑memory matcher results immediately; clients render glass‑floor latency (<200 ms UX).
* **Bandwidth** – One push contains the delta only; no 1‑second polling for depth snapshots.
* **Cost** – You pay for a handful of Lambda invocations per second plus tiny WS control messages, not tens of thousands of REST hits.

In short, the WebSocket layer is the **real‑time nerve system** of the DEX:
matchers publish → SNS → `fanOut` Lambda → targeted socket pushes.
Traders get order fills and market moves the moment they happen, without hammering your REST API.d