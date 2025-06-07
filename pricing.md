# CXmpute Pricing & Rewards

## Overview

CXmpute operates a two-sided marketplace connecting AI service users with compute providers. Our pricing model balances competitive user rates with attractive provider rewards through a sophisticated point-based system.

## Provider Rewards System

### Service Tiers

Providers are classified into tiers based on the computational requirements of the services they offer:

| Tier | VRAM Requirement | Example Models | Base Points/Request | Description |
|------|-----------------|----------------|-------------------|-------------|
| **Tide Pool** | ≤ 4 GB | Gemma-2B, DistilBERT, Phi-3-mini | 1 pt | Entry-level models with low resource requirements |
| **Blue Surge** | 4 - 8 GB | Mistral-7B-Instruct, Llama-3-8B | 3 pts | Sweet spot for general chat and most use cases |
| **Open Ocean** | 8 - 22 GB | Mixtral-8x7B, Llama-3-70B-Q4 | 7 pts | High-performance models requiring significant resources |
| **Mariana Depth** | 22 GB+ | Llama-3-70B-FP16, Claude-sized models | 15 pts | Premium tier for largest, most capable models |

### Specialized Services

| Service | Base Points | Notes |
|---------|-------------|-------|
| **Text-to-Speech** | 2 pts | GPU-light but latency-sensitive |
| **Web Scraping** | 0.5 pts | Network-bound, good for idle capacity |
| **Embeddings** | 1 pt | CPU-intensive, highly parallelizable |

### Performance Multipliers

Provider rewards are adjusted based on service quality metrics:

| Multiplier Type | Range | Description |
|----------------|-------|-------------|
| **Uptime & Reliability** | 0.8x - 1.2x | Consistent availability rewarded |
| **Response Latency** | 0.9x - 1.1x | Fast responses earn premium |
| **Network Demand** | 0.5x - 2.0x | Surge pricing during high congestion |

**Total Monthly Points Formula:**
```
Σ(base_points × uptime_multiplier × latency_multiplier × demand_multiplier)
```

### Reward Distribution

- Points accumulate throughout the month for each successful request (HTTP 200 response)
- Revenue is distributed pro-rata based on each provider's share of total network points
- Testnet points carry over to mainnet launch
- Revenue split between protocol and providers (allocation TBD)

## User Pricing

### Pay-As-You-Go Rates

Competitive per-token pricing across all service tiers:

| Tier | Price per 1K Tokens (Input/Output) | Market Comparison¹ |
|------|-----------------------------------|-------------------|
| **Tide Pool** | $0.0002 / $0.0004 | 60-80% of market rates |
| **Blue Surge** | $0.0005 / $0.0010 | 70-85% of market rates |
| **Open Ocean** | $0.0015 / $0.0030 | 75-85% of market rates |
| **Mariana Depth** | $0.0040 / $0.0080 | 70-80% of market rates |

¹ *Compared to OpenRouter, Together AI, and Replicate pricing*

### Subscription Plans

Hybrid model combining rate limits with monthly token allowances:

| Plan | Monthly Fee | Max Concurrent | Rate Limit (RPM) | Monthly Tokens | Best For |
|------|-------------|----------------|------------------|----------------|----------|
| **Starter** | $19 | 1 request | 20 RPM | 2M tokens | Hobby projects, learning |
| **Professional** | $79 | 3 requests | 100 RPM | 8M tokens | Small applications, prototypes |
| **Scale** | $299 | 8 requests | 500 RPM | 40M tokens | Production applications |
| **Enterprise** | Custom | 20+ requests | 2000+ RPM | 200M+ tokens | Large-scale deployments |

### Subscription Benefits

- **Token Rollover**: Unused tokens carry forward one month (up to 50% of plan limit)
- **Priority Access**: Guaranteed capacity during high-demand periods  
- **Rate Protection**: Locked pricing for 12-month commitments
- **Overage Grace**: 10% monthly buffer before overage charges apply

### Overage Handling

When users exceed their plan limits:

1. **RPM Limits**: Requests queued with priority given to subscribers
2. **Token Limits**: Switch to pay-as-you-go rates with 15% surcharge
3. **Billing**: Overage charges appear on next month's invoice
4. **Upgrade Prompts**: Automatic suggestions for plan upgrades

### Specialized Service Pricing

| Service | Unit | Price | Notes |
|---------|------|-------|-------|
| **Text-to-Speech** | Per minute of audio | $0.015 | High-quality neural voices |
| **Web Scraping** | Per page scraped | $0.001 | Includes parsing and cleaning |
| **Embeddings** | Per 1K tokens | $0.0001 | Bulk discounts available |

## Testnet Phase

**Current Status**: All services are FREE during testnet phase

- Users can test all features without payment
- Providers earn points that carry over to mainnet
- Usage metrics are tracked for billing system validation
- Admin controls allow instant switch to paid pricing

## Mainnet Transition

**Activation Process**:
1. Admin updates pricing configuration 
2. Payment processing (Stripe/Coinbase) integration activated
3. User accounts automatically transition with notification
4. Accumulated testnet points convert to mainnet rewards

## Fair Usage Policy

### Anti-Abuse Measures
- Rate limiting prevents system overload
- Request validation ensures legitimate usage
- Quality thresholds maintain network health
- Automated fraud detection protects all users

### Network Health
- Dynamic pricing balances supply and demand
- Provider incentives ensure capacity availability  
- Quality metrics maintain service standards
- Transparent billing builds user trust

## Pricing Philosophy

Our pricing strategy prioritizes:

1. **Accessibility**: Competitive rates for all user segments
2. **Sustainability**: Fair provider compensation ensures network growth
3. **Transparency**: Clear, predictable pricing without hidden fees
4. **Flexibility**: Multiple pricing options suit different use cases
5. **Growth**: Aggressive pricing during early adoption phase

---

*Pricing subject to change. Enterprise customers contact sales for custom arrangements. All prices in USD.* 