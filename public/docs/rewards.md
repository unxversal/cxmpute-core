Earn rewards and grow the Cxmpute network through our comprehensive referral system! Both users and providers can earn through platform usage and by building referral networks.

## 🎉 System Overview

Cxmpute operates a **multi-tier rewards system** with:

✅ **Tiered Provider Earnings**: Rewards based on hardware capability and model complexity  
✅ **User Points**: Earn points for API usage and activity  
✅ **Multi-Level Referrals**: Earn from your referrals' referrals' referrals  
✅ **Automatic Distribution**: Rewards processed in real-time  
✅ **Direct Referral Bonuses**: Instant rewards when someone uses your code  
✅ **Performance Incentives**: Bonuses for fast, reliable service

## How Rewards Work

### For Providers

**💰 Tiered Compute Earnings**

Providers earn based on **hardware tier**, **model complexity**, and **actual work performed**:

| Tier | VRAM | Base Reward | Token Multiplier | Description |
|------|------|-------------|------------------|-------------|
| **Tide Pool** | ≤4GB | 0.005 | 0.00001 | Entry-level models |
| **Blue Surge** | 4-8GB | 0.015 | 0.00003 | Mid-tier workhorses |
| **Open Ocean** | 8-22GB | 0.035 | 0.00007 | High-end performance |
| **Mariana Depth** | 22GB+ | 0.075 | 0.00015 | Premium powerhouses |

**Service Multipliers:**
- **Chat Completions**: 1.0× (full rate)
- **TTS**: 0.6× (moderate compute)
- **Embeddings**: 0.3× (lighter workload)
- **Web Scraping**: 0.2× (network-bound)

**Performance Bonuses:**
- **Fast Response** (<2s): +10% bonus
- **Slow Response** (>10s): -10% penalty

**🎯 Referral Network Earnings**
- **Direct Bonus**: 50 points when someone uses your Provider ID as referral
- **Primary Level**: 10% of your direct referrals' compute earnings
- **Secondary Level**: 5% of your secondary referrals' compute earnings  
- **Tertiary Level**: 2.5% of your tertiary referrals' compute earnings

### For Users

**⚡ API Usage Points**
- Earn points for every API request you make
- Different endpoints have different point values
- Token-based bonuses for LLM endpoints

**🎯 Referral Network Earnings**
- **Direct Bonus**: 25 points when someone uses your User ID as referral
- **Primary Level**: 15% of your direct referrals' usage points
- **Secondary Level**: 8% of your secondary referrals' usage points
- **Tertiary Level**: 4% of your tertiary referrals' usage points

## Provider Earnings Examples

### Real Reward Calculations

**Example 1: 70B Model (Mariana Depth) - 1000 tokens**
```
Base Reward: 0.075 × 1.0 (chat) × 3.0 (complexity) = 0.225
Token Reward: 1000 × 0.00015 × 1.0 = 0.15
Total: 0.375 per request
```

**Example 2: 7B Model (Blue Surge) - 1000 tokens**
```
Base Reward: 0.015 × 1.0 (chat) × 1.0 (complexity) = 0.015
Token Reward: 1000 × 0.00003 × 1.0 = 0.03
Total: 0.045 per request
```

**Example 3: Embeddings (any tier) - 500 tokens**
```
Base Reward: 0.035 × 0.3 (embeddings) × 1.5 (complexity) = 0.01575
Token Reward: 500 × 0.00007 × 0.3 = 0.0105
Total: 0.02625 per request
```

### Model Complexity Tiers

| Model | Tier | Complexity | Typical Earnings |
|-------|------|------------|------------------|
| **Llama3-70B** | Mariana Depth | 3.0× | Highest |
| **Mixtral-8x7B** | Open Ocean | 2.5× | High |
| **Llama3-13B** | Open Ocean | 1.5× | Medium-High |
| **Llama3-8B** | Blue Surge | 1.0× | Medium |
| **Mistral-7B** | Blue Surge | 1.0× | Medium |
| **Phi-3-Mini** | Tide Pool | 0.5× | Light |
| **Gemma-2B** | Tide Pool | 0.3× | Minimal |

### Referral Earnings Impact

**If you refer a high-earning provider:**
- Provider earns 0.375 per request
- **You earn**: 0.0375 (10%) as primary referrer
- **Your referrer earns**: 0.01875 (5%) as secondary referrer
- **Their referrer earns**: 0.009375 (2.5%) as tertiary referrer

**Monthly scaling example:**
- Referred provider: 1000 requests/month × 0.375 = 375 total earnings
- **Your monthly bonus**: 37.5 from this one referral
- **With 5 similar referrals**: 187.5 monthly passive income

