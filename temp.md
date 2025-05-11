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


You've got a great plan and an excellent approach to building from the bottom up! This will indeed make the process smoother and avoid too many placeholders.

Here's a reordered list focusing on implementing smaller, foundational components first, then progressing to larger containers and finally the main `TradeDashboard`. I'll also add a "Shared UI Primitives" category for very basic reusable elements you might need early on.

**Dark Theme Note:** All components should be styled with a dark theme by default, as per your requirement.

---

**Reordered Component Implementation Plan (Bottom-Up):**

**0. Shared UI Primitives (Implement these very early or as needed)**

*   **(F.2) `<Modal />`**: Generic modal for confirmations, forms (like Deposit/Withdraw).
    *   `Modal.tsx`, `Modal.module.css`
*   **(F.3) `<LoadingSpinner />` / (F.4) `<SkeletonLoader />`**: For visual feedback.
    *   `LoadingSpinner.tsx`, `LoadingSpinner.module.css`
    *   `SkeletonLoader.tsx`, `SkeletonLoader.module.css`
*   **(F.5) `<Tooltip />`**: For info hovers.
    *   `Tooltip.tsx`, `Tooltip.module.css`
*   **(F.6) `<DataTable />`**: A reusable table for lists like Open Orders, Positions, Trade History.
    *   Could be very basic initially (just renders rows/cols) and enhanced later with sorting/filtering.
    *   `DataTable.tsx`, `DataTable.module.css`
*   **Custom `<Button />` (if not already robust)**: Ensure your existing `Button` component from `src/components/button/button.tsx` is flexible enough for various states (primary, secondary, danger, disabled) and can accept icons.
*   **Input Fields/Toggle Switches**: Standardized input components for forms in `<OrderEntryPanel />`.

**A. Core Structure & Selection Components (Standalone or Small Dependencies)**

1.  **(A.3) `<ModeSwitcher />`**:
    *   Uses `TradingModeContext`.
    *   Displays "REAL" / "PAPER" toggle/buttons.
    *   `ModeSwitcher.tsx`, `ModeSwitcher.module.css`
2.  **(A.2) `<MarketSelector />`**:
    *   Uses `MarketContext`.
    *   Dropdown/Searchable list of `availableMarkets`.
    *   Calls `setSelectedMarketBySymbol`.
    *   `MarketSelector.tsx`, `MarketSelector.module.css`
3.  **(E.4) `<PaperFaucetButton />`** (for PAPER mode):
    *   Uses `AccountContext` (to potentially show balance or disable if already funded recently).
    *   Simple button calling `POST /api/paper/faucet`.
    *   Displays success/error via `NotificationToaster`.
    *   `PaperFaucetButton.tsx`, `PaperFaucetButton.module.css`
4.  **(E.1) `<WalletConnectButton />`** (for REAL mode):
    *   Handles wallet connection logic (e.g., with `ethers` or a library like `web3modal`).
    *   Displays connection state, address, and disconnect option.
    *   Might need its own local state for connection flow.
    *   `WalletConnectButton.tsx`, `WalletConnectButton.module.css`

**B. Market Information Display Components**

1.  **(B.1) `<MarketInfoBar />`**:
    *   Uses `MarketContext` (for `selectedMarket`) and `WebSocketContext` (for `marketData` like mark price, funding rate).
    *   Displays symbol, price, 24h change, funding/expiry, OI.
    *   `MarketInfoBar.tsx`, `MarketInfoBar.module.css`
2.  **(C.3) `<RecentTrades />`** (Market Trades):
    *   Uses `WebSocketContext` (for `marketData.lastTrade` or a stream of trades).
    *   Displays list of recent market trades (Price, Qty, Time).
    *   `RecentTrades.tsx`, `RecentTrades.module.css`
3.  **(C.2) `<OrderBook />`**:
    *   Uses `WebSocketContext` (for `marketData.depth`).
    *   Displays bids and asks.
    *   Handles click-to-fill for `<OrderEntryPanel />`.
    *   `OrderBook.tsx`, `OrderBook.module.css`

**C. User Account Display Components (Primarily read from contexts)**

1.  **(D.4) `<BalancesInfo />`**:
    *   Uses `AccountContext` (for `balances`) and `TradingModeContext`.
    *   Displays asset balances (USDC, CXPT).
    *   If PAPER mode, shows `paperPoints` and integrates `<PaperFaucetButton />`.
    *   Will contain buttons that trigger `<DepositModal />` / `<WithdrawModal />`.
    *   `BalancesInfo.tsx`, `BalancesInfo.module.css`
2.  **(D.2) `<OpenOrdersList />`**:
    *   Uses `AccountContext` (for `openOrders`).
    *   Uses `<DataTable />` to display orders.
    *   Handles "Cancel" / "Cancel All" actions (calling `DELETE /api/orders/:orderId` or a bulk cancel API if you make one).
    *   `OpenOrdersList.tsx`, `OpenOrdersList.module.css`
