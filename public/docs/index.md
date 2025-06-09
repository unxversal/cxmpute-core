Welcome to the Cxmpute documentation! Cxmpute is a distributed AI/Compute services platform that connects users who need AI services with providers who offer compute resources, creating a global network of AI compute power.

## Quick Start

### For Users
- **Get Started**: [Create an account](https://cxmpute.cloud/dashboard) and start using AI services in minutes
- **API Reference**: [Complete API documentation](/docs/user) for all endpoints
- **Service Guides**: Learn about specific services like [chat](/docs/text-to-text), [embeddings](/docs/embeddings), [TTS](/docs/text-to-speech), and [scraping](/docs/scraping)

### For Providers
- **Become a Provider**: [Download the CLI](https://github.com/unxversal/cxmpute-core/releases) and start earning rewards
- **Provider Guide**: [Complete setup instructions](/docs/provider) and earning tips
- **Rewards System**: Learn about [earnings and referrals](/docs/rewards)

## What is Cxmpute?

Cxmpute provides inference and related services powered by a global network of nodes run by providers. We offer:

- **LLM Inference**: OpenAI-compatible chat completions with dozens of models
- **Text Embeddings**: High-quality vector embeddings for your applications
- **Text-to-Speech**: Natural voice synthesis with multiple voice models
- **Web Scraping**: Reliable content extraction and markdown conversion
- **Tool Use & JSON**: Structured outputs and function calling capabilities

[Learn more about Cxmpute →](/docs/about)

## Service Documentation

### AI Services
- [**Text-to-Text (LLM)**](/docs/text-to-text) - Chat completions and text generation
- [**Embeddings**](/docs/embeddings) - Vector embeddings for semantic search
- [**Text-to-Speech**](/docs/text-to-speech) - Audio generation from text
- [**Web Scraping**](/docs/scraping) - Content extraction and processing
- [**Tool Use & JSON**](/docs/tool-use-json) - Structured outputs and function calling
- [**Advanced LLMs**](/docs/advanced-llms) - Advanced features for large language models

### Platform
- [**User Guide**](/docs/user) - Complete API reference and getting started
- [**Provider Guide**](/docs/provider) - How to become a compute provider
- [**Rewards System**](/docs/rewards) - Earning rewards and referral program
- [**About Cxmpute**](/docs/about) - Platform overview and architecture

## Key Features

### 🚀 **Easy to Use**
- OpenAI-compatible APIs - just change the base URL
- Simple authentication with API keys
- Comprehensive documentation and examples

### 🌍 **Global Network**
- Distributed provider network for low latency
- Automatic load balancing and health monitoring
- Geographic distribution for optimal performance

### 💰 **Cost-Effective**
- Currently free during testnet phase
- Future pricing to be announced (TBA)
- Competitive rates through decentralized provider network

### 🔒 **Secure & Reliable**
- Enterprise-grade security and privacy
- 99.5%+ uptime with automatic failover
- Provider verification and health monitoring

## Getting Started

### 1. Create an Account
Visit the [Cxmpute Dashboard](https://cxmpute.cloud/dashboard) to create your account and get your API key.

### 2. Make Your First Request
```bash
curl -X POST https://cxmpute.cloud/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "Hello, world!"}]
  }'
```

### 3. Explore Services
Try different AI services:
- [Chat completions](/docs/text-to-text) for conversations and text generation
- [Embeddings](/docs/embeddings) for semantic search and RAG
- [Text-to-speech](/docs/text-to-speech) for voice applications
- [Web scraping](/docs/scraping) for data collection

## Testnet Phase

🎉 **All services are currently free!** During our testnet phase, you can use all Cxmpute services without charges. Pricing for the mainnet launch is **to be determined (TBD)**.

Join our [Discord community](https://discord.gg/vE3xvFsZA8) to stay updated on pricing announcements, give feedback, and connect with other developers building with Cxmpute.

[Learn more about rewards →](/docs/rewards)

## Community & Support

- **Discord**: Join our [community](https://discord.gg/vE3xvFsZA8) for support and latest news
- **GitHub**: Check out our [open source code](https://github.com/unxversal/cxmpute-core)
- **Email**: Contact us at support@cxmpute.cloud

## Model Catalog

Explore our full range of available models at [cxmpute.cloud/models](https://cxmpute.cloud/models).

---

*Ready to get started? [Create your account](https://cxmpute.cloud/dashboard) or [become a provider](https://github.com/unxversal/cxmpute-core/releases) today!* 