## User Points System

### API Usage Points

| Endpoint | Base Points | Token Bonus |
|----------|------------|-------------|
| `/chat/completions` | 1 point | +0.001 per token |
| `/embeddings` | 0.5 points | +0.0005 per token |
| `/scrape` | 0.2 points | - |
| `/tts` | 0.8 points | - |

**Example**: A chat completion with 1000 tokens = 1 + (1000 × 0.001) = 2 points

### Real-Time Earning

Points are awarded automatically with every API request:
1. You make an API call
2. Points calculated based on endpoint and usage
3. Points added to your account instantly
4. Referral bonuses distributed up the chain automatically

## Multi-Level Referral System

### How It Works

When you refer someone, you earn from their activity **and** from anyone they refer:

```
You (Level 0)
├── Direct Referral (Level 1) → You earn 10-15% of their earnings
    ├── Secondary Referral (Level 2) → You earn 5-8% of their earnings
        └── Tertiary Referral (Level 3) → You earn 2.5-4% of their earnings
```

### Automatic Processing

Every time someone earns rewards:
1. **Primary referrer** gets their percentage
2. **Secondary referrer** gets their percentage  
3. **Tertiary referrer** gets their percentage
4. **Original earner** keeps 100% of their earnings
5. All processed automatically in real-time

## Getting Started

### Step 1: Get Your Referral Code

