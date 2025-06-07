# Cursor README: Cxmpute Core Platform

## Project Overview

**Cxmpute Core** is a distributed AI/Compute services platform that acts as a centralized gateway and broker for various AI services. The platform connects users who need AI services with providers who offer compute resources, creating a decentralized network of AI service providers.

**Current Focus**: This codebase implements the AI/Compute services platform. Note that while the main README.md describes a DEX (Decentralized Exchange) system, that functionality has been removed from the current codebase, and the infrastructure is focused entirely on AI services.

## Architecture Overview

The platform follows a serverless, event-driven architecture built on AWS:

- **Frontend**: Next.js 15 with App Router
- **Backend**: AWS Lambda functions via SST (Serverless Stack)
- **Database**: DynamoDB for all data persistence
- **Authentication**: OpenAuth with email-based login
- **Infrastructure**: Fully serverless AWS stack (Lambda, DynamoDB, SQS, SNS, API Gateway, SES)
- **Provider Network**: Distributed CLI-based providers offering compute resources

## Core Systems

### 1. Authentication & User Management
- **Email-based authentication** via OpenAuth with code verification
- **Multi-tenant architecture** with Users, Providers, and API key management
- **Role-based access** with admin controls

### 2. Provider Network & CLI System
- **Provider CLI Tool** (`clis/cxmpute-provider`) for compute resource providers
- **Hardware diagnostics** and capability assessment
- **Automatic service orchestration** based on provider capabilities
- **Local AI service hosting** with public tunnel exposure
- **Health monitoring** and load balancing
- **Reward system** for providers based on usage

### 3. AI Service Gateways
- **OpenAI-compatible chat completions** (`/api/v1/chat/completions`)
- **Text embeddings** (`/api/v1/embeddings`)
- **Text-to-Speech** (`/api/v1/tts`)
- **Web scraping** (`/api/v1/scrape`)
- **Multi-modal vision services** (`/api/v1/m/*`)

