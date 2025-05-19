**Core Concepts:**

1.  **Vault Deposit:** For `REAL` mode, users first deposit their `USDC` or `sASSETs` (e.g., sBTC, sETH) into your DEX Vault. This deposit updates their *internal* `BalancesTable` record for that asset and mode.
2.  **`BalancesTable`:**
    *   `balance`: The amount of an asset a user has available to trade or withdraw.
    *   `pending`: The amount of an asset locked for open orders or as margin for open positions.
    *   Total owned internally = `balance` + `pending`.
3.  **Locking Purpose:** To ensure that a user has sufficient funds to cover their order if it gets filled or to meet margin requirements for derivative positions.
4.  **Fees:** Trading fees (e.g., 1% or `FEE_BPS = 100` if it's 1%) are typically calculated on the notional value of the trade and are usually deducted from the quote asset (`USDC`) balance. For simplicity in locking, the maximum potential fee might be included in the locked amount for certain order types.

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
            *   *(`/api/v1/trade/route.ts`) for SPOT Market Buy doesn't explicitly show pre-locking of USDC. It seems to rely on the match engine to check available balance at the time of fill.*
    *   **`BalancesTable` Update (Conceptual for LIMIT Order):**
        *   `USDC.balance -= (locked_amount)`
        *   `USDC.pending += (locked_amount)`
        *`/api/v1/trade/route.ts` for a BUY LIMIT order directly debits `USDC.balance` without moving to `pending`. This means the `balance` directly reflects what's available after accounting for the open limit buy order's cost. If the order is cancelled, this USDC needs to be credited back to `balance`.*

*   **B. Placing a SELL Order (e.g., Sell sBTC for USDC):**
    *   **What's Locked:** The base `sASSET` (e.g., `sBTC`)
    *   **Amount Locked:** `quantity` of the `sASSET`.
    *   **`BalancesTable` Update (Conceptual):**
        *   `sASSET.balance -= quantity`
        *   `sASSET.pending += quantity`
        *`/api/v1/trade/route.ts` for a SPOT SELL order directly debits `sASSET.balance`. The `cancellationProcessor.ts` then adds back to `sASSET.balance` upon cancellation, implying the initial debit was the "lock".*

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
=
---

**2. PERPETUAL Swaps (PERP) & FUTURES Markets (e.g., sBTC-PERP, sBTC-JUN24-FUT)**

*Margin and P&L are typically handled in the quote currency (USDC).*

1.  **Opening a BUY/Long Position (Perp/Future):**
    *   **Action:** User places a BUY order.
    *   **Locking:** The full USDC cost (`qty * price + fee`) is "locked."
        *   Your API (`/api/v1/trade/route.ts`) does this by directly debiting `USDC.balance` for limit orders. For market orders, it seems the check happens at fill time in the `matchEngine`.
    *   **`BalancesTable` (for LIMIT order via API):**
        *   `USDC.balance -= (qty * price + fee)`
        *   (No explicit `pending` increment shown in the BUY path of your API for the cost, it's a direct debit of available balance).

2.  **Opening a SELL/Short Position (Perp/Future):**
    *   **Action:** User places a SELL order.
    *   **Locking:** A specific amount of `USDC` is locked as collateral.
        *   LIMIT Sell: `(qty * contract_size * price) / 10` (10% of notional).
        *   MARKET Sell: `(qty * contract_size * oracle_price_at_order_time) / 5` (20% of notional at oracle price).
    *   **`BalancesTable` (as per your API):**
        *   `USDC.balance -= locked_collateral_USDC`
        *   `USDC.pending += locked_collateral_USDC`

3.  **During an Open Position:**
    *   The `pending` USDC for short positions remains locked.
    *   Funding payments (for PERPs) and P&L settlements (e.g., daily for PERPs) will directly adjust the `USDC.balance`.
    *   The system needs a mechanism (liquidation engine, not detailed in provided files) to monitor if a position's losses are approaching the value of the locked collateral (for shorts) or if the account equity (for longs, though they are fully paid) can still cover ongoing negative funding.

4.  **Closing a Position:**
    *   **For Shorts:** When the short position is closed (partially or fully), a proportional amount of the `USDC.pending` collateral is released back to `USDC.balance`.
    *   **For Longs:** Since it was fully paid, closing a long means receiving USDC (if price increased) or less USDC back (if price decreased) into `USDC.balance`. No "pending" collateral to release for the position itself.
    *   Realized P&L is credited/debited to `USDC.balance`.

5.  **Contract Expiry (FUTURES):**
    *   Positions are cash-settled.
    *   Final P&L is added/subtracted from `USDC.balance`.
    *   For any remaining short positions, the `USDC.pending` collateral associated with them is released back to `USDC.balance`.
    *   Your `futureExpiry.ts` handles the P&L part. The release of the `pending` collateral for shorts upon expiry needs to be explicitly handled there if not implicitly done by the position size going to zero and some other process cleaning up `pending` amounts for zeroed positions (which is less robust). It's better for the expiry CRON to manage this directly.

---

**3. OPTIONS Markets (e.g., sBTC-CALL-241231-60K)**

*   **A. BUYING an Option (Long Call or Long Put):**
    *   **What's Locked:** `USDC` to pay the premium.
    *   **Amount Locked:** `(quantity_contracts * option_price_per_contract) + estimated_fee`.
    *   **`BalancesTable` Update (Conceptual for LIMIT Order):**
        *   `USDC.balance -= total_premium_cost`
        *   `USDC.pending += total_premium_cost`

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
*   **F. Contract Expiry (FUTURES):**
    *   Position is cash-settled against the final settlement price.
    *   Final Realized P&L = `(settlement_price - avg_entry_price) * position_size_in_base_units`.
    *   This P&L is added/subtracted from `USDC.balance`.
    *   **For Short Positions:** The collateral that was in `USDC.pending` for this futures position is released back to `USDC.balance`.
        *   `USDC.balance += original_locked_collateral_for_short`
        *   `USDC.pending -= original_locked_collateral_for_short`
    *   **For Long Positions:** No specific "pending" collateral to release beyond the fact that their position is now settled and gone.
    *   Your `futureExpiry.ts` currently adjusts `USDC.balance` for P&L. **It needs to be augmented to also handle the release of `USDC.pending` for short positions that are expiring.**

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