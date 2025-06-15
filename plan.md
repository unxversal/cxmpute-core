# Final Sprint – Mainnet-Ready On-Chain & Billing Functions (June 2025)

This document is the **single source-of-truth** for the last sprint before public mainnet launch.  It lists every missing piece, their exact deliverables, and the order in which they must be executed.  Follow the checklist from top to bottom – nothing should remain TODO when you reach the end.

---
## 1 · Current Architecture Snapshot
* **Runtime** – `Next.js 14 + SST` (Edge/runtime `node16` lambdas).  No separate Express services.
* **Contracts** – `CXPTToken`, `Vault`, `RewardDistributor`, `CommunityVester`, supporting vesting contracts.  Deployed **only** on *Agung* test-net.
* **Backend API**
  * Admin routes exist for: `stage`, contract address read/write, merkle-root upload, vester poke, vault sweep (new), reward-split config.
  * Missing: automatic epoch rollover metadata, points table, user deposit, subscription purchase.
* **Storage** – Dynamo tables generated via SST Resources.  Some tables referenced in code are **place-holders** (`ProviderPointsTable`).  Redis/SQS not yet used.
* **Front-end** – Admin dashboard exists but lacks buttons for new on-chain actions (sweep, rollover).  User dashboard lacks "Deposit CXPT" and subscription purchase flow.

---
## 2 · Discovered Gaps & Stray TODOs
| Area | Gap / Stray TODO |
|------|------------------|
| Dynamo | `ProviderPointsTable` not defined; rollover endpoint uses hard-coded string. |
| Metadata | Rollover endpoint writes nothing; commented `TODO` remains. |
| Auth Guards | A few low-priority admin routes still miss `requireAdmin` (search `// TODO auth`). |
| Deposits | No PAYG `deposit` endpoint – users cannot top up CXPT balance yet. |
| Subscriptions | `/api/pay/subscription` stub missing. |
| Dashboard | No UI buttons for new admin actions; no user deposit modal. |
| Oracle | Price oracle remains stub – intentionally out-of-scope. |
| Tests | No Jest / Hardhat coverage for new flows. |

---
## 3 · Sprint Scope (What WILL be done)
The product owner approved the following items:

### Phase 2 (Backend & Data)
1. **Create `ProviderPointsTable`** in SST config and reference it everywhere (rollover, stats).
2. **Persist rollover metadata** to `MetadataTable` (`endpoint="merkleRoot"`).
3. **Unit / Integration tests** for:
   * `admin/vault/sweep` (mock provider).
   * `admin/rewards/rollover` happy path.
4. **Docs update** – extend integration & tokenomics markdown with new relay pattern.

### Phase 3 (Automation & Observability)
1. **Optional SST `Cron`** (`RewardsCron`) – disabled by default – calls `/admin/rewards/rollover` daily.
3. **Secrets Hardening** – move `MerkleUpdaterKey` & `AdminSignerKey` to SST `Secrets.Manager` and read via `process.env`.
4. **Admin Dashboard buttons** – React components for: *Build & Publish Root*, *Sweep Vault*, *Flip Stage*.  Show tx hash + success toast.

### Phase 4 (User-Facing Payments)
1. **User CXPT deposit & PAYG balance**
   * `POST /api/v1/pay/deposit` – requires linked wallet, invokes `Vault.deposit` on chain, updates Dynamo balance cache.
   * New React `DepositTokensModal` using WalletConnect.

*(Subscription flow & oracle remain out-of-scope until the next cycle.)*

---
## 4 · Execution Order (Bottom-Up)
1. **Data Layer**
   1. Add `ProviderPointsTable` to `sst.config.ts` (PK `walletAddress`).
   2. Run migration script to back-fill existing provider points (if any).
2. **Backend Functions**
   1. Update `src/app/api/admin/rewards/rollover/route.ts` : replace hard string with `Resource.ProviderPointsTable.name`; add `PutCommand` to `MetadataTable`.
   2. Implement `src/app/api/v1/pay/deposit` (re-use signer's wallet for approvals if needed).
3. **Secrets Management**
   1. Add `AdminSignerKey` and `MerkleUpdaterKey` in `sst.config.ts` → `secrets`.
   2. Refactor all lambdas to read `process.env.ADMIN_SIGNER_PK` etc.
4. **Automation (optional cron)**
   1. `sst.aws.Cron("RewardsCron", { enabled:false, schedule:"rate(1 day)", function:"src/jobs/rewardsCron.handler" })` – handler simply fetches `/admin/rewards/rollover`.
5. **Front-end**
   1. Admin Dashboard – three buttons under *Epoch Controls* card.
   2. User Dashboard – *Deposit CXPT* modal → hits new deposit route.
6. **Tests**
   1. Hardhat – deploy mock contracts, call `sweepVault` via helper.
   2. Jest – use `aws-sdk-client-mock` & `viem` to mock chain interaction.
7. **Documentation**  (last step) – update `cxpt-token-integration.md`, `onchain-addition-plan.md`.

---
## 5 · Deliverables Checklist
- [ ] `ProviderPointsTable` resource & CDK synth passes.
- [ ] Updated rollover endpoint with real table + metadata write.
- [ ] PAYG deposit endpoint & modal.
- [ ] Secrets migrated; no private keys in code.
- [ ] Disabled cron ready to flip.
- [ ] Admin UI buttons operational on test-net.
- [ ] CI tests green (Hardhat + Jest).
- [ ] Docs updated – no stale function names.

---
## 6 · Post-Sprint Verification Steps
1. Deploy to *Agung* → run Admin Dashboard → *Build Root* → *Sweep* → check balances & events.
2. Flip stage to `mainnet` in admin panel, supply new contract addresses, simulate sweep on a fork.
3. Confirm no lambda still references `Resource.*Key.value` directly – should read secrets.

---
**Owner:** `@rizzytwizzy`  |  **Tech Lead:** `@assistant`   |  **Lock date:** 30 June 2025 