**For Users:**
- Your referral code is your User ID
- Find it in your [Dashboard](https://cxmpute.cloud/dashboard) under "Referral Codes"
- Example: `usr_abc123...`

**For Providers:**
- Your referral code is your Provider ID  
- Find it in your [Provider Dashboard](https://cxmpute.cloud/dashboard) under "Referral Information"
- Example: `prov_xyz789...`

### Step 2: Share Your Code

**Direct Sharing:**
- Send your ID to friends and colleagues
- Include in community posts and tutorials
- Mention when helping others with Cxmpute

**Content Creation:**
- **Blog Posts**: Write tutorials showing Cxmpute APIs in action
- **Videos**: Create setup guides and earnings demonstrations
- **Social Media**: Share your experience with specific examples
- **Developer Content**: Help others solve problems with Cxmpute

### Step 3: Apply Referral Codes

If someone referred you:
1. Go to your dashboard
2. Find the "Enter Referral Code" section
3. Enter their User ID (for users) or Provider ID (for providers)
4. Click "Apply Referral"
5. They automatically get a direct referral bonus!

**⚠️ Important**: You can only set one referral relationship - choose wisely!

## Tracking Your Success

### Dashboard Analytics

**Users can track:**
- Total usage points earned
- Referral network size (direct, secondary, tertiary)
- Referral rewards by level
- Total earnings breakdown

**Providers can track:**
- Compute earnings from actual work
- Earnings breakdown by tier and model
- Referral network growth
- Referral rewards by level
- Combined earnings summary

### Real-Time Updates

- All rewards credited instantly
- Dashboard updates in real-time
- 30-day earning history maintained
- Referral network stats updated automatically

## Maximizing Your Earnings

### For Users

**🚀 High-Value Strategies:**
1. **Use More APIs**: Higher usage = more points = more value to referrers
2. **Refer Active Developers**: Target people who will actually use AI APIs
3. **Create Educational Content**: Tutorials featuring Cxmpute get shared more
4. **Build in Communities**: Engage in Discord, Stack Overflow, GitHub

**💡 Pro Tips:**
- Focus on `/chat/completions` for highest points per request
- Token-heavy usage maximizes your earning potential
- Quality referrals compound better than quantity

### For Providers

**🚀 High-Value Strategies:**
1. **Upgrade Hardware**: Higher tiers earn significantly more per request
2. **Maintain High Uptime**: More availability = more earnings = more value to referrers
3. **Optimize Performance**: Fast responses get 10% bonuses
4. **Refer Serious Providers**: Target people with good hardware and commitment
5. **Share Real Earnings**: Demonstrate actual profitability

**💡 Pro Tips:**
- **Mariana Depth providers** (22GB+) earn 5-15× more than Tide Pool
- Focus on chat completions for highest earning potential
- Fast hardware gets performance bonuses
- Provider referrals compound significantly due to higher earning potential

### Tier Upgrade Benefits

**Moving from Blue Surge (8GB) to Open Ocean (16GB):**
- Base reward: 0.015 → 0.035 (+133%)
- Token multiplier: 0.00003 → 0.00007 (+133%)
- **Result**: ~2.3× earnings increase

**Moving to Mariana Depth (22GB+):**
- Base reward: 0.035 → 0.075 (+114%)
- Token multiplier: 0.00007 → 0.00015 (+114%)
- **Result**: ~2.1× additional increase

## Best Practices

### Effective Referral Sharing

**Quality Over Quantity:**
- Target people who will genuinely benefit from Cxmpute
- Provide context about why it's valuable for them
- Follow up to help with onboarding

**Be Transparent:**
- Clearly mention you'll earn from referrals
- Explain how the system benefits everyone
- Share your own positive experience

**Build Relationships:**
- Focus on helping rather than just promoting
- Stay connected with your referrals
- Celebrate their successes

### Content Ideas

**📝 Educational Content:**
- "Building an AI app with Cxmpute APIs"
- "Cxmpute vs OpenAI: Cost and performance comparison"
- "How I earn $X per month with my gaming PC"
- "Provider tier comparison: Is upgrading worth it?"

**🎥 Video Content:**
- Provider setup walkthroughs by tier
- Real earnings demonstrations with calculations
- API integration tutorials
- Hardware optimization guides

**💬 Community Engagement:**
- Help troubleshoot issues in Discord
- Share usage examples and case studies
- Answer questions about the platform
- Compare earnings across different hardware setups

## Referral Network Examples

### Example 1: Active Developer Network

**You refer:** 5 active developers (each earning 100 points/month)  
**They refer:** 3 developers each (15 total, 50 points/month each)  
**They refer:** 2 developers each (30 total, 25 points/month each)

**Your Monthly Earnings:**
- Direct referrals: 15% × (5 × 100) = 75 points
- Secondary referrals: 8% × (15 × 50) = 60 points  
- Tertiary referrals: 4% × (30 × 25) = 30 points
- **Total**: 165 points/month passive income

### Example 2: High-End Provider Network

**You refer:** 3 Mariana Depth providers (1000 requests/month @ 0.375 each)  
**They refer:** 2 providers each (6 total, 500 requests/month @ 0.375)  
**They refer:** 1 provider each (6 total, 300 requests/month @ 0.375)

**Your Monthly Earnings:**
- Direct referrals: 10% × (3 × 375) = 112.5
- Secondary referrals: 5% × (6 × 187.5) = 56.25
- Tertiary referrals: 2.5% × (6 × 112.5) = 16.875
- **Total**: 185.625/month passive income

## Technical Details

### Reward Processing

All rewards are processed automatically using recursive referral chain lookups:

1. **Provider serves request** → Provider gets tiered reward based on model/hardware
2. **System finds referrer** → Primary referrer gets 10% bonus
3. **System finds referrer's referrer** → Secondary referrer gets 5% bonus
4. **System finds tertiary referrer** → Tertiary referrer gets 2.5% bonus

### Data Storage

- All rewards stored with 30-day rolling window
- Referral relationships are permanent once set
- Real-time calculations with efficient database queries
- Full audit trail of all reward distributions
- Performance metrics tracked for bonus calculations

## API Endpoints

### Get Your Referral Stats

**Users:**
```
GET /api/user/{userId}/referral-stats
```

**Providers:**
```
GET /api/providers/{providerId}/referral-stats
```

**Response includes:**
- Total earnings breakdown (usage vs referral rewards)
- Referral network size by level
- Reward history and trends
- Performance metrics
- Tier information (providers)

## Support & FAQs

### Common Questions

**Q: When do I receive referral rewards?**
A: Immediately! All rewards are processed in real-time as activity happens.

**Q: Can I change who referred me?**
A: No, referral relationships are permanent once set.

**Q: Is there a limit on referral earnings?**
A: No limits! The more active your network, the more you earn.

**Q: What if someone I referred stops using Cxmpute?**
A: You keep all previously earned rewards, but future earnings from them stop.

**Q: How do provider tiers affect referral earnings?**
A: Higher-tier providers earn more per request, so referring them generates more referral income for you.

**Q: Can I refer people outside my account type?**
A: Users can only refer users, providers can only refer providers.

**Q: How are percentages calculated?**
A: Percentages are based on the original earner's rewards, and everyone gets their full amount plus bonuses.

**Q: What's the best tier to target for referrals?**
A: Mariana Depth providers (22GB+) generate the highest referral income due to their premium earnings.

### Getting Help

- **Dashboard**: Check your detailed referral stats and earnings
- **Discord**: Get help from the community at [discord.gg/vE3xvFsZA8](https://discord.gg/vE3xvFsZA8)
- **Documentation**: Review our [provider guide](/docs/provider) for setup help

---

**Ready to build your earning network?** Get your referral code from the [Dashboard](https://cxmpute.cloud/dashboard) and start earning from your community today! 