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
- **Infrastructure**: Fully serverless AWS stack (Lambda, API Gateway, DynamoDB, SES, S3, SNS, SQS)

## Core Systems

### 1. Authentication & User Management
- **Email-based authentication** via OpenAuth with code verification
- **Multi-tenant architecture** with Users, Providers, and API key management
- **Role-based access** with admin controls

### 2. Provider Network
- **Provider onboarding** system for compute resource providers
- **Provision management** with health checking and load balancing
- **Reward system** for providers based on usage
- **Multiple service types** supported (LLM, Embeddings, TTS, Scraping, etc.)

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
│   │   ├── user/            # User profile pages
│   │   └── ...              # Other app pages
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
├── public/                 # Static assets
├── sst.config.ts          # Serverless Stack configuration
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript configuration
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

## API Architecture

### Authentication Flow
1. User requests login via email
2. OpenAuth sends verification code via SES
3. Upon verification, creates/updates Provider, User records
4. Returns JWT tokens as HTTP-only cookies
5. API requests authenticated via Bearer tokens or API keys

### Service Gateway Flow
1. **Request Authentication**: Validate API key and check credits
2. **Provision Selection**: Choose healthy provider using randomized selection
3. **Health Check**: Verify provider endpoint is responsive
4. **Request Forwarding**: Proxy request to selected provider
5. **Response Handling**: Stream or return response to client
6. **Usage Tracking**: Record metrics and reward provider

### Provider Management
- **Health Monitoring**: Continuous health checks on provider endpoints
- **Load Balancing**: Randomized selection with fallback strategies
- **Reward Distribution**: Automatic rewards based on successful API calls
- **Provision Lifecycle**: Automatic removal of unhealthy providers

## Key Technologies

### Core Stack
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **SST v3**: Serverless infrastructure as code
- **AWS Services**: Lambda, DynamoDB, API Gateway, SES, S3

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

### Installation
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

### Environment Configuration
The platform uses SST secrets for sensitive configuration:
- Email service configuration (SES)
- Database access (DynamoDB)
- Various API keys and service endpoints

## Current Status & Implementation Notes

### What's Implemented
- ✅ Complete authentication system with email verification
- ✅ Provider onboarding and management
- ✅ AI service gateways (chat, embeddings, TTS, scraping)
- ✅ Usage tracking and analytics
- ✅ Health monitoring and load balancing
- ✅ Reward system for providers
- ✅ Admin dashboard functionality

### What's Not Present
- ❌ DEX (Decentralized Exchange) functionality (removed from codebase)
- ❌ Smart contracts and blockchain integration
- ❌ Trading/financial features
- ❌ WebSocket real-time updates (DEX-related)
- ❌ Market data and order management

### Code Quality Notes
- Well-structured TypeScript with comprehensive interfaces
- Proper error handling and logging
- AWS best practices for serverless architecture
- Modular design with clear separation of concerns

## Business Model

The platform operates as a marketplace:
1. **Users** pay for AI services using credits/API keys
2. **Providers** offer compute resources and earn rewards
3. **Platform** takes a cut and provides infrastructure
4. **Scaling** through decentralized provider network

## Future Considerations

Based on the codebase structure, potential enhancements could include:
- Real-time WebSocket connections for job status updates
- More sophisticated load balancing algorithms
- Enhanced provider analytics and optimization
- Additional AI service types and modalities
- Mobile app support through API
- Advanced user dashboard features

---

*This readme reflects the current state of the codebase as of the exploration date. The main README.md contains historical information about DEX functionality that has been removed.* 