### 4. Usage Tracking & Analytics
- **Real-time usage metrics** and provider performance tracking
- **Service metadata** collection for optimization
- **Network statistics** for capacity planning

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
├── clis/                   # Command-line tools
│   └── cxmpute-provider/   # Provider CLI tool
│       ├── source/
│       │   ├── app.tsx     # Main CLI application (React Ink)
│       │   ├── components/ # CLI UI components
│       │   ├── lib/       # Core functionality
│       │   │   ├── api.ts     # Platform API integration
│       │   │   ├── interfaces.ts # Data structures
│       │   │   └── localStorage.ts # Local data management
│       │   ├── scripts/   # Core provider functionality
│       │   │   ├── manageNode.ts   # Service lifecycle
│       │   │   └── runDiagnostics.ts # Hardware analysis
│       │   └── server/    # Local AI service server
│       │       ├── index.ts       # Express server setup
│       │       └── api/          # Local service endpoints
│       │           ├── chat.ts       # Ollama chat completions
│       │           ├── embeddings.ts # Embedding services
│       │           ├── tts.ts        # Text-to-speech
│       │           └── scrape.ts     # Web scraping
│       └── package.json   # CLI dependencies
├── public/                 # Static assets
├── sst.config.ts          # Serverless Stack configuration
└── package.json           # Main dependencies
```

## Key Data Models

### User System
- **ProviderTable**: Compute resource providers
- **UserTable**: Platform users with API keys
- **ProvisionsTable**: Individual compute provisions

### Service Provision Pools
- **LLMProvisionPoolTable**: Language model providers
- **EmbeddingsProvisionPoolTable**: Embedding service providers
- **ScrapingProvisionPoolTable**: Web scraping providers
- **TTSProvisionPoolTable**: Text-to-speech providers

### Analytics & Metadata
- **MetadataTable**: Daily usage statistics per endpoint
- **ServiceMetadataTable**: Service-specific usage tracking
- **NetworkStatsTable**: Network-wide performance metrics

## Provider CLI System Deep Dive

The **Provider CLI** (`clis/cxmpute-provider`) is a sophisticated React Ink-based command-line application that transforms any computer into a Cxmpute provider node.

### CLI Architecture & Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Provider CLI   │    │  Cxmpute Core    │    │  End Users      │
│                 │    │  (AWS/Platform)  │    │                 │
│  1. Diagnostics │◄──►│                  │◄──►│ API Requests    │
│  2. Registration│    │  Load Balancer   │    │                 │
│  3. Local Server│    │  Health Monitor  │    │                 │
│  4. Tunneling   │    │  Usage Tracking  │    │                 │
│  5. Monitoring  │    │  Reward System   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 1. Hardware Diagnostics (`runDiagnostics.ts`)

The CLI automatically analyzes provider hardware across platforms:

**Collected Metrics:**
- **CPU**: Model, cores, threads, architecture
- **Memory**: Total, used, free RAM
- **GPU**: VRAM, type (integrated/dedicated), CUDA support
- **Storage**: Available disk space
- **OS**: Platform, version, architecture

**Platform-Specific Detection:**
- **macOS**: Uses `system_profiler`, `sysctl`, `sw_vers`
- **Linux**: Uses `/proc/meminfo`, `nvidia-smi`, `lspci`
- **Windows**: Uses PowerShell CIM instances, WMI queries

**Provider Tiers Based on VRAM:**
- Basic (Tier 0): <1GB VRAM
- Tide Pool (Tier 1): 1-4GB VRAM
- Blue Surf (Tier 2): 4-8GB VRAM
- Open Ocean (Tier 3): 8-22GB VRAM
- Mariana Depth (Tier 4): 22GB+ VRAM

### 2. Provider Registration & Orchestration

**Registration Flow:**
1. CLI runs diagnostics and collects provider details
2. Calls `/api/v1/providers/new` with device capabilities
3. Platform assigns `providerId`, `deviceId`, and `providerAk`
4. Provider is added to appropriate provision pools

**Service Orchestration:**
1. CLI calls `/api/v1/providers/start` with capabilities
2. Platform orchestrator responds with required services list
3. CLI starts only the services assigned by the platform
4. Services are added to provision pools for load balancing

### 3. Local AI Service Server

The CLI runs a full-featured Express server providing AI services:

**Core Endpoints:**
- `GET /` - Health check and status
- `GET /heartbeat` - Platform health monitoring
- `POST /api/v1/chat/completions` - OpenAI-compatible LLM API
- `POST /api/v1/embeddings` - Text embedding generation
- `POST /api/v1/tts` - Text-to-speech synthesis
- `POST /api/v1/scrape` - Web scraping services

**Ollama Integration:**
- Automatic model pulling based on platform assignments
- Support for both chat and embedding models
- Streaming response support for chat completions
- Model lifecycle management (pull on start, cleanup on stop)

**Service Features:**
- **Chat Completions**: Full OpenAI API compatibility with Ollama backend
- **Embeddings**: Configurable model selection and batch processing
- **TTS**: Multiple voice models with Kokoro integration
- **Scraping**: Markdown conversion and content extraction

### 4. Tunneling & Public Access

**Tunnelmole Integration:**
- Automatically creates public HTTPS tunnel to local server
- Provides globally accessible endpoint for platform routing
- Handles SSL termination and connection management
- Returns public URL to platform for provision pool registration

### 5. Platform Integration Points

**API Endpoints Used by CLI:**
- `POST /api/v1/providers/new` - Initial provider registration
- `POST /api/v1/providers/start` - Request service assignments
- `POST /api/v1/providers/start/callback` - Confirm service startup
- `POST /api/v1/providers/end` - Notify service shutdown
- `GET /api/providers/{providerId}/earnings` - Fetch earnings data

**Health Monitoring:**
- Platform continuously monitors `/heartbeat` endpoint
- Automatic removal from pools if provider becomes unhealthy
- Graceful failover to other providers in the same service pool

### 6. Provider Dashboard & Monitoring

**Real-time Stats:**
- Earnings today and total lifetime
- Service status and uptime
- Hardware utilization metrics
- Network connection status

**React Ink Components:**
- `Setup`: Initial provider configuration wizard
- `Dashboard`: Live monitoring and status display
- `Splash`: Loading screens with progress indicators

## API Architecture

### Authentication Flow
1. User requests login via email
2. OpenAuth sends verification code via SES
3. Upon verification, creates/updates Provider, User records
4. Returns JWT tokens as HTTP-only cookies
5. API requests authenticated via Bearer tokens or API keys

### Service Gateway Flow
1. **Request Authentication**: Validate API key and check credits
2. **Provision Selection**: Choose healthy provider using randomized selection from pools
3. **Health Check**: Verify provider endpoint is responsive (`/heartbeat`)
4. **Request Forwarding**: Proxy request to selected provider's public tunnel
5. **Response Handling**: Stream or return response to client
6. **Usage Tracking**: Record metrics and reward provider

### Provider Management Flow
1. **Registration**: CLI registers with platform providing hardware diagnostics
2. **Orchestration**: Platform assigns services based on capabilities and demand
3. **Service Startup**: CLI starts local server with assigned services
4. **Pool Registration**: Provider added to relevant provision pools
5. **Health Monitoring**: Continuous monitoring and automatic failover
6. **Reward Distribution**: Real-time earning calculation based on usage

## Key Technologies

### Core Stack
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **SST v3**: Serverless infrastructure as code
- **AWS Services**: Lambda, DynamoDB, API Gateway, SES, S3

### Provider CLI Stack
- **React Ink**: Terminal UI framework
- **Express**: Local HTTP server
- **Ollama**: Local LLM inference engine
- **Tunnelmole**: Public tunnel creation
- **Kokoro**: Text-to-speech synthesis

### Authentication & Security
- **OpenAuth**: Email-based authentication
- **JWT**: Token-based session management
- **API Keys**: User-specific access control

### AI/ML Integration
- **OpenAI Compatible**: Chat completions API compatibility
- **Multi-modal Support**: Text, image, audio processing
- **Provider Agnostic**: Works with any compatible AI service

## Development Setup

### Prerequisites
- Node.js (LTS version)
- pnpm package manager
- AWS CLI configured
- SST CLI installed globally

### Main Platform Setup
```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build

