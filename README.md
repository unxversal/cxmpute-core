# Cxmpute Core

Cxmpute Core is the central platform powering the Cxmpute ecosystem. It encompasses a distributed AI/Compute services platform and a comprehensive suite of DeFi protocols built on the Peaq network.

![Architecture Overview](https://i.postimg.cc/HkdjKNT8/Screenshot-2025-05-18-at-8-12-40-PM.png)

## Overview

Built with Next.js (App Router), TypeScript, and SST v3 for robust AWS serverless deployment, Cxmpute Core is designed for scalability and performance across two main domains:

**1. AI/Compute Services Platform:**
*   **Distributed AI Gateway:** Connects users with decentralized compute providers
*   **OpenAI-Compatible APIs:** Chat completions, embeddings, TTS, image/video generation, web scraping
*   **Provider Network:** Permissionless onboarding for compute resource providers
*   **Usage Analytics:** Real-time metrics, provider performance tracking, and reward distribution
*   **Multi-modal Support:** Text, image, audio, and vision processing capabilities

**2. Unxversal DeFi Protocols (Peaq Network):**
*   **unxversal dex:** Pure on-chain settlement with NFT-encoded order discovery
*   **unxversal synth:** USD-collateralized synthetic assets with LayerZero oracles
*   **unxversal lend:** Permissionless lending and borrowing layer
*   **unxversal perps:** Cross-margin perpetual futures with up to 20x leverage
*   **unxversal DAO:** Governance layer for the entire protocol stack

## Platform Architecture

### AI/Compute Services Architecture

The platform follows a serverless, event-driven architecture:

1.  **Frontend Layer (Next.js):**
    *   Serves user dashboards (`cxmpute.cloud`)
    *   Provider onboarding and management interfaces
    *   API route handlers (`src/app/api/v1/*`) for all AI services

2.  **Authentication (OpenAuth):**
    *   Email-based authentication with code verification
    *   Multi-tenant user and provider management
    *   API key provisioning and credit management

3.  **Provider Network:**
    *   Health monitoring and load balancing
    *   Randomized provision selection
    *   Automatic reward distribution
    *   Service-specific provision pools (LLM, Embeddings, TTS, etc.)

4.  **Infrastructure:**
    *   AWS serverless stack (Lambda, DynamoDB, SQS, SNS, API Gateway, SES)
    *   Real-time usage tracking and analytics
    *   Credit-based billing system

### Unxversal DeFi Architecture

The DeFi protocols operate on Peaq network with shared infrastructure:

1.  **Smart Contract Layer:**
    *   Immutable core contracts with governance-controlled parameters
    *   Role-based access control with OpenZeppelin
    *   Cross-protocol composability

2.  **Oracle Infrastructure:**
    *   LayerZero-based price feeds from Ethereum Chainlink
    *   Cross-chain message verification
    *   Fallback mechanisms for price stability

3.  **Order Management (DEX):**
    *   NFT-encoded orders with off-chain discovery
    *   On-chain settlement guarantees
    *   Permissionless indexer network

## Key Features

### AI/Compute Services
*   **OpenAI Compatibility:** Drop-in replacement for OpenAI APIs
*   **Provider Marketplace:** Decentralized network of compute providers
*   **Real-time Analytics:** Usage tracking, performance metrics, provider rewards
*   **Credit System:** Flexible billing with API key management
*   **Health Monitoring:** Automatic failover and provider management
*   **Multi-modal APIs:** Text, image, audio, and vision processing

### Unxversal DeFi Protocols
*   **NFT-Native Trading:** Orders as transferable ERC-721 tokens
*   **Synthetic Assets:** USDC-backed sAssets (sBTC, sETH, etc.)
*   **Cross-Margin Lending:** Unified collateral across all protocols
*   **Perpetual Futures:** Up to 20x leverage with peer-to-peer funding
*   **Governance:** veUNXV token with gauge-based emissions
*   **Composability:** Protocols designed to work together seamlessly

## Directory Structure

```
cxmpute-core/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API route handlers
│   │   │   ├── v1/           # AI service endpoints
│   │   │   │   ├── chat/     # Chat completions
│   │   │   │   ├── embeddings/ # Text embeddings
│   │   │   │   ├── tts/      # Text-to-speech
│   │   │   │   ├── scrape/   # Web scraping
│   │   │   │   └── providers/ # Provider management
│   │   │   ├── admin/        # Admin endpoints
│   │   │   ├── user/         # User management
│   │   │   └── providers/    # Provider onboarding
│   │   ├── dashboard/        # User dashboard pages
│   │   ├── provider/         # Provider dashboard pages
│   │   └── user/            # User profile pages
│   ├── components/           # React components
│   │   ├── dashboard/       # Dashboard components
│   │   ├── ProviderDashboard/ # Provider-specific UI
│   │   ├── UserDashboard/   # User-specific UI
│   │   └── ui/              # Shared UI components
│   └── lib/                 # Shared utilities
│       ├── interfaces.ts    # TypeScript interfaces
│       ├── utils.ts         # Core utility functions
│       ├── auth.ts          # Authentication helpers
│       └── references.ts    # Constants and references
├── auth/                    # OpenAuth configuration
│   ├── index.ts            # Auth handler
│   └── subjects.ts         # User schema
├── unxversal/              # DeFi protocols suite
│   ├── packages/           # Smart contracts
│   ├── docs/              # Protocol documentation
│   ├── scripts/           # Deployment scripts
│   └── test/              # Protocol tests
├── clis/                   # Command-line tools
│   └── cxmpute-provider/   # Provider CLI tool
├── public/                 # Static assets
├── sst.config.ts          # Serverless Stack configuration
└── package.json           # Dependencies
```

## Key Technologies

### Core Stack
*   **Framework:** Next.js 15 with App Router, React 19
*   **Language:** TypeScript
*   **Infrastructure:** SST v3 (Serverless Stack)
*   **Cloud Provider:** Amazon Web Services (AWS)
    *   Compute: Lambda
    *   Database: DynamoDB
    *   Messaging: SQS, SNS
    *   API: API Gateway
    *   Email: SES

### Blockchain & DeFi
*   **Network:** Peaq EVM
*   **Smart Contracts:** Solidity 0.8.x
*   **Development:** Hardhat
*   **Oracles:** LayerZero + Chainlink (via Ethereum)
*   **Cross-chain:** LayerZero OFT standard

### Authentication & Security
*   **OpenAuth:** Email-based authentication
*   **JWT:** Token-based session management
*   **API Keys:** User-specific access control
*   **Role-based Access:** OpenZeppelin AccessControl

## Setup and Deployment

### Prerequisites
*   Node.js (LTS version recommended)
*   pnpm (Package manager)
*   AWS CLI configured with appropriate credentials
*   SST CLI installed globally (`npm install -g sst`)

### Installation
```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build

# Deploy to AWS
pnpm sst deploy --stage <stage_name>
```

### Environment Configuration

The platform uses SST secrets for configuration:
    ```bash
# Email service configuration
pnpm sst secrets set AuthEmailSender <domain>

# Additional secrets for AI services and provider management
# See sst.config.ts for complete secret configuration
```

### Unxversal Protocol Deployment

For DeFi protocols:
    ```bash
cd unxversal

# Install dependencies
npm install

# Deploy contracts to Peaq
npx hardhat deploy --network peaq

# Run tests
npx hardhat test
```

## API Overview

### AI/Compute Service APIs

*   **Authentication:** `/api/auth/*` (OpenAuth-based login)
*   **Chat Completions:** `POST /api/v1/chat/completions` (OpenAI-compatible)
*   **Text Embeddings:** `POST /api/v1/embeddings`
*   **Text-to-Speech:** `POST /api/v1/tts`
*   **Web Scraping:** `POST /api/v1/scrape`
*   **Multi-modal Vision:** `POST /api/v1/m/*` (detect, caption, point, query)
*   **Provider Management:** `/api/v1/providers/*`
*   **User Management:** `/api/user/*`
*   **Admin Functions:** `/api/admin/*`

### Service Gateway Flow

1. **Request Authentication:** Validate API key and check credits
2. **Provision Selection:** Choose healthy provider using randomized selection
3. **Health Check:** Verify provider endpoint is responsive  
4. **Request Forwarding:** Proxy request to selected provider
5. **Response Handling:** Stream or return response to client
6. **Usage Tracking:** Record metrics and reward provider

## Database Schema (DynamoDB)

### AI/Compute Platform Tables

*   **`UserTable`**: Platform users with API keys and credits
*   **`ProviderTable`**: Compute resource providers and earnings
*   **`ProvisionsTable`**: Individual compute provisions by providers
*   **`LLMProvisionPoolTable`**: Language model providers pool
*   **`EmbeddingsProvisionPoolTable`**: Embedding service providers
*   **`ScrapingProvisionPoolTable`**: Web scraping providers
*   **`TTSProvisionPoolTable`**: Text-to-speech providers
*   **`MetadataTable`**: Daily usage statistics per endpoint
*   **`ServiceMetadataTable`**: Service-specific usage tracking
*   **`NetworkStatsTable`**: Network-wide performance metrics

## Unxversal Protocol Details

### unxversal dex
*   **NFT Orders:** Every order is an ERC-721 token with mutable `amountRemaining`
*   **Gas Efficient:** ~95k for order creation, ~35k per fill
*   **Price-Time Priority:** Enforced by indexers and taker selection
*   **Permissionless:** Any ERC-20 pair, no factory required

### unxversal synth  
*   **USDC Collateral:** Simple accounting with USD-denominated backing
*   **LayerZero Oracles:** Chainlink prices relayed from Ethereum
*   **Synthetic Assets:** sBTC, sETH, sSOL, and more
*   **Risk Management:** Configurable collateral ratios and liquidation

### unxversal lend
*   **Interest-Bearing Tokens:** uUSDC, uWETH receipt tokens
*   **Cross-Protocol Composability:** Shared collateral with other protocols
*   **Dynamic Interest Rates:** Utilization-based curves
*   **Flash Loans:** Single-transaction borrowing

### unxversal perps
*   **Cross-Margin:** Unified account across all perpetual markets
*   **Up to 20x Leverage:** Risk-managed position limits
*   **Funding Rates:** Peer-to-peer hourly settlements
*   **Mark Price:** Oracle-based with DEX fallback

### unxversal DAO
*   **UNXV Token:** Governance and fee-sharing token
*   **veUNXV:** Vote-escrowed tokens for governance weight
*   **Gauge System:** Weekly emission allocation
*   **Timelock:** 48-hour execution delay for security

## Authentication Flow

1. User initiates login via email
2. OpenAuth sends verification code via SES
3. Upon verification, creates/updates Provider and User records
4. Returns JWT tokens as HTTP-only cookies
5. API requests authenticated via Bearer tokens or API keys

## Business Model

### AI/Compute Services
1. **Users** pay for AI services using credits/API keys
2. **Providers** offer compute resources and earn rewards
3. **Platform** takes a fee and provides infrastructure
4. **Scaling** through decentralized provider network

### Unxversal Protocols
1. **Trading Fees:** Collected on DEX trades and perpetual futures
2. **Interest Margins:** Spread between borrowing and lending rates
3. **Liquidation Fees:** Penalties on undercollateralized positions
4. **Governance:** UNXV token value capture and distribution

## Current Implementation Status

### ✅ Implemented
*   Complete AI/Compute services platform
*   Authentication and user management
*   Provider onboarding and health monitoring
*   Usage tracking and analytics
*   Reward distribution system
*   Admin dashboard functionality
*   Unxversal protocol smart contracts

### 🚧 In Development
*   Enhanced provider analytics
*   Cross-chain AI service routing
*   Advanced governance features
*   Mobile SDK support

## Security Considerations

### AI Platform
*   **API Key Management:** Secure generation and validation
*   **Provider Verification:** Health checks and reputation system
*   **Usage Monitoring:** Real-time abuse detection
*   **Credit Controls:** Overdraft protection and limits

### DeFi Protocols
*   **Smart Contract Audits:** Professional security reviews
*   **Oracle Security:** LayerZero message verification
*   **Liquidation Protection:** Robust risk parameters
*   **Governance Security:** Timelock and multisig controls

## Contributing

We welcome contributions to both the AI/Compute platform and Unxversal protocols:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests where applicable
5. Submit a pull request

For protocol-specific contributions, see the `unxversal/` directory for detailed documentation.

## License

MIT License - see LICENSE file for details.

## Links

*   **Website:** [cxmpute.cloud](https://cxmpute.cloud)
*   **Documentation:** [docs.cxmpute.cloud](https://docs.cxmpute.cloud)
*   **Discord:** [discord.gg/cxmpute](https://discord.gg/cxmpute)
*   **Twitter:** [@cxmpute](https://twitter.com/cxmpute)

---

*Cxmpute Core: Where AI meets DeFi in a unified, permissionless ecosystem.*