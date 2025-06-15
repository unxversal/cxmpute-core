<!-- final-sprint.md -->

# Final Sprint – Mainnet-Ready On-Chain & Billing Functions (June 2025)

This document is the **single source-of-truth** for the last sprint before public mainnet launch. It lists every missing piece, their exact deliverables, and the order in which they must be executed. This plan refines the initial `plan.md`, incorporating approved features and a detailed bottom-up execution strategy to ensure no tasks are missed.

---
## 1 · Current Architecture Snapshot
* **Runtime**: `Next.js 14 + SST`. API routes are deployed as individual serverless functions on AWS Lambda. The stack is lean, with no separate servers or containers.
* **Contracts**: `CXPTToken`, `Vault`, `RewardDistributor`, and `CommunityVester` are deployed and verified on the **Agung testnet**. Mainnet deployment is pending.
* **Backend API**:
  * **Admin routes implemented**: Stage management (`/admin/stage`), contract address configuration (`/admin/contracts`), Merkle root updates (`/admin/merkle`), community vester poking (`/admin/vester/poke`), and manual vault sweeps (`/admin/vault/sweep`).
  * **Gaps**: No automated process for calculating and rolling over rewards, and no mechanism for users to deposit funds for PAYG usage. The subscription and treasury withdrawal logic is also missing.
* **Storage**: DynamoDB tables are the primary persistence layer, managed via SST `Resource` definitions. The pricing configuration is not aligned with the tiered model in the documentation.
* **Frontend**: The admin dashboard provides a basic interface but lacks controls for the new on-chain epoch management functions. The user dashboard does not yet have a "Deposit CXPT" or "Purchase Subscription" flow.

---
## 2 · Discovered Gaps & Stray TODOs
A full code review confirms the following gaps. This sprint will address a critical subset of these issues.

| Area | Gap / Stray TODO | Status in this Sprint |
|------|------------------|------------------------|
| Contracts | `SubscriptionManager` contract is missing. `RewardDistributor`'s ownership model needs to be set for secure treasury withdrawals. | ✅ **Will be implemented** |
| Pricing Model | The pricing stored in DynamoDB is a flat rate, not the tiered model from the docs. | ✅ **Will be implemented** |
| Treasury Mgmt | No secure, on-chain mechanism exists for the admin multisig to withdraw protocol fees from the `RewardDistributor`. | ✅ **Will be implemented (via On-Chain Safe)** |
| Subscriptions | The `/api/pay/subscription` endpoint and associated logic are missing entirely. | ✅ **Will be implemented** |
| DynamoDB | `ProviderPointsTable` and `SubscriptionsTable` are not defined in SST config. | ✅ **Will be implemented** |
| Metadata | The epoch rollover endpoint has a `// TODO` for persisting the Merkle root to the `MetadataTable`. | ✅ **Will be implemented** |
| Deposits | No PAYG `deposit` endpoint exists. Users cannot top up their CXPT balance. | ✅ **Will be implemented** |
| Dashboard | No UI for new admin actions (epoch/pricing) or user actions (deposit/subscribe). Treasury UI will link to Gnosis Safe. | ✅ **Will be implemented** |
| Secrets | Signer private keys are loaded from SST `Resource` values, not secure secrets. | ✅ **Will be implemented** |
| Automation | The daily rewards calculation is a manual API call. | ✅ **Will be implemented (as a disabled cron)** |
| Docs | Integration documents are out of sync with recent contract changes and new features. | ✅ **Will be implemented** |
| Testing | No dedicated unit or integration tests exist for the new on-chain flows. | ❌ **Out of Scope** (recommended for next sprint) |

---
## 3 · Sprint Scope (What WILL be done)
This sprint focuses on creating a complete, end-to-end, and secure workflow for manual reward distribution, user deposits, subscriptions, and treasury management on the testnet, ensuring it's ready for a mainnet configuration flip.

---
## 4 · Execution Order (Bottom-Up Implementation)
This checklist will be followed precisely to ensure dependencies are resolved before they are needed.