# Deploy to AWS
pnpm sst deploy --stage dev
```

### Provider CLI Setup
```bash
# Navigate to CLI directory
cd clis/cxmpute-provider

# Install dependencies
pnpm install

# Build CLI
pnpm build

# Run provider CLI
node dist/cli.js
```

### Environment Configuration
The platform uses SST secrets for sensitive configuration:
- Email service configuration (SES)
- Database access (DynamoDB)
- Various API keys and service endpoints

## Current Status & Implementation Notes

### What's Implemented
- ✅ Complete authentication system with email verification
- ✅ Provider onboarding and management
- ✅ Sophisticated provider CLI with hardware diagnostics
- ✅ AI service gateways (chat, embeddings, TTS, scraping)
- ✅ Usage tracking and analytics
- ✅ Health monitoring and load balancing
- ✅ Reward system for providers
- ✅ Admin dashboard functionality
- ✅ Real-time provision pool management
- ✅ OpenAI-compatible API endpoints
- ✅ Multi-platform provider support (macOS, Linux, Windows)

### What's Not Present
- ❌ DEX (Decentralized Exchange) functionality (removed from codebase)
- ❌ Smart contracts and blockchain integration
- ❌ Trading/financial features
- ❌ WebSocket real-time updates (DEX-related)
- ❌ Market data and order management

### Provider CLI Features
- ✅ Cross-platform hardware diagnostics
- ✅ Automatic Ollama model management
- ✅ Public tunnel creation via Tunnelmole
- ✅ React Ink-based terminal UI
- ✅ Real-time earnings and status monitoring
- ✅ Graceful service lifecycle management
- ✅ Multiple AI service types (LLM, embeddings, TTS, scraping)
- ✅ Platform integration with automatic health monitoring

### Code Quality Notes
- Well-structured TypeScript with comprehensive interfaces
- Proper error handling and logging
- AWS best practices for serverless architecture
- Modular design with clear separation of concerns
- Sophisticated CLI with professional UX patterns
- Cross-platform compatibility with robust diagnostics

## Business Model

The platform operates as a marketplace:
1. **Users** pay for AI services using credits/API keys
2. **Providers** offer compute resources via CLI and earn rewards
3. **Platform** takes a cut and provides infrastructure, orchestration, monitoring
4. **Scaling** through decentralized provider network with automatic load balancing

## Provider Economics
- **Automatic Earnings**: Providers earn based on actual API usage
- **Tier-Based Allocation**: Higher-tier hardware gets priority allocation
- **Health-Based Rewards**: Reliable providers get more traffic
- **Geographic Distribution**: Global provider network for low latency

## Future Considerations

Based on the codebase structure, potential enhancements could include:
- Real-time WebSocket connections for job status updates
- More sophisticated load balancing algorithms (geographic, performance-based)
- Enhanced provider analytics and optimization tools
- Additional AI service types and modalities
- Mobile app support through API
- Advanced user dashboard features
- Cross-chain integration for provider rewards
- Federated learning capabilities across provider network

## Testing the Provider CLI

To test the provider system:

1. **Setup Provider CLI**:
   ```bash
   cd clis/cxmpute-provider
   pnpm install
   pnpm build
   ```

2. **Run Provider**:
   ```bash
   node dist/cli.js
   ```

3. **Provider Flow**:
   - CLI runs hardware diagnostics
   - Prompts for provider registration details
   - Registers with platform
   - Starts local AI services
   - Creates public tunnel
   - Reports to platform orchestrator
   - Begins serving requests

4. **Test API Integration**:
   - Use platform API keys to make requests
   - Verify requests are routed to your provider
   - Monitor earnings in provider dashboard

---

*This readme reflects the current state of the codebase as of the exploration date. The main README.md contains historical information about DEX functionality that has been removed.* 