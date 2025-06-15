<!-- pricing.md -->

# Cxmpute Pricing & Rewards (v0.3 · June 2025)

## 1. Overview
Cxmpute matches AI workloads to a federation of community-run GPU nodes. The framework uses **simple per-token PAYG rates**, deep-discount **subscriptions**, and a **point-based provider reward system** that converts directly to CXPT.

---

## 2. Provider Rewards

### 2.1 Service Tiers

| Tier | VRAM Requirement | Typical Models | **Base Points / Req.** |
|------|-----------------|----------------|-----------------------|
| Tide Pool | ≤ 4 GB | Gemma-2B, Phi-3-mini | **1** |
| Blue Surge | 4–8 GB | Mistral-7B, Llama-3-8B | **3** |
| Open Ocean | 8–22 GB | Mixtral-8x7B, Llama-3-70B-Q4 | **7** |
| Mariana Depth | 22 GB + | Llama-3-70B-FP16, Claude-3-Sonnet | **15** |

**Specialised Services**

| Service | Base Pts | Notes |
|---------|---------|-------|
| Text-to-Speech | 2 pts / min | GPU-light, low-latency |
| Web Scraping | 0.5 pts / page | Network-bound |
| Embeddings | 1 pt / 1 K tokens | CPU-heavy |

### 2.2 Performance Multipliers

| Multiplier | Range | Thresholds |
|------------|-------|------------|
| Uptime | 0.80 – **1.30** | 99.0 % → 0.9 | 99.95 % → 1.30 |
| p50 Latency | 0.85 – 1.15 | > 800 ms → 0.85 | < 300 ms → 1.15 |
| Network Demand | 0.5 – 2.0 | Auto-scaled every hour |

**Monthly Points = Σ(base × uptime × latency × demand)**  
Provider CXPT payout = (provider_points / total_network_points) × monthly_provider_pool.

Testnet points **carry over** one-to-one into mainnet.

---

## 3. User Pricing

### 3.1 PAYG Rates (USD equivalent, billed in CXPT)

| Tier | **Price per 1 K Tokens**<br>(Input / Output) | Typical Market Floor* |
|------|---------------------------------------------|------------------------|
| Tide Pool | **$0.00015 / $0.00030** | $0.00005 / 0.00008 (Groq) |
| Blue Surge | **$0.00035 / $0.00070** | $0.00050 / 0.00150 (Gemini 1 Pro) |
| Open Ocean | **$0.00120 / $0.00240** | $0.00050 / 0.00150 (GPT-3.5-16K) |
| Mariana Depth | **$0.00350 / $0.00700** | $0.00500 / 0.01500 (GPT-4o) |

\* Cheapest public prices as of June 2025. Cxmpute aims to undercut by 10-70 % on most workloads.

### 3.2 Specialised Services

| Service | Unit | **Price** | Public Benchmarks |
|---------|------|-----------|-------------------|
| Text-to-Speech | minute | **$0.008** | AWS Neural $0.012 |
| Web Scraping | page | **$0.0006** | ScrapingBee $0.001 |
| Embeddings | 1 K tokens | **$0.00002** | OpenAI $0.00002 |

### 3.3 Subscription Plans

| Plan | **Monthly Fee** | Concurrency | RPM | **Token Bucket** | Eff. $/1 M |
|------|-----------------|-------------|-----|------------------|------------|
| Starter | **$15** | 1 | 40 | **20 M** | 0.75 |
| Pro | **$69** | 4 | 200 | **100 M** | 0.69 |
| Scale | **$249** | 15 | 1 000 | **600 M** | 0.41 |
| Enterprise | custom | 50 + | 5 000 + | 3 B + | negotiable |

**Benefits**

* 100 % token rollover for **90 days**.  
* “Priority Boost” weight during congestion (1.25× for Scale +).  
* **Spot Compute Opt-in** – up to **-70 %** rebate when latency can be flexible.  
* 10 % free overage buffer; beyond that, PAYG + 15 % surcharge.

---

## 4. Spot & Priority Mechanics
* Jobs flagged as *spot* may be pre-empted; they return a retry-after token.  
* Internal pricing oracle recomputes spot rebates every 5 minutes based on < 30 % utilisation.  
* Priority queue re-orders tasks by subscription plan → response-time SLA.

---

## 5. Testnet → Mainnet Timeline
| Step | Action |
|------|--------|
| **Now** | Free usage, points accrual |
| **July 15 2025** | Switch PAYG on; deploy new oracle |
| **Aug 1 2025** | Enable Spot queue, subscription checkout |
| **Sep 2025** | Launch staking & provider dashboard v2 |

---

## 6. Fair Usage & Anti-Abuse
* Layered rate-limits (IP, key, plan).  
* Early fraud signals (rapid key churn, abnormal latency patterns).  
* Automatic refund & ban pipeline for detected abuse.

---

## 7. Philosophy
1. **Win on cost**, not vendor lock-in.  
2. **Reward the best nodes**, not the biggest whales.  
3. **Keep it simple** – straight USD-pegged tables, paid in CXPT.

---

*All prices in USD for reference; invoices denominated in CXPT at oracle FX rate. Subject to change with 30-day notice.*
