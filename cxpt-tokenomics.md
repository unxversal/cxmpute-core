<!-- cxpt-tokenomics.md -->

# CXPT Tokenomics (v0.3 · June 2025)

## Overview
CXPT (Cxmpute Token) is the utility token powering the Cxmpute platform. It acts as the medium of exchange for compute purchases, the unit of provider rewards, and the sink for protocol fee burns. The design emphasizes **cost transparency for users** and **predictable upside for node operators**.

---

## Token Distribution
**Fixed Total Supply:** 1 000 000 000 CXPT  
No further minting is possible.

| Category | % of Supply | Amount (CXPT) | Vesting / Control |
|----------|-------------|---------------|-------------------|
| Founding Team | 30 % | 300 000 000 | Time-locked multisig (4-year linear) |
| Community Incentives | 48 % | 480 000 000 | RewardDistributor (providers & airdrops) |
| Treasury | 15 % | 150 000 000 | Ops multisig (growth & grants) |
| Liquidity & Market Making | 7 % | 70 000 000 | AMM & CEX liquidity programs |

> **Burn Mechanism** – 5 % of every user payment (PAYG or subscription) is automatically burned, creating ongoing deflation as usage grows.

---

## Token Utility
1. **Compute Payment** – All PAYG calls and subscription fees are settled in CXPT (fiat on-ramp available).  
2. **Provider Rewards** – Node operators receive CXPT based on a points formula (see *Reward Distribution*).  
3. **Governance (TBA)** – Post-v1, staked CXPT will secure protocol parameter votes.

---

## Pricing Models
### A. Subscription
* Pre-paid monthly CXPT fee → large token bucket at a **15–60 % discount** to PAYG.
* Unlimited rollover 50% of unused tokens for **30 days**.
* Priority queue weight + 12-month price lock at no extra cost.

### B. Pay-As-You-Go (PAYG)
* Billed per 1 000 tokens processed, priced dynamically per tier.
* **Spot Compute** option gives up to **-70 %** rebate when network utilisation < 30 %.  
* Automatic scaling surcharge (≤ +15 %) when utilisation > 90 %.

---

## Credit System
* **Vault Contract** receives all user payments.  
* Every 24 h the vault:
  1. Burns 5 % of inflow.  
  2. Allocates remaining CXPT between **Provider Rewards (default 70 %)** and **Protocol Revenue (30 %)**.  
  3. Streams provider share to RewardDistributor for pro-rata payout.

---

## Reward Distribution
### 1. Base Points (per successful request)

| Tier | VRAM | Base Pts |
|------|------|----------|
| Tide Pool | ≤ 4 GB | 1 |
| Blue Surge | 4 – 8 GB | 3 |
| Open Ocean | 8 – 22 GB | 7 |
| Mariana Depth | 22 GB + | 15 |

Specialised services: TTS = 2 pts / min, Scrape = 0.5 pts, Embedding = 1 pt.

### 2. Performance Multipliers

| Metric | Range | Notes |
|--------|-------|-------|
| Uptime | 0.80 – **1.30** | ≥ 99.95 % earns 1.30× |
| p50 Latency | 0.85 – 1.15 | < 300 ms earns 1.15× |
| Network Demand | 0.5 – 2.0 | Auto-adjusted hourly |

**Monthly Reward = Σ(base × uptime × latency × demand).**

---

## Compute Service Pricing (PAYG)

| Tier | **Price per 1 K Tokens**<br>(Input / Output) |
|------|---------------------------------------------|
| Tide Pool | **$0.00015 / $0.00030** |
| Blue Surge | **$0.00035 / $0.00070** |
| Open Ocean | **$0.00120 / $0.00240** |
| Mariana Depth | **$0.00350 / $0.00700** |

### Specialised

| Service | Unit | Price |
|---------|------|-------|
| Text-to-Speech | min | **$0.008** |
| Web Scraping | page | **$0.0006** |
| Embeddings | 1 K tokens | **$0.00002** |

---

## Subscription Plans

| Plan | Monthly Fee | Concurrency | RPM | Token Bucket | Effective $ / 1 M |
|------|-------------|-------------|-----|--------------|--------------------|
| **Starter** | **$15** | 1 | 40 | **20 M** | $0.75 |
| **Pro** | **$69** | 4 | 200 | **100 M** | $0.69 |
| **Scale** | **$249** | 15 | 1 000 | **600 M** | $0.41 |
| **Enterprise** | custom | 50 + | 5 000 + | 3 B + | negotiable |

All buckets rollover 100 % for 90 days.

---

## Phased Implementation
| Phase | Target Date | Key Features |
|-------|-------------|--------------|
| **1 – Testnet** | live | Free usage, points accrual |
| **2 – Mainnet Launch** | Jul-2025 | CXPT TGE, PAYG live |
| **3 – Full Utility** | Sep-2025 | Subscriptions, Spot Compute, staking roadmap |

---

## Risks & Mitigations
* **Market Volatility** – burn + capped supply offset downward pressure.  
* **Liquidity** – 7 % allocation managed across AMMs & CEX.  
* **Smart-Contract** – audits before Phase 2; on-chain bug-bounty.  

---

## Monitoring & Reporting
* **Real-time dashboard** – supply, burns, rewards, utilisation.  
* **Monthly reports** – token flows & treasury.  
* **Quarterly audits** – external smart-contract & finance review.