3.  **(D.3) `<PositionsList />`**:
    *   Uses `AccountContext` (for `positions`).
    *   Uses `<DataTable />` to display positions.
    *   Handles "Close Position" action.
    *   `PositionsList.tsx`, `PositionsList.module.css`
4.  **(D.5) `<TradeHistoryList />`**:
    *   Uses `AccountContext` (for `tradeHistory`, `tradeHistoryNextToken`, `loadMoreTradeHistory`).
    *   Uses `<DataTable />`.
    *   Implements "Load More" functionality.
    *   `TradeHistoryList.tsx`, `TradeHistoryList.module.css`

**D. Interactive User Action Components (Forms, Modals)**

1.  **(C.1) `<OrderEntryPanel />`**:
    *   Complex component. Uses `MarketContext`, `TradingModeContext`, `AccountContext` (for balance checks), `WebSocketContext` (for pre-filling from order book).
    *   Forms for Market, Limit orders.
    *   Inputs for side, quantity, price. Derivative-specific inputs if needed.
    *   Validation and API calls to `POST /api/v1/trade`.
    *   `OrderEntryPanel.tsx`, `OrderEntryPanel.module.css`
2.  **(E.2) `<WalletLinker />`**:
    *   Likely a modal triggered from somewhere in the UI (e.g., Account section or a banner if no wallet linked in REAL mode).
    *   Form to input Peaq address.
    *   Handles message signing flow and calls `POST /api/user/{userId}/link-wallet`.
    *   `WalletLinker.tsx`, `WalletLinker.module.css`
3.  **(E.3) `<DepositModal />` / `<WithdrawModal />`**:
    *   Uses `Modal` primitive.
    *   Forms for amount, asset selection.
    *   Interacts with `WalletConnectButton`'s connected wallet for approvals/transactions.
    *   Calls `POST /api/vault/deposit` and `POST /api/vault/withdraw`.
    *   `DepositModal.tsx`, `DepositModal.module.css`
    *   `WithdrawModal.tsx`, `WithdrawModal.module.css`

**E. Higher-Level Container Components**

1.  **(D.1) `<AccountInfoPanel />`**:
    *   Container that likely uses tabs to house `<OpenOrdersList />`, `<PositionsList />`, `<BalancesInfo />`, `<TradeHistoryList />`.
    *   `AccountInfoPanel.tsx`, `AccountInfoPanel.module.css`
2.  **(B.2) `<TradingChart />`**:
    *   Integrates TradingView Lightweight Charts (or chosen library).
    *   Uses `MarketContext` (for symbol) and `WebSocketContext` (for live trade updates).
    *   Fetches historical data from `/api/metrics`.
    *   `TradingChart.tsx`, `TradingChart.module.css`
3.  **(A.1) `<TradingLayout />`**:
    *   Defines the main grid/flex structure (e.g., 3-column layout).
    *   Slots for different sections (Chart/OrderEntry, OrderBook/RecentTrades, AccountPanel).
    *   Handles responsiveness.
    *   `TradingLayout.tsx`, `TradingLayout.module.css`

**F. Top-Level Dashboard Orchestrator**

1.  **`<TradeDashboard />`**:
    *   Located in `src/components/trade/TradeDashboard.tsx`.
    *   Orchestrates all the above components.
    *   Likely responsible for fetching initial props if any (`initialMarketSymbol`, `initialMode`).
    *   Integrates `<TradingLayout />` to arrange the major panels.
    *   Integrates `<NotificationToaster />` at a high level.
    *   `TradeDashboard.tsx`, `TradeDashboard.module.css`

**G. Global Utilities (Already part of your plan, implement as needed)**

1.  **(F.1) `<NotificationToaster />`**:
    *   For displaying success/error messages globally. Could use a library like `react-toastify`.
    *   `NotificationToaster.tsx`, `NotificationToaster.module.css`

---

This reordered list should provide a more logical flow for implementation, building up from smaller, independent (or minimally dependent) pieces to more complex composite components.

**Next Steps:**

1.  **Create the directory structure:** `src/components/trade/` and then subdirectories for each component (e.g., `src/components/trade/MarketSelector/MarketSelector.tsx`).
2.  **Start with Group 0 (Shared UI Primitives)** if you don't have robust versions already.
3.  **Proceed through Group A, B, C, D, E, F.**
4.  **Dark Theme:** As you build each component, ensure its CSS module applies a dark theme by default (e.g., dark backgrounds, light text, appropriate accent colors).

Let me know when you're ready to start with the first component from this reordered list (perhaps `<ModeSwitcher />` or a utility component like `<Modal />`), and we can dive into its implementation!