### Step 1: On-Chain Setup & Smart Contracts
*   **Action A (Manual Prerequisite)**: Create the On-Chain Treasury (Gnosis Safe).
*   **File**: N/A (Manual process using web interface).
*   **Details**: Before deploying contracts, the core admin team must create a Gnosis Safe wallet which will serve as the secure, multisignature treasury.
    1.  **Navigate** to the [Safe{Wallet} web app](https://app.safe.global/).
    2.  **Connect** a primary admin's wallet (e.g., MetaMask) to the desired Peaq network (start with Agung testnet).
    3.  **Follow the UI** to "Create a new Safe". Add the wallet addresses of the other core admins as co-signers. A 2-of-3 or 3-of-5 signature policy is recommended for security.
    4.  **Deploy & Record**: Complete the creation process. Securely record the on-chain address of the newly created Safe (e.g., `0x123...`). This address is required for the next step.

*   **Action B**: Modify the `RewardDistributor` to accept a designated owner at deployment.
*   **File**: `contracts/contracts/RewardDistributor.sol`
*   **Details**: Change the constructor from `constructor(address _token) Ownable(msg.sender)` to `constructor(address _token, address initialOwner) Ownable(initialOwner)`. This allows the deployer to create the contract while immediately and irrevocably setting the Gnosis Safe as the sole owner.

*   **Action C**: Create the `SubscriptionManager` contract.
*   **File**: `contracts/contracts/SubscriptionManager.sol` (new file)
*   **Details**: A simple NFT-based contract where `activatePlan(user, planId)` mints an NFT representing the subscription. Its owner can be the `PeaqAdminPrivateKey` for operational control.

*   **Action D**: Add treasury withdrawal capability to `RewardDistributor`.
*   **File**: `contracts/contracts/RewardDistributor.sol`
*   **Details**: Implement `function withdrawProtocolFees(address recipient, uint256 amount) external onlyOwner`. Since the `owner` is the Gnosis Safe, only a successful multisig proposal can execute this function.

*   **Action E**: Deploy and configure new contracts.
*   **Details**:
    1.  The Gnosis Safe address from Action A will be provided as an environment variable to the Hardhat deployment script.
    2.  The script will be updated to read this address and pass it into the new `RewardDistributor` constructor during deployment.
    3.  The script will deploy all contracts, and the new addresses will be updated in the backend via the `/admin/contracts` endpoint.

### Step 2: Data Layer (`sst.config.ts`)
*   **Action A**: Define new DynamoDB tables.
*   **File**: `sst.config.ts`
*   **Details**:
    *   `ProviderPointsTable`: PK `providerId`.
    *   `SubscriptionsTable`: PK `userId`. Stores active plan info.

*   **Action B**: Overhaul the pricing configuration.
*   **File**: `src/app/api/admin/pricing/route.ts`
*   **Details**: Modify the API to manage tiered PAYG rates and subscription plans in `PricingConfigTable` per the `pricing.md` document.

### Step 3: Security Hardening (Secrets Migration)
*   **Action**: Consolidate to a single admin private key for operational tasks and move it to secure storage.
*   **Files**: `sst.config.ts`, all transaction-sending routes.
*   **Details**:
    1.  Define a single secret: `const PeaqAdminPrivateKey = new sst.Secret("PeaqAdminPrivateKey");`. This key is for operational duties (publishing Merkle roots, minting subscriptions) and is **NOT** a treasury owner.
    2.  Link this secret to all relevant functions.
    3.  Use `new ethers.Wallet(Resource.PeaqAdminPrivateKey.value, provider);` to create the signer instance in all transaction-sending routes.

### Step 4: Backend Business Logic
*   **Action A**: Finalize the rewards rollover endpoint.
*   **File**: `src/app/api/admin/rewards/rollover/route.ts`
*   **Details**: Use `Resource.ProviderPointsTable.name` and add a `PutCommand` to `MetadataTable` to record the Merkle root publication.

*   **Action B**: Implement User Deposit & Subscription Endpoints.
*   **Files**: `/api/v1/pay/deposit/route.ts` and `/api/v1/pay/subscription/route.ts`
*   **Details**: These endpoints will primarily serve to update off-chain caches (`UserTable`, `SubscriptionsTable`) after the user completes the required on-chain transactions (`approve`, `deposit`) from the client-side. The subscription route will also use the `PeaqAdminPrivateKey` to mint the subscription NFT via the `SubscriptionManager`.

### Step 5: Automation (Optional Cron Job)
*   **Action**: Define a disabled cron job for future automation.
*   **File**: `sst.config.ts` & `src/jobs/rewardsCron.ts` (new file)
*   **Details**: Add `new sst.aws.Cron("RewardsCron", { enabled: false, ... })` that calls the `/api/admin/rewards/rollover` endpoint.

### Step 6: Frontend Implementation
*   **Action A**: Build Admin Dashboard controls.
*   **Files**: New React components in `src/components/dashboard/admin/`.
*   **Details**:
    *   `EpochControls.tsx`: Buttons for "Build & Publish Root" and "Sweep Vault".
    *   `TreasuryControls.tsx`: A simple component that displays the protocol's balance in the `RewardDistributor` and provides a direct link to the Gnosis Safe UI for initiating withdrawals.
    *   `PricingManager.tsx`: A UI to manage tiered pricing and subscription plans.

*   **Action B**: Build User payment modals.
*   **Details**: Implement `DepositTokensModal.tsx` and `SubscriptionPurchaseModal.tsx`, using client-side `ethers`/`wagmi` to handle wallet interactions.

### Step 7: Documentation
*   **Action**: Update all relevant markdown documents.
*   **Files**: `cxpt-token-integration.md`, `cxpt-tokenomics.md`.
*   **Details**: Ensure all new contracts, endpoints, and flows (subscriptions, on-chain Safe for treasury) are documented accurately.

---
## 5 · Deliverables Checklist
- [ ] On-chain Gnosis Safe has been created and its address is available.
- [ ] `RewardDistributor` constructor is updated to accept an `initialOwner`.
- [ ] `SubscriptionManager` contract created.
- [ ] `ProviderPointsTable` and `SubscriptionsTable` are defined and used.
- [ ] Pricing logic and storage fully match documentation.
- [ ] Admin dashboard links out to Gnosis Safe for secure, on-chain treasury withdrawals.
- [ ] Subscription purchase endpoint and UI are functional.
- [ ] PAYG deposit endpoint and modal are functional.
- [ ] The single admin private key for operational tasks is migrated to SST Secrets.
- [ ] The disabled `RewardsCron` job is defined.
- [ ] All documentation is up-to-date.

---
**Owner:** `@rizzytwizzy` | **Tech Lead:** `@assistant` | **Lock date:** 30 June 2025
