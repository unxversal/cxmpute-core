**Core Concepts:**

1.  **Vault Deposit:** For `REAL` mode, users first deposit their `USDC` or `sASSETs` (e.g., sBTC, sETH) into your DEX Vault. This deposit updates their *internal* `BalancesTable` record for that asset and mode.
2.  **`BalancesTable`:**
    *   `balance`: The amount of an asset a user has available to trade or withdraw.
    *   `pending`: The amount of an asset locked for open orders or as margin for open positions.
    *   Total owned internally = `balance` + `pending`.
3.  **Locking Purpose:** To ensure that a user has sufficient funds to cover their order if it gets filled or to meet margin requirements for derivative positions.
4.  **Fees:** Trading fees (e.g., 0.5% or `FEE_BPS = 50` if it's 0.5%, your code has `FEE_BPS = 100` which is 1%) are typically calculated on the notional value of the trade and are usually deducted from the quote asset (`USDC`) balance. For simplicity in locking, the maximum potential fee might be included in the locked amount for certain order types.

---

**Instrument-Specific Locking Logic:**

**1. SPOT Markets (e.g., sBTC/USDC)**

*   **A. Placing a BUY Order (e.g., Buy sBTC with USDC):**
    *   **What's Locked:** `USDC`
    *   **Amount Locked:**
        *   **LIMIT Order:** `(quantity * price) + estimated_fee`. The `price` is the limit price specified by the user.
        *   **MARKET Order:** Collateralizing market orders before execution is complex.
            *   *Simple Approach (Less Safe):* No specific pre-locking; order matches against available `USDC` balance at the moment of trade. This is risky if the balance changes.
            *   *Safer Approach:* Lock USDC based on a "worst-case" price (e.g., current best ask + slippage buffer) or require sufficient free USDC that can be immediately debited.
            *   *Your API (`/api/v1/trade/route.ts`) for SPOT Market Buy doesn't explicitly show pre-locking of USDC. It seems to rely on the match engine to check available balance at the time of fill.*
    *   **`BalancesTable` Update (Conceptual for LIMIT Order):**
        *   `USDC.balance -= (locked_amount)`
        *   `USDC.pending += (locked_amount)`
        *(Note: Your `/api/v1/trade/route.ts` for a BUY LIMIT order directly debits `USDC.balance` without moving to `pending`. This means the `balance` directly reflects what's available after accounting for the open limit buy order's cost. If the order is cancelled, this USDC needs to be credited back to `balance`.)*

*   **B. Placing a SELL Order (e.g., Sell sBTC for USDC):**
    *   **What's Locked:** The base `sASSET` (e.g., `sBTC`)
    *   **Amount Locked:** `quantity` of the `sASSET`.
    *   **`BalancesTable` Update (Conceptual):**
        *   `sASSET.balance -= quantity`
        *   `sASSET.pending += quantity`
        *(Note: Your `/api/v1/trade/route.ts` for a SPOT SELL order directly debits `sASSET.balance`. The `cancellationProcessor.ts` then adds back to `sASSET.balance` upon cancellation, implying the initial debit was the "lock".)*

*   **C. Order Fulfillment (Trade Occurs):**
    *   **BUY Order:**
        *   If LIMIT: The locked `USDC` (or portion if partially filled) is spent. `USDC.pending` decreases if it was used. If `balance` was directly debited, it stays debited.
        *   User receives the `sASSET`: `sASSET.balance += filled_quantity_of_sasset`.
    *   **SELL Order:**
        *   The locked `sASSET` (or portion) is spent. `sASSET.pending` decreases (or `sASSET.balance` was already reduced).
        *   User receives `USDC`: `USDC.balance += (filled_quantity_of_sasset * fill_price) - fee`.

*   **D. Order Cancellation:**
    *   **BUY Order (LIMIT):** Locked `USDC` is released.
        *   `USDC.pending -= remaining_locked_amount` (if pending was used)
        *   `USDC.balance += remaining_locked_amount`
    *   **SELL Order:** Locked `sASSET` is released.
        *   `sASSET.pending -= remaining_locked_sasset_quantity`
        *   `sASSET.balance += remaining_locked_sasset_quantity`
        *(Your `cancellationProcessor.ts` correctly handles this by adding back to `balance`.)*

---

**2. PERPETUAL Swaps (PERP) & FUTURES Markets (e.g., sBTC-PERP, sBTC-JUN24-FUT)**

*Margin and P&L are typically handled in the quote currency (USDC).*

*   **A. Opening a Position (BUY/Long or SELL/Short):**
    *   **What's Locked:** `USDC` for Initial Margin (IM).
    *   **Amount Locked:** `Initial Margin % * Notional Value`.
        *   Notional Value = `quantity_contracts * contract_size_in_base_asset * entry_price`.
        *   Example: If IM is 10% (for LIMIT) or 20% (for MARKET SELL, as per your `/api/v1/trade/route.ts`), and you want to long 1 sBTC contract (lot size 1) at $50,000:
            *   LIMIT: Lock `0.10 * 1 * 50000 = 5000 USDC`.
            *   MARKET SELL: Lock `0.20 * 1 * oracle_price_at_order_time = X USDC`.
    *   **`BalancesTable` Update:**
        *   `USDC.balance -= locked_margin_amount`
        *   `USDC.pending += locked_margin_amount`

*   **B. Position Held Open:**
    *   **Maintenance Margin (MM):** Not explicitly "locked" by moving between `balance` and `pending` continuously, but the system monitors if the user's `USDC.balance` (plus any unrealized PnL on the position relative to margin) drops below MM requirements.
    *   **Funding Payments (Perps):** Directly debited/credited to `USDC.balance` periodically.
    *   **Daily P&L Settlement (Perps - if implemented):** Unrealized P&L is realized and `USDC.balance` is adjusted. The `pending` margin amount usually remains unchanged unless a margin top-up or withdrawal occurs. Your `perpsDailySettle.ts` does this.

*   **C. Closing a Position (Partially or Fully):**
    *   When a position is reduced, a proportional amount of the Initial Margin held in `USDC.pending` is released back to `USDC.balance`.
    *   Realized P&L from the closed portion is added/subtracted from `USDC.balance`.

*   **D. Order Cancellation (for an order that would open/increase a position):**
    *   Locked `USDC` (Initial Margin for that order) is released.
        *   `USDC.pending -= locked_margin_amount_for_order`
        *   `USDC.balance += locked_margin_amount_for_order`

*   **E. Contract Expiry (FUTURES):**
    *   Position is cash-settled against the final settlement price.
    *   Final Realized P&L = `(settlement_price - avg_entry_price) * position_size * contract_size_in_base_asset`.
    *   This P&L is added/subtracted from `USDC.balance`.
    *   The Initial Margin held in `USDC.pending` for this futures position is released back to `USDC.balance`.
    *   Your `futureExpiry.ts` correctly adjusts `USDC.balance` for P&L and implicitly the margin should be freed as the position is zeroed out (the `pending` collateral associated with the position itself, not just an open order, needs to be managed throughout the position's life or at closure/expiry).

---

**3. OPTIONS Markets (e.g., sBTC-CALL-241231-60K)**

*   **A. BUYING an Option (Long Call or Long Put):**
    *   **What's Locked:** `USDC` to pay the premium.
    *   **Amount Locked:** `(quantity_contracts * option_price_per_contract) + estimated_fee`.
    *   **`BalancesTable` Update (Conceptual for LIMIT Order):**
        *   `USDC.balance -= total_premium_cost`
        *   `USDC.pending += total_premium_cost`
        *(Similar to SPOT BUY, your API likely debits `USDC.balance` directly).*

*   **B. SELLING/WRITING an Option (Short Call or Short Put):**
    *   **What's Locked (Collateral):**
        *   **Short CALL (Covered Call on sASSET):** The underlying `sASSET`.
            *   Amount: `quantity_contracts * lot_size_of_sasset_per_contract`.
            *   `BalancesTable` Update: `sASSET.balance -= locked_sasset_amount; sASSET.pending += locked_sasset_amount`. (Your API does this).
        *   **Short PUT (Cash-Covered Put):** `USDC`.
            *   Amount: `quantity_contracts * lot_size_of_sasset_per_contract * strike_price`.
            *   `BalancesTable` Update: `USDC.balance -= locked_usdc_amount; USDC.pending += locked_usdc_amount`. (Your API does this).
    *   **Premium Received:** When the sell order for the option fills, the writer receives the premium (minus fees) into their `USDC.balance`.

*   **C. Order Fulfillment (Option Trade Occurs):**
    *   **Option Buyer:**
        *   `USDC.pending` decreases (if used) or `USDC.balance` was already debited by the premium cost.
        *   Their option position in `PositionsTable` increases.
    *   **Option Seller/Writer:**
        *   `USDC.balance += (premium_received - fee)`.
        *   Their `sASSET.pending` (for short calls) or `USDC.pending` (for short puts) remains locked as collateral for the written option.
        *   Their option position in `PositionsTable` decreases (becomes more negative).

*   **D. Order Cancellation (for an order to buy/sell an option):**
    *   **Cancelling a BUY Option Order:** Locked `USDC` (for premium) is released.
        *   `USDC.pending -= remaining_locked_premium` (if used)
        *   `USDC.balance += remaining_locked_premium`
    *   **Cancelling a SELL Option Order:** Locked collateral (`sASSET` or `USDC`) is released.
        *   `sASSET.pending -= remaining_locked_sasset_collateral` (for call)
        *   `sASSET.balance += remaining_locked_sasset_collateral`
        *   OR
        *   `USDC.pending -= remaining_locked_usdc_collateral` (for put)
        *   `USDC.balance += remaining_locked_usdc_collateral`
        *(Your `cancellationProcessor.ts` handles this release from `pending` back to `balance` correctly based on the order details and market type.)*

*   **E. Option Expiry:**
    *   **OTM (Out-of-the-Money):**
        *   Option expires worthless. No asset transfer for intrinsic value.
        *   **For Option Writers:** The collateral (`sASSET.pending` for calls, `USDC.pending` for puts) is released.
            *   `sASSET.balance += previously_pending_sasset_amount`
            *   `sASSET.pending -= previously_pending_sasset_amount`
            *   (And similarly for USDC if it was a put writer).
            *   Your revised `optionExpiry.ts` correctly handles this.
    *   **ITM (In-the-Money):**
        *   Cash settlement occurs based on intrinsic value (`settlement_price` vs. `strike_price`).
        *   **Option Holder (Long Position):** Receives `USDC`.
            *   `USDC.balance += intrinsic_value_payout`.
        *   **Option Writer (Short Position):** Pays `USDC`.
            *   `USDC.balance -= intrinsic_value_payout`.
            *   **And importantly, their original collateral is released:**
                *   `sASSET.balance += previously_pending_sasset_amount` (for call writer)
                *   `sASSET.pending -= previously_pending_sasset_amount`
                *   OR (for put writer, if the payout didn't fully consume the collateral)
                *   `USDC.balance += remaining_usdc_collateral_after_payout`
                *   `USDC.pending -= original_locked_usdc_collateral`
                *   Your revised `optionExpiry.ts` handles the USDC payout and the collateral release.

---

**Summary of `pending` vs. `balance`:**

*   When an order is placed that requires locking funds (e.g., selling SPOT sBTC, providing margin for PERPs, writing OPTIONS), the amount is conceptually moved from the asset's `balance` (available) to `pending` (locked).
    *   *Your current API implementation sometimes directly debits `balance` instead of using `pending` for the initial lock (e.g. SPOT sell, LIMIT buy). The `cancellationProcessor` however, correctly adds back to `balance`, implying a "conceptual lock" regardless of whether `pending` was incremented or `balance` was directly reduced.*
*   When a trade occurs:
    *   For SPOT, assets are directly exchanged, and `balance` fields are updated. Any `pending` amount related to the filled portion of the order for the *sold* asset is cleared.
    *   For Derivatives, `pending` margin usually stays until the position is closed or contract expires. P&L and funding affect `balance` directly.
*   When an order is cancelled, the `pending` amount is moved back to `balance`.
*   When a derivative contract expires, any `pending` margin/collateral associated with that specific expired position is moved back to `balance` after P&L settlement.

This flow ensures that the DEX always knows what funds are available for new orders/actions versus what's already committed. The key is consistency in how `balance` and `pending` are updated across order placement, matching, cancellation, and settlement.