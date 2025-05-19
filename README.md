# Cxmpute Core

Cxmpute Core is the central application powering the Cxmpute platform. It encompasses the backend services, APIs, and smart contract infrastructure for a hybrid order book Decentralized Exchange (DEX) and a suite of AI/compute services.

![Architecture Overview](https://i.postimg.cc/HkdjKNT8/Screenshot-2025-05-18-at-8-12-40-PM.png)

## Overview

Built with Next.js (App Router for frontend components and API route handlers), TypeScript, and SST v3 for robust AWS serverless deployment, Cxmpute Core is designed for scalability and performance.

**Key Platform Features:**

*   **Hybrid Order Book DEX:**
    *   Supports synthetic assets, options, futures, perpetuals, market, and limit orders.
    *   Features both `REAL` (on-chain settlement) and `PAPER` (simulated) trading modes.
    *   Native platform token ($CXPT) minted upon USDC withdrawal and tradable on the DEX.
    *   Off-chain order matching with on-chain settlement for `REAL` mode via Peaq network smart contracts.
*   **AI & Compute Service APIs:**
    *   Provides authenticated API gateways for various services including LLM Chat, Embeddings, Image/Video/TTS Generation, and Web Scraping. (The actual compute nodes for these services are managed by other parts of the Cxmpute ecosystem).
*   **Authentication & Authorization:**
    *   Utilizes OpenAuthJS for email code-based login.
    *   Manages user accounts, provider identities, and API keys for platform and DEX access.
    *   DEX trading access is controlled via a `traderAk` linked to the user's account.
*   **Infrastructure:**
    *   Leverages AWS serverless technologies (Lambda, DynamoDB, SQS, SNS, API Gateway, S3, SES) deployed and managed by SST v3.
*   **Smart Contracts:**
    *   Solidity-based smart contracts deployed on the Peaq network, handling USDC vault operations, synthetic asset management, and the $CXPT token.

## Platform Architecture

Cxmpute Core follows a modular, service-oriented architecture:

1.  **Application Layer (Next.js):**
    *   Serves the main user interface (parts of `cxmpute.cloud`) and the dedicated trading interface (`trade.cxmpute.cloud` via middleware).
    *   Hosts API route handlers (`src/app/api/*`) for all platform functionalities.
2.  **Authentication (OpenAuthJS):**
    *   Handles user sign-up and login via email codes.
    *   Creates and manages user records in `UserTable`, provider records in `ProviderTable`, and DEX-specific trader identities in `TradersTable`.
    *   Generates API keys (`userAk`, `providerAk`, `traderAk`).
3.  **DEX Subsystem (Off-chain & On-chain):**
    *   **Order Management:** APIs for order submission and cancellation. Orders are stored in DynamoDB (`OrdersTable`).
    *   **Matching Engine:** Orders are routed via SQS queues (e.g., `MarketOrdersQueue`, `OptionsOrdersQueue`) to dedicated Lambda matchers.
    *   **Balance & Position Management:** DynamoDB tables (`BalancesTable`, `PositionsTable`) track user funds and open positions, partitioned by trading `mode` (REAL/PAPER).
    *   **Trade & Market Data:**
        *   `TradesTable`: Stores executed trades.
        *   `KlinesTable`: Stores OHLCV data, aggregated by Lambda functions.
        *   `MarketsTable`: Defines tradable instruments (SPOT, OPTION, FUTURE, PERP) and their parameters.
        *   `PricesTable`: Stores oracle prices for underlying assets.
        *   `Stats...Tables`: Collect various market statistics.
    *   **Real-time Updates (WebSockets):** API Gateway WebSockets (`DexWsApi`) provide live data (depth, trades, PnL) to clients. Subscriptions are managed via `WSConnectionsTable`, with messages fanned out using an SNS topic (`MarketUpdatesTopic`).
    *   **Cron Jobs (Scheduled Lambdas):** Handle options/futures expiry, perpetuals funding, oracle price fetching, metrics rollups, and kline aggregation.
    *   **Smart Contracts (Peaq Network):**
        *   `Vault.sol`: Manages USDC deposits/withdrawals. Acts as a gateway for synthetic asset minting/burning (authorized by `SynthFactory.sol`). Facilitates $CXPT token minting upon USDC withdrawal.
        *   `SynthFactory.sol`: Deploys new `SynthERC20` token contracts, representing synthetic assets.
        *   `SynthERC20.sol`: Standard ERC20 contract for individual synthetic assets (e.g., sBTC, sETH).
        *   `CXPTToken.sol`: The platform's ERC20 utility token.
4.  **AI/Compute Services APIs:**
    *   Next.js API routes under `/api/v1/*` (e.g., `/chat`, `/embeddings`) act as gateways.
    *   These routes authenticate users and then (conceptually) select and forward requests to provisioned compute nodes (details of node management are likely outside `cxmpute-core`).
    *   DynamoDB tables (e.g., `LLMProvisionPoolTable`, `MetadataTable`) support the selection and monitoring of these services.

## Key Features

### DEX Features
*   **Comprehensive Order Types:** Market, Limit, Options (European), Futures, and Perpetuals.
*   **Dual Trading Modes:** `REAL` mode with on-chain value and `PAPER` mode for simulated trading and practice.
*   **Synthetic Assets:** Trade synthetic representations of popular assets (e.g., sBTC, sETH) backed by USDC collateral.
*   **$CXPT Platform Token:**
    *   Minted when users choose to withdraw USDC as $CXPT.
    *   Tradable exclusively on the Cxmpute DEX.
*   **Admin Capabilities:** Secure endpoints for market creation, pausing/unpausing markets, instrument delisting, and fee management.
*   **Real-time Data Feeds:** WebSocket API for live order book updates, recent trades, PnL calculations, oracle prices, and market summaries.
*   **Kline Data:** Historical price data aggregated into various intervals (1m, 5m, 1h, 1d, 1w, 1M) for charting.
*   **Paper Trading Points:** Users earn points in PAPER mode for trading activity and PnL.

### Platform Features
*   **Authenticated API Access:** Secure API keys for users and providers to interact with Cxmpute services.
*   **AI Service Gateways:** API endpoints for:
    *   Chat Completions (OpenAI-compatible)
    *   Text Embeddings
    *   Image Generation
    *   Video Generation
    *   Text-to-Speech (TTS)
    *   Web Scraping
    *   Multi-modal Vision tasks (caption, detect, point, query) via `/api/v1/m/*` routes.
*   **User & Provider Dashboards:** Frontend components for users to manage API keys, view platform stats, and for providers to monitor their earnings and provisions (conceptual based on `src/app/dashboard` and API routes).

## Directory Structure Highlights

*   `src/app/`: Next.js application code.
    *   `pages/`: Frontend pages (e.g., `/`, `/trade`, `/dashboard`).
    *   `api/`: API route handlers.
        *   `v1/trade/`, `orders/`, `balances/`, etc.: DEX-specific authenticated APIs.
        *   `public/`: Publicly accessible DEX data APIs (markets, underlyings, klines).
        *   `v1/chat/`, `v1/embeddings/`, etc.: AI/Compute service APIs.
        *   `admin/`: Administrative APIs.
*   `auth/`: Authentication logic using OpenAuthJS (`index.ts` for handler, `subjects.ts` for user schema).
*   `contracts/`: Solidity smart contracts (`Vault.sol`, `SynthFactory.sol`, etc.) and Hardhat deployment/testing scripts.
*   `dex/`: Core backend logic for the DEX.
    *   `aggregators/`: Kline data aggregation (e.g., `klineAggregator.ts`).
    *   `chain/`: Helpers for interacting with smart contracts (e.g., `vaultHelper.ts`).
    *   `cron/`: Scheduled Lambda functions (e.g., `oracle.ts`, `funding.ts`, `optionExpiry.ts`).
    *   `matchers/`: Order matching engine logic (e.g., `matchEngine.ts`, `market.ts`).
    *   `processors/`: Post-match processing or specific event handling (e.g., `cancellationProcessor.ts`).
    *   `streams/`: DynamoDB stream handlers (e.g., `ordersStreamRouter.ts`).
    *   `ws/`: WebSocket API handlers (connect, disconnect, subscribe, fanOut).
*   `public/`: Static assets.
*   `src/components/`: Reusable React components for UI elements and trading interface panels.
*   `src/contexts/`: React Context API providers for managing global/shared state (Auth, Market, TradingMode, WebSocket, Account, OrderEntry, Wallet).
*   `src/lib/`: Shared utilities, type definitions (`interfaces.ts`), constants (`references.ts`), and API client helpers.
*   `middleware.ts`: Next.js middleware for handling subdomains (e.g., `trade.cxmpute.cloud`).
*   `sst.config.ts`: Serverless Stack (SST) v3 configuration defining AWS infrastructure.

## Key Technologies

*   **Framework:** Next.js (v14+ with App Router), React
*   **Language:** TypeScript
*   **Serverless & IaC:** SST v3 (Serverless Stack)
*   **Cloud Provider:** Amazon Web Services (AWS)
    *   Compute: Lambda
    *   Database: DynamoDB
    *   Messaging: SQS (FIFO Queues), SNS
    *   API: API Gateway (REST & WebSocket)
    *   Storage: S3
    *   Email: SES
*   **Blockchain:**
    *   Smart Contracts: Solidity
    *   Development/Testing: Hardhat
    *   Interaction: Ethers.js (v6)
*   **Authentication:** OpenAuthJS
*   **Charting:** Lightweight Charts (TradingView)
*   **Styling:** CSS Modules (TailwindCSS potentially used in some Sandpack previews, but primary appears to be CSS Modules).

## Setup and Deployment

### Prerequisites
*   Node.js (LTS version recommended)
*   pnpm (Package manager)
*   AWS CLI configured with appropriate credentials and default region.
*   SST CLI installed globally (`npm install -g sst`).

### Environment Variables & Secrets
1.  **Contract Deployment (`contracts/.env`):**
    *   `DEPLOYER_PRIVATE_KEY`: Private key for deploying contracts.
    *   `PEAQ_RPC_URL`: RPC URL for the Peaq mainnet (or testnet like Agung).
    *   `AGUNG_RPC_URL`: RPC URL for the Peaq Agung testnet.
    *   `USDC_ADDRESS` (for non-local deployments): Address of the USDC token contract on the target network.
    *   `CORE_SIGNER_ADDRESS`: Address that will receive `CORE_ROLE` on the Vault (typically the deployer or a dedicated operations wallet).
2.  **SST Secrets (Backend Configuration):**
    *   These are managed via the SST console or CLI (`pnpm sst secrets set <SecretName> <value>`).
    *   `CoreWalletPk`: Private key for the backend wallet that interacts with smart contracts (holds `CORE_ROLE` on Vault, used for funding, expiry settlements, etc.).
    *   `CoreVaultAddress`: Deployed address of the `Vault.sol` contract.
    *   `CoreFactoryAddress`: Deployed address of the `SynthFactory.sol` contract.
    *   `CmcApiKey`: API key for CoinMarketCap (used by the oracle).
    *   Paper trading points configuration: `PaperPointsLimitOrder`, `PaperPointsUsdcVolume`, `PaperPointsUsdcPnl`.
    *   (Ensure any other necessary API keys or sensitive data are configured as SST secrets).

### Installation
```bash
pnpm install
```

### Smart Contract Deployment
1.  Navigate to the contracts directory: `cd contracts`
2.  Ensure your `contracts/.env` file is correctly populated.
3.  Deploy to the desired network (e.g., `agung`, `peaq`, or `localhost` for testing):
    ```bash
    pnpm hardhat deploy --network agung
    ```
4.  After deployment, note the addresses of `Vault.sol` and `SynthFactory.sol`. Update the corresponding SST secrets (`CoreVaultAddress`, `CoreFactoryAddress`) with these new addresses.

### Backend and API Deployment
1.  Ensure all necessary SST secrets are set.
2.  Deploy the application using SST:
    ```bash
    pnpm sst deploy --stage <your_stage_name> # e.g., dev, prod
    ```
    The `--stage` flag is crucial for isolating environments.

## API Overview

Cxmpute Core exposes a comprehensive set of APIs. Refer to `src/lib/openapi.yaml` (if available and maintained) for detailed specifications. Key API groups include:

*   **Authentication:** `/api/auth/*` (handled by OpenAuthJS for login/callback).
*   **DEX APIs:**
    *   Order Management: `POST /api/v1/trade` (legacy, prefer `/api/orders`), `POST /api/orders`, `GET /api/orders`, `DELETE /api/orders/[orderId]`, `GET /api/orders/[orderId]`
    *   Account Data: `GET /api/balances`, `GET /api/positions`, `GET /api/trades/history`, `GET /api/trades/[traderId]/paper-points`
    *   Vault Operations: `POST /api/vault/deposit`, `POST /api/vault/withdraw`, `POST /api/vault/depositsynth`
    *   Synth Exchange: `POST /api/synths/exchange`
    *   Public Market Data: `GET /api/markets`, `GET /api/underlyings`, `GET /api/klines`, `GET /api/instruments`
*   **AI & Compute Service APIs (under `/api/v1/`):**
    *   `/chat/completions`: OpenAI-compatible chat API.
    *   `/embeddings`: Text embedding generation.
    *   `/image`: Text-to-image generation.
    *   `/video`: Text-to-video generation.
    *   `/tts`: Text-to-Speech.
    *   `/scrape`: Web scraping.
    *   `/m/*`: Multi-modal vision tasks (detect, caption, point, query).
*   **User & Provider Management APIs:**
    *   `/api/user/[userId]/*`: User-specific operations (API key management, wallet linking).
    *   `/api/providers/*`: Provider onboarding, login, provision management.
*   **Admin APIs:**
    *   `/api/admin/markets`: Create, pause, delete markets.
    *   `/api/admin/fees`: Manage fee withdrawals from the Vault.

## Smart Contract Interactions

The DEX relies on the following key smart contracts on the Peaq network:

*   **`Vault.sol`**:
    *   Securely holds USDC collateral.
    *   Manages deposits of USDC and sAssets (via `depositSynthToVault`).
    *   Handles withdrawals of USDC or the minting and withdrawal of $CXPT tokens.
    *   Provides `CORE_ROLE` for privileged operations (e.g., fee withdrawal, settlements by backend).
    *   Provides `GATEWAY_ROLE` to `SynthFactory` for registering synths and potentially to other contracts for minting/burning sAssets against collateral.
*   **`SynthFactory.sol`**:
    *   Responsible for deploying new `SynthERC20` token contracts for synthetic assets.
    *   Registers newly created synths with the `Vault`.
*   **`SynthERC20.sol`**:
    *   Standard ERC20-compliant contract representing a specific synthetic asset (e.g., sBTC).
    *   Grants `MINTER_ROLE` and `BURNER_ROLE` to the `Vault` contract for managing supply based on collateral.
*   **`CXPTToken.sol`**:
    *   The platform's native ERC20 token ($CXPT).
    *   Minted by the `Vault` contract when users choose to withdraw USDC as $CXPT.

**Role-Based Access Control:**
The contracts use OpenZeppelin's `AccessControl` for managing permissions. Key roles include:
*   `DEFAULT_ADMIN_ROLE`: Overall admin for contract ownership and role management.
*   `CORE_ROLE` (on Vault): For backend operations like settlements and fee withdrawals.
*   `GATEWAY_ROLE` (on Vault): Granted to `SynthFactory` to register synths. Also used by the Vault for sAsset mint/burn operations executed by the backend server signer for `exchangeUSDCToSAsset` and `exchangeSAssetToUSDC` functions.
*   `MINTER_ROLE`, `BURNER_ROLE` (on SynthERC20 & CXPTToken): Granted to the `Vault` to control token supply.

## Database Schema (DynamoDB)

The platform utilizes DynamoDB for its data persistence, with schemas designed for scalability and efficient querying. Many tables are partitioned by trading `mode` (REAL/PAPER) embedded within their primary keys (e.g., `MARKET#BTC-PERP#PAPER`).

**Key DEX Tables:**

*   **`OrdersTable`**: Stores all open, partial, filled, cancelled, and expired orders.
    *   PK: `MARKET#<symbol>#<mode>`, SK: `TS#<timestamp>#<orderId>`
    *   GSIs: `ByTraderMode` (PK: `traderId`, SK: `pk`), `ByOrderId` (PK: `orderId`).
*   **`BalancesTable`**: Tracks trader balances for various assets (USDC, CXPT, sAssets).
    *   PK: `TRADER#<traderId>#<mode>`, SK: `ASSET#<assetSymbol>`
*   **`PositionsTable`**: Manages traders' open positions for derivative markets.
    *   PK: `TRADER#<traderId>#<mode>`, SK: `MARKET#<instrumentSymbol>`
*   **`TradesTable`**: Logs all executed trades.
    *   PK: `MARKET#<symbol>#<mode>`, SK: `TS#<tradeId>`
    *   GSIs: `ByTraderMode` (PK: `traderId`, SK: `pk`).
*   **`MarketsTable`**: Defines all tradable instruments and underlying pairs.
    *   PK: `MARKET#<symbolOrPair>#<mode>`, SK: `META`
    *   GSIs: `ByStatusMode` (status & mode), `InstrumentsByUnderlying` (for derivative discovery).
*   **`KlinesTable`**: Stores aggregated OHLCV (candlestick) data.
    *   PK: `MARKET#<instrumentSymbol>#<mode>`, SK: `INTERVAL#<interval_str>#TS#<start_timestamp_seconds>`
*   **`PricesTable`**: Stores oracle price snapshots for underlying assets.
    *   PK: `ASSET#<symbol>`, SK: `TS#<ISO_timestamp>`
*   **`StatsIntradayTable`**, **`StatsDailyTable`**, **`StatsLifetimeTable`**: Aggregate market statistics.
*   **`WSConnectionsTable`**: Manages active WebSocket connections and their subscriptions.
    *   PK: `WS#<connectionId>`, SK: `META`
    *   GSI: `ByChannel` (PK: `channel`).
*   **`TradersTable`**: Stores DEX trader identity information, linked wallet, and API key for trading.
    *   PK: `traderId`
    *   GSI: `ByAk` (PK: `traderAk`).

**Key Platform Tables (Non-DEX specific but part of `cxmpute-core`):**

*   **`ProviderTable`**: Information about compute providers.
*   **`ProvisionsTable`**: Details of individual compute provisions by providers.
*   **`UserTable`**: Core platform user accounts and general API keys.
*   **`*ProvisionPoolTable`s** (e.g., `LLMProvisionPoolTable`, `MediaProvisionPoolTable`): Manage pools of available compute resources for different service types.
*   **`MetadataTable`**, **`ServiceMetadataTable`**: Track usage and performance metrics for platform services.

## Authentication Flow

1.  A user initiates login, typically from a frontend component (e.g., `/dashboard`).
2.  The request is handled by a server action (`src/app/actions.ts/login`) which redirects the user to the OpenAuth provider endpoint (e.g., `/api/auth/code/...`).
3.  The OpenAuth provider (`auth/index.ts`) handles the email code generation (via SES) and verification.
4.  Upon successful code verification, the `success` callback in `auth/index.ts` is triggered.
5.  The `ensureUserAndTrader` function within this callback:
    *   Checks for an existing `ProviderTable` entry for the email or creates one.
    *   Checks for an existing `UserTable` entry linked to the provider or creates one. Generates `userAk`.
    *   Checks for an existing `TradersTable` entry using the `UserTable.userId` as `TradersTable.traderId`. If not found, creates one, storing the `UserTable.userAk` as the `TradersTable.traderAk` (used for GSI).
6.  The OpenAuth client (`src/app/auth.ts`) sets JWTs (access and refresh tokens) as HTTP-only cookies.
7.  Subsequent requests are authenticated:
    *   Server-side: The `auth()` server action (`src/app/actions.ts`) verifies tokens and returns the user subject.
    *   Client-side: The `useAuth()` context hook provides access to the user subject.
    *   API Routes: Use helper functions like `requireAuth()` or `requireAdmin()` from `src/lib/auth.ts` to protect endpoints.

## Middleware (`middleware.ts`)

The Next.js middleware (`middleware.ts`) inspects the host header. If a request comes to `trade.cxmpute.cloud`, it rewrites the URL path to prepend `/trade`. For example, `trade.cxmpute.cloud/settings` becomes `/trade/settings` internally, allowing the Next.js App Router to serve content from the `src/app/trade/` directory structure.

## WebSockets (`DexWsApi`)

*   **Connection:** Clients connect to the API Gateway WebSocket endpoint, providing their `traderAk` as a query parameter for authentication in the `$connect` route handler (`dex/ws/connect.ts`).
*   **Subscription:** Clients send a `subscribe` message with a channel string (e.g., `market.BTC-PERP.REAL` or `trader.<traderId>.PAPER`). The `dex/ws/subscribe.ts` handler updates the `WSConnectionsTable` with the subscribed channel and mode.
*   **Fan-Out:** Backend services (matchers, cron jobs) publish market events to an SNS topic (`MarketUpdatesTopic`). The `dex/ws/fanOut.ts` Lambda subscribes to this topic, queries `WSConnectionsTable` (using the `ByChannel` GSI) for relevant connections, and pushes updates to clients via the API Gateway Management API.
*   **Data Types:** WebSocket messages include depth updates, new trades, PnL changes, oracle prices, market summaries, and trader-specific order/position/balance updates.
  

## Architecture Overview

Cxmpute Core implements a modular, event-driven architecture designed for scalability and real-time performance. It revolves around API gateways (Next.js routes), serverless functions (AWS Lambda), managed databases (DynamoDB), message queues (SQS), real-time messaging (SNS, API Gateway WebSockets), and on-chain smart contracts (Peaq).

### Core Systems

1.  **Authentication & User Management:** Handles user identity, API key provisioning, and DEX trader account linkage.
2.  **Decentralized Exchange (DEX):** Manages order lifecycle, matching, balance updates, position tracking, and market data dissemination for both `REAL` and `PAPER` trading modes.
3.  **AI/Compute Service Gateways:** Provides authenticated API endpoints that (conceptually) route requests to a network of compute providers.

---

### 1. Authentication & User Management

**Flow:** User Login & Trader Setup

```
   User via UI                             Cxmpute Core (Next.js/OpenAuthJS)                      DynamoDB
      │                                           │                                                │
      ├─ 1. Login Request ──────────────────────► │                                                │
      │                                           ├─ 2. Email Code Flow (OpenAuthJS + SES) ───────► │ User confirms
      │                                           │                                                │
      │                                           ├─ 3. `ensureUserAndTrader` function runs ──────► │
      │                                           │    - Create/Verify ProviderTable entry         │ ProviderTable
      │                                           │    - Create/Verify UserTable entry (gen userAk)  │ UserTable
      │                                           │    - Create/Verify TradersTable entry          │ TradersTable
      │                                           │      (traderId=userId, traderAk=userAk)        │
      │                                           │                                                │
      │ ◄─ 4. Set Auth Cookies (JWTs) ────────────┤                                                │
      │                                           │                                                │
```

*   **`auth/index.ts`:** OpenAuthJS handler.
    *   Uses `ensureUserAndTrader` to create/verify entries in:
        *   **`ProviderTable`**: Stores provider identity (e.g., email if they are also a compute provider).
        *   **`UserTable`**: Core platform user account, stores general `userAk`.
        *   **`TradersTable`**: DEX-specific trader profile. `traderId` is the same as `UserTable.userId`. `traderAk` is the same as `UserTable.userAk` and is used for authenticating DEX API calls and WebSocket connections.

**Key Tables:**

*   **`UserTable`**:
    *   PK: `userId` (e.g., `u_uuid1`)
    *   Attributes: `userAk`, `email`, `providerId`, `admin`, `walletAddress` (optional, for platform use, not necessarily DEX)
*   **`ProviderTable`**:
    *   PK: `providerId` (e.g., `p_uuid2`)
    *   Attributes: `providerEmail`, `apiKey` (this is providerAk)
*   **`TradersTable`**:
    *   PK: `traderId` (e.g., `u_uuid1` - same as UserTable.userId)
    *   Attributes: `traderAk` (same as UserTable.userAk), `email`, `status`, `walletAddress` (primary linked wallet for DEX), `paperPoints`
    *   GSI `ByAk`: PK `traderAk` (for WS auth and API auth)

---

### 2. Decentralized Exchange (DEX)

#### a. Order Lifecycle & Matching

**Flow:** New Order Submission & Matching

```
   Trader Client (UI/API)        Next.js API (/api/orders)       OrdersTable (DDB)        DDB Stream Router (Lambda)       SQS FIFO Queue        Matcher Lambda (e.g., market.ts)
            │                             │                             │                            │                            │                             │
            ├─ 1. Submit Order ----------► │                             │                            │                            │                             │
            │                             ├─ 2. Auth (traderAk)        │                            │                            │                             │
            │                             │    & Validate               │                            │                            │                             │
            │                             ├─ 3. Lock Collateral ◄─────► │ BalancesTable (DDB)        │                            │                             │
            │                             ├─ 4. Put Order Item ────────► │                            │                            │                             │
            │                             │                             │ ◄─ 5. Stream Event ────────┤                            │                             │
            │                             │                             │                            ├─ 6. Route to SQS ──────────► │                             │
            │                             │                             │                            │                            │ ◄─ 7. Consume Order Msg ─────┤
            │                             │                             │                            │                            │                             ├─ 8. Match Engine Logic
            │                             │                             │                            │                            │                             │   - Query OrdersTable (Book)
            │                             │                             │                            │                            │                             │   - Update OrdersTable (Fill/Partial)
            │                             │                             │                            │                            │                             │   - Create TradesTable entries
            │                             │                             │                            │                            │                             │   - Update PositionsTable
            │                             │                             │                            │                            │                             │   - Update BalancesTable (settle)
            │                             │                             │                            │                            │                             │   - Update Stats...Tables
            │                             │                             │                            │                            │                             │   - (REAL Mode) Record Fees (Vault.sol)
            │                             │                             │                            │                            │                             │
            │                             │                             │                            │                            │                             ├─ 9. Publish to SNS (MarketUpdatesTopic)
            │                             │                             │                            │                            │                             │
            │ ◄─ (Optional) Order Ack ---┤                             │                            │                            │                             │
            │    (WebSocket updates follow)                             │                            │                            │                             │
```

**Key Components & Tables for Order Flow:**

*   **API (`src/app/api/orders/route.ts` or `/api/v1/trade/route.ts`):**
    *   Authenticates trader via `X-Trader-Ak`.
    *   Validates order parameters against `MarketsTable` definitions (tick size, lot size).
    *   Performs initial collateral check and lock in `BalancesTable` (transactional with order placement).
    *   Writes the new `Order` to `OrdersTable`.
*   **`OrdersTable`**:
    *   PK: `MARKET#<instrumentSymbol>#<mode>` (e.g., `MARKET#BTC-PERP#PAPER`)
    *   SK: `TS#<timestamp>#<orderId>`
    *   Attributes: `orderId`, `traderId`, `market`, `side`, `qty`, `price`, `orderType`, `status`, `filledQty`, `mode`, `createdAt`, `feeBps`, `oraclePriceUsedForCollateral` (for market sell perps/futures).
    *   Stream: `NEW_AND_OLD_IMAGES` (triggers `ordersStreamRouter.ts`).
*   **`ordersStreamRouter.ts` (Lambda):**
    *   Consumes `OrdersTable` stream.
    *   For `INSERT` (new orders): Routes order to the appropriate SQS FIFO queue based on `orderType` and `mode`.
    *   For `MODIFY` (e.g., status changes to `CANCELLED`): Routes to `CancelledOrdersQueue`.
*   **SQS Queues (FIFO):** `MarketOrdersQueue`, `OptionsOrdersQueue`, `PerpsOrdersQueue`, `FuturesOrdersQueue`, `CancelledOrdersQueue`.
    *   Ensures ordered processing per market-mode group (`MessageGroupId: <marketSymbol>-<mode>`).
*   **Matcher Lambdas (`dex/matchers/*.ts`):**
    *   Consume orders from their respective SQS queues.
    *   Utilize `matchEngine.ts` to:
        *   Load open orders from `OrdersTable` for the specified market and mode.
        *   Match incoming taker orders against the book.
        *   Perform transactional updates (using `TransactWriteItems`) to:
            *   `OrdersTable`: Update status and `filledQty` of matched orders.
            *   `TradesTable`: Create new trade records.
            *   `BalancesTable`: Debit/credit assets for filled trades (USDC and base/sAsset).
            *   `PositionsTable`: Update position size, average entry price, and realized PnL.
            *   `StatsIntradayTable` & `StatsLifetimeTable`: Update volume, fees, trade counts.
    *   For `REAL` mode, the `matchEngine` calls `Vault.sol::recordFees()` for collected fees.
    *   Publishes events (e.g., `orderUpdate`, `trade`, `positionUpdate`) to `MarketUpdatesTopic` (SNS).
*   **`cancellationProcessor.ts` (Lambda):**
    *   Consumes from `CancelledOrdersQueue`.
    *   Calculates and releases any locked collateral in `BalancesTable` for the cancelled order portion.

**Example `OrdersTable` Item:**
```json
{
  "pk": "MARKET#BTC-PERP#PAPER", // MARKET#<instrumentSymbol>#<mode>
  "sk": "TS#1700000000000#order_uuid123",
  "orderId": "order_uuid123",
  "traderId": "trader_abc",
  "market": "BTC-PERP",
  "side": "BUY",
  "qty": 0.5,
  "price": 60000,
  "orderType": "LIMIT", // or "PERP" if Limit on a PERP market
  "status": "OPEN",
  "filledQty": 0,
  "mode": "PAPER",
  "createdAt": 1700000000000,
  "feeBps": 50 // 0.5%
}
```

**Example `BalancesTable` Item:**
```json
{
  "pk": "TRADER#trader_abc#PAPER", // TRADER#<traderId>#<mode>
  "sk": "ASSET#USDC",             // ASSET#<assetSymbol>
  "asset": "USDC",
  "balance": "10000000000",      // 10,000 USDC (bigint string, 6 decimals)
  "pending": "500000000",        // 500 USDC locked for open orders (bigint string)
  "updatedAt": 1700000000000
}
```

#### b. Real-time Data (WebSockets)

**Flow:** Market Event to Client UI

```
Matcher/Cron Lambda           SNS (MarketUpdatesTopic)      WsFanOut Lambda        API Gateway WebSocket       Client UI
       │                             │                            │                       │                    │
       ├─ 1. Publish Event ---------► │                            │                       │                    │
       │                             │ ◄─ 2. Consume SNS Msg ----┤                       │                    │
       │                             │                            ├─ 3. Query WSConnectionsTable -► │ DDB        │
       │                             │                            │    (GSI ByChannel)            │            │
       │                             │                            ├─ 4. PostToConnection() -------► │            │
       │                             │                            │                               │ ◄─ 5. Data │
       │                             │                            │                               │    Update  │
```

*   **`WSConnectionsTable`**:
    *   PK: `WS#<connectionId>`
    *   SK: `META`
    *   Attributes: `traderId`, `channel` (e.g., `market.BTC-PERP.REAL`), `channelMode` (`REAL`/`PAPER`), `expireAt` (TTL).
    *   GSI `ByChannel`: PK `channel`, SK `pk` (used by `WsFanOut` to find subscribers).
*   **`dex/ws/subscribe.ts`:** Handles client requests to subscribe to specific channels, updating the `channel` and `channelMode` in `WSConnectionsTable`.
*   **`dex/ws/fanOut.ts`:** Lambda triggered by SNS. Retrieves connection IDs for the event's channel/mode from `WSConnectionsTable` and pushes data via API Gateway's management API.

#### c. Smart Contracts & On-Chain Operations (REAL Mode)

```
DEX Backend (e.g., Matcher, Cron, API)   Ethers.js + CoreWalletPk    Peaq Network (Smart Contracts)
            │                                       │                               │
            ├─ 1. Initiate On-Chain Action --------► │                               │
            │    (e.g., recordFees, withdraw,        │                               │
            │     depositSynth, exchange)           │                               │
            │                                       ├─ 2. Sign & Send Tx --------► │ Vault.sol
            │                                       │                               │ SynthFactory.sol
            │                                       │                               │ CXPTToken.sol
            │                                       │                               │ SynthERC20.sol
            │                                       │                               │ (USDC ERC20)
            │                                       │                               │
            │ ◄─ 3. Tx Receipt/Confirmation --------┤                               │
            │                                       │                               │
            ├─ 4. Update Off-Chain State (DDB)      │                               │
            │                                       │                               │
```

*   **`Vault.sol`:** Central contract for holding USDC, managing deposits/withdrawals, minting $CXPT, and interfacing with synthetic assets.
    *   `deposit()`: User deposits USDC (requires user's prior ERC20 approval to Vault).
    *   `withdraw()`: Backend calls to transfer USDC or mint & transfer $CXPT to user.
    *   `depositSynthToVault()`: User deposits sAsset (requires user's prior sAsset ERC20 approval to Vault).
    *   `withdrawSynthFromVault()`: Backend calls to transfer sAsset from Vault to user.
    *   `exchangeUSDCToSAsset()` / `exchangeSAssetToUSDC()`: Backend calls for direct USDC <> sAsset swaps via Vault (requires user's prior ERC20 approval of FROM_ASSET to Vault).
    *   `recordFees()`: Called by backend (matcher) to track platform fees.
*   **`SynthFactory.sol`:** Deploys `SynthERC20` contracts and registers them with the Vault.
*   **`CXPTToken.sol`:** ERC20 for the platform token, mintable by the `Vault`.
*   **`dex/chain/vaultHelper.ts` (and similar):** Backend helpers for interacting with these contracts.

#### d. Kline Aggregation

```
TradesTable (DDB Stream)    TradesStreamRouter (Lambda)    KlineAggregationQueue (SQS)    KlineAggregator (Lambda)    KlinesTable (DDB)
        │                             │                               │                                 │                      │
        ├─ 1. New Trade Stream Event ► │                               │                                 │                      │
        │                             ├─ 2. Send Trade to Queue -----► │                                 │                      │
        │                             │                               │ ◄─ 3. Consume Trade -----------┤                      │
        │                             │                               │                                 ├─ 4. Aggregate OHLCV ► │
        │                             │                               │                                 │                      │
```
*   `klineAggregator.ts`: Processes trades from `TradesTable` (via SQS), calculates OHLCV data for various intervals, and stores them in `KlinesTable`.
*   `dailyToWeeklyKlineCron.ts`, `dailyToMonthlyKlineCron.ts`: Aggregate finer-grained klines into coarser ones.

---

### 3. AI/Compute Service Gateways

**Flow:** AI Service Request (e.g., Chat Completion)

```
   User Client (e.g., App/SDK)      Next.js API (/api/v1/chat/completions)      (Conceptual) Provision Pool (DDB)      (Conceptual) Compute Node
            │                                        │                                     │                                  │
            ├─ 1. API Request (OpenAI format) -----► │                                     │                                  │
            │                                        ├─ 2. Auth (API Key, X-User-Id)      │                                  │
            │                                        │    & Validate                         │                                  │
            │                                        ├─ 3. Select Healthy Node ◄───────────┤ LLMProvisionPoolTable          │
            │                                        │    (via lib/utils.ts helpers)         │                                  │
            │                                        ├─ 4. Forward Request ───────────────────────────────────────────────► │
            │                                        │                                     │                                  │ ◄─ 5. Process Request
            │                                        │                                     │                                  │
            │ ◄─ 6. Stream/Return Response ---------┼─────────────────────────────────────────────────────────────────────────┤
            │                                        │                                     │                                  │
            │                                        ├─ 7. Update Metrics (MetadataTable, ServiceMetadataTable)             │
            │                                        │    & Reward Provider (ProviderTable)                                  │
            │                                        │                                     │                                  │
```

*   **API Routes (`src/app/api/v1/*`):**
    *   Act as authenticated gateways.
    *   Use helpers from `src/lib/utils.ts` to:
        *   `validateApiKey()`: Checks `UserTable` for key validity and credits.
        *   `select<Service>Provision()`: Chooses a node from the relevant `*ProvisionPoolTable` (e.g., `LLMProvisionPoolTable`).
        *   `check<Service>Health()`: Pings the node's heartbeat.
        *   `remove<Service>Provision()`: Removes unhealthy nodes.
        *   `update<Service>Metadata()` & `update<Service>ServiceMetadata()`: Logs usage.
        *   `rewardProvider()`: Updates provider earnings in `ProviderTable`.
*   **Provision Pool Tables (e.g., `LLMProvisionPoolTable`):**
    *   Store available compute nodes for specific services/models.
    *   Contain `provisionId`, `model`, `randomValue` (for load balancing), `provisionEndpoint`.
    *   Populated by providers via `/api/v1/providers/start/callback`.

---

# Contracts

## Smart Contracts (Peaq Network)

The Cxmpute Core platform leverages a suite of smart contracts deployed on the Peaq network to manage tokenized assets, collateral, and platform-specific functionalities. These contracts are written in Solidity and orchestrated by the backend for on-chain settlement in `REAL` trading mode.

**Deployed Contract Addresses (Peaq Mainnet):**

*   **`USDC_ADDRESS` (External):** `0xbba60da06c2c5424f03f7434542280fcad453d10`
*   **`CXPTToken.sol`:** `0xBdA07f578d16c6Dca2F89665B34e9bab37C4Ab63`
*   **`Vault.sol`:** `0xf19C0e1Fef0bAe2be417df5Fbd9442e84f156380`
*   **`SynthFactory.sol`:** `0xcE45522442E11669ac2a1Fb7c98fbc6c9D726470`

**Deployed Synthetic Assets (sASSETs - SynthERC20 instances):**

*   **sBTC:** `0x8212bc8Cf151c97183fA2a21F5b4c0eaC111693f`
*   **sETH:** `0xF4E0ACfF0CC8a4b534799b4f899B636167A43f30`
*   **sPEAQ:** `0x41388d95A15C90EC32cc3887C4de4D6834BB8150`
*   **sAVAX:** `0x2e39F19e6891f040332Fc79EccEaaeAb16202058`
*   **sSOL:** `0x64815DDb43a1Ef1DcFfDacBA9c26F4E60D613465`
*   **sBNB:** `0x32E7242697bFf6853DA50d04245BBc054482aCAF`
*   **sNEAR:** `0x132841950af7A04270B3315ed63A45FF97fc257e`
*   **sOP:** `0x5f4573E3adE6e5b2fb9c32B135B2fA955D84541a`
*   **sDOT:** `0x6C181Cb22d946B0ca48b7Ef43eC7DeE44DDeD302`

### Contract Descriptions:

1.  **`Vault.sol`**
    *   **Address:** `0xf19C0e1Fef0bAe2be417df5Fbd9442e84f156380`
    *   **Purpose:** The central treasury and operational hub for on-chain assets.
    *   **Functionality:**
        *   Securely holds USDC, which serves as the primary collateral.
        *   Manages user deposits of USDC and supported synthetic assets (sASSETs) into the platform's custody.
        *   Processes withdrawals of USDC or, optionally, mints and transfers `CXPTToken` to users.
        *   Facilitates the on-chain exchange (minting/burning) of sASSETs against USDC.
        *   Collects platform trading fees in USDC.
    *   **Key Roles:**
        *   `DEFAULT_ADMIN_ROLE`: `0x1387FCD853C362d83FDC361C4198158aCAC13fcD` (Deployer)
        *   `ADMIN_ROLE`: `0x1387FCD853C362d83FDC361C4198158aCAC13fcD` (Deployer - for fee withdrawals)
        *   `CORE_ROLE`: `0x1387FCD853C362d83FDC361C4198158aCAC13fcD` (Backend Signer - for deposits, withdrawals, exchanges, fee recording)
        *   `GATEWAY_ROLE`: `0xcE45522442E11669ac2a1Fb7c98fbc6c9D726470` (`SynthFactory` - for registering new synths)

2.  **`SynthFactory.sol`**
    *   **Address:** `0xcE45522442E11669ac2a1Fb7c98fbc6c9D726470`
    *   **Purpose:** Responsible for creating and registering new synthetic asset (sASSET) token contracts.
    *   **Functionality:**
        *   Allows the owner (admin) to deploy new `SynthERC20` contracts.
        *   Automatically registers the newly created synth token with the `Vault.sol` contract.
        *   Sets the `Vault.sol` contract as the `MINTER_ROLE` and `BURNER_ROLE` holder on the new `SynthERC20` token.
    *   **Key Roles:**
        *   `OWNER (Ownable)`: `0x1387FCD853C362d83FDC361C4198158aCAC13fcD` (Deployer - for calling `createSynth`)

3.  **`SynthERC20.sol`** (Template for all sASSETs)
    *   **Addresses:** See list above (e.g., sBTC: `0x8212bc8Cf151c97183fA2a21F5b4c0eaC111693f`)
    *   **Purpose:** An ERC20-compliant token contract representing a specific synthetic asset (e.g., Synthetic Bitcoin - sBTC).
    *   **Functionality:**
        *   Standard ERC20 token operations (transfer, approve, balanceInquiry).
        *   Minting and burning functions restricted by `MINTER_ROLE` and `BURNER_ROLE`.
    *   **Key Roles (for each SynthERC20 instance):**
        *   `DEFAULT_ADMIN_ROLE`: `0xcE45522442E11669ac2a1Fb7c98fbc6c9D726470` (`SynthFactory` address, as it was the `owner()` of SynthFactory during `createSynth`)
        *   `MINTER_ROLE`: `0xf19C0e1Fef0bAe2be417df5Fbd9442e84f156380` (`Vault` address)
        *   `BURNER_ROLE`: `0xf19C0e1Fef0bAe2be417df5Fbd9442e84f156380` (`Vault` address)

4.  **`CXPTToken.sol`**
    *   **Address:** `0xBdA07f578d16c6Dca2F89665B34e9bab37C4Ab63`
    *   **Purpose:** The native utility and governance token of the Cxmpute platform ($CXPT).
    *   **Functionality:**
        *   Standard ERC20 token.
        *   Minted exclusively by the `Vault.sol` contract when users elect to withdraw their USDC funds in the form of $CXPT.
    *   **Key Roles:**
        *   `DEFAULT_ADMIN_ROLE`: `0x1387FCD853C362d83FDC361C4198158aCAC13fcD` (Deployer)
        *   `MINTER_ROLE`: `0xf19C0e1Fef0bAe2be417df5Fbd9442e84f156380` (`Vault` address)

### On-Chain Interactions Flow (REAL Mode Examples):

*   **User Deposits USDC:**
    1.  User approves `Vault.sol` to spend their USDC.
    2.  Backend (with `CORE_ROLE`) calls `Vault.sol::depositUSDC(userWallet, amount)`, transferring USDC from user to Vault.
*   **User Withdraws USDC as $CXPT:**
    1.  Backend (with `CORE_ROLE`) calls `Vault.sol::withdraw(userWallet, amount, true)`.
    2.  `Vault.sol` (with `MINTER_ROLE` on `CXPTToken.sol`) mints new $CXPT tokens directly to `userWallet`.
*   **User Exchanges USDC for sBTC:**
    1.  User approves `Vault.sol` to spend their USDC.
    2.  Backend (with `CORE_ROLE`) calls `Vault.sol::exchangeUSDCToSAsset(userWallet, sBTC_address, usdcAmount, sbtcAmount)`.
    3.  `Vault.sol` transfers USDC from `userWallet` to itself.
    4.  `Vault.sol` (with `MINTER_ROLE` on sBTC contract) mints new sBTC tokens directly to `userWallet`.
*   **Synth Creation (Admin Action):**
    1.  Admin (owner of `SynthFactory.sol`) calls `SynthFactory.sol::createSynth("Synthetic PEAQ", "sPEAQ", 18)`.
    2.  `SynthFactory.sol` deploys a new `SynthERC20.sol` contract for sPEAQ.
    3.  `SynthFactory.sol` grants `MINTER_ROLE` and `BURNER_ROLE` on the new sPEAQ contract to `Vault.sol`.
    4.  `SynthFactory.sol` (with `GATEWAY_ROLE` on `Vault.sol`) calls `Vault.sol::registerSynth(new_sPEAQ_address)`.

### Role-Based Access Control Summary:

The contracts utilize OpenZeppelin's `AccessControlEnumerable` for fine-grained permission management:

*   **Deployer (`0x1387FCD853C362d83FDC361C4198158aCAC13fcD`):**
    *   Holds `DEFAULT_ADMIN_ROLE` on `Vault` and `CXPTToken`.
    *   Holds `ADMIN_ROLE` on `Vault`.
    *   Is the `owner` of `SynthFactory`.
    *   Is the initial `CORE_ROLE` holder on `Vault`.
*   **Vault (`0xf19C0e1Fef0bAe2be417df5Fbd9442e84f156380`):**
    *   Holds `MINTER_ROLE` on `CXPTToken`.
    *   Holds `MINTER_ROLE` and `BURNER_ROLE` on all deployed `SynthERC20` (sASSET) contracts.
*   **SynthFactory (`0xcE45522442E11669ac2a1Fb7c98fbc6c9D726470`):**
    *   Holds `GATEWAY_ROLE` on `Vault`.
    *   Is the `DEFAULT_ADMIN_ROLE` holder for all deployed `SynthERC20` (sASSET) contracts (as it was the admin that initiated their creation).

This system ensures that only authorized entities can perform critical operations like minting tokens, registering new assets, or managing platform fees.