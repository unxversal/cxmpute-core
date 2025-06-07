# Rewards & Referral System

## Overview

The CXmpute platform features a comprehensive rewards and referral system that incentivizes both providers and users through a point-based reward structure. The system supports:

- **Provider Rewards**: Points based on service tier (1/3/7/15 system) with multipliers
- **User Points**: Activity-based points separate from provider rewards  
- **Referral Program**: 3-level referral chains with percentage-based bonuses
- **Streak Rewards**: Uptime bonuses for providers, usage bonuses for users
- **Testnet/Mainnet**: Free operation during testnet, credit-based billing in mainnet

## Database Tables

### Core Tables
- `PricingConfigTable`: Admin-configurable pricing for all services
- `UserCreditsTable`: User credit balances and spending history
- `ProviderRewardsTable`: Monthly provider point accumulation
- `UserPointsTable`: Monthly user point accumulation
- `ReferralCodesTable`: Unique referral codes per user/provider
- `ReferralRelationshipsTable`: Referral chain tracking
- `StreakTrackingTable`: Uptime and usage streak monitoring
- `UsageTrackingTable`: Detailed request logging and analytics

## Service Tiers & Points

### Provider Points (1/3/7/15 System)
| Tier | VRAM | Base Points | Examples |
|------|------|-------------|----------|
| Tide Pool | ≤ 4 GB | 1 | Gemma-2B, DistilBERT |
| Blue Surge | 4-8 GB | 3 | Mistral-7B, Llama-3-8B |
| Open Ocean | 8-22 GB | 7 | Mixtral-8x7B, Llama-3-70B-Q4 |
| Mariana Depth | 22+ GB | 15 | Llama-3-70B-FP16 |

### Specialized Services
- **Embeddings**: 1 point per request
- **Text-to-Speech**: 2 points per request  
- **Web Scraping**: 0.5 points per request

### User Points
- **Usage Points**: 10% of provider points earned per request
- **Referral Bonus**: 100 points for signup, 200 points for milestones
- **Streak Bonuses**: Daily activity multipliers
- **Trial Bonuses**: Points for trying new services

## Referral System

### Referral Rewards
| Level | Provider Rate | User Bonus |
|-------|---------------|------------|
| Primary (Direct) | 20% of points | 100 points signup |
| Secondary | 10% of points | 200 points milestone |
| Tertiary | 5% of points | - |

### Referral Flow
1. User/Provider generates referral code via `/api/referrals/code`
2. New user enters referral code during signup
3. System processes referral via `/api/referrals/signup`
4. Referral chain is established (up to 3 levels)
5. Ongoing points automatically flow to referrers

## API Endpoints

### Admin Functions

#### Pricing Configuration
```bash
# Get all pricing config
GET /api/admin/pricing

# Set pricing for a service
POST /api/admin/pricing
{
  "configKey": "tide_pool_input",
  "pricePerUnit": 0.0002,
  "unit": "1000_tokens",
  "updatedBy": "admin_user_id"
}

# Toggle mainnet mode
PUT /api/admin/pricing
{
  "isMainnet": true,
  "updatedBy": "admin_user_id"
}
```

#### User Credits Management
```bash
# Add credits to user
POST /api/admin/credits
{
  "userId": "user123",
  "amount": 100.00,
  "reason": "Promotional credit"
}

# Get user credits
GET /api/admin/credits?userId=user123
```

#### Rewards Dashboard
```bash
# Get leaderboards
GET /api/admin/rewards?type=leaderboard&month=2025-01

# Get provider rewards
GET /api/admin/rewards?type=provider&id=provider123&month=2025-01

# Get user points
GET /api/admin/rewards?type=user&id=user123&month=2025-01
```

### User/Provider Functions

#### Referral Code Management
```bash
# Generate/get referral code
POST /api/referrals/code
{
  "userId": "user123",
  "userType": "user"
}

# Process referral signup
POST /api/referrals/signup
{
  "referralCode": "USER-ABC123",
  "refereeId": "newuser456",
  "refereeType": "user"
}
```

## Usage Tracking

### Automatic Tracking
All API requests are automatically tracked using the `withUsageTracking` middleware:

```typescript
import { withUsageTracking } from '../lib/middleware/usage-tracking';

export async function POST(request: NextRequest) {
  return withUsageTracking(request, async (req) => {
    // Your API handler logic
    return NextResponse.json({ success: true });
  }, '/api/v1/chat/completions');
}
```

### Manual Tracking
For custom tracking scenarios:

```typescript
import { trackUsageAndRewards } from '../lib/rewards';

await trackUsageAndRewards(
  requestId,
  userId,
  providerId,
  '/api/v1/chat/completions',
  'llama-3-8b',
  200, // status code
  150, // input tokens
  75,  // output tokens
  250  // latency ms
);
```

## Admin Functions (Code Examples)

### Initialize Default Pricing (Testnet)
```typescript
import { setPricingConfig } from '../lib/rewards';

// Set all prices to 0 for testnet
await setPricingConfig('tide_pool_input', 0, '1000_tokens', 'admin');
await setPricingConfig('tide_pool_output', 0, '1000_tokens', 'admin');
await setPricingConfig('blue_surge_input', 0, '1000_tokens', 'admin');
await setPricingConfig('blue_surge_output', 0, '1000_tokens', 'admin');
// ... etc for all tiers and services
```

### Add Promotional Credits
```typescript
import { addUserCredits } from '../lib/rewards';

// Add $50 promotional credit
await addUserCredits('user123', 50.00, 'Welcome bonus');
```

### Switch to Mainnet
```typescript
import { toggleMainnet, setPricingConfig } from '../lib/rewards';

// Enable mainnet mode
await toggleMainnet(true, 'admin_user_id');

// Set mainnet pricing
await setPricingConfig('tide_pool_input', 0.0002, '1000_tokens', 'admin');
await setPricingConfig('tide_pool_output', 0.0004, '1000_tokens', 'admin');
// ... etc
```

## Dashboard Integration

### Referral Section Component
```tsx
import ReferralSection from '../components/dashboard/ReferralSection';

function UserDashboard({ userId, hasReferrer }) {
  return (
    <div>
      {/* Other dashboard content */}
      <ReferralSection 
        userId={userId}
        userType="user"
        hasReferrer={hasReferrer}
      />
    </div>
  );
}
```

### Provider Dashboard Usage
```tsx
<ReferralSection 
  userId={providerId}
  userType="provider"
  hasReferrer={false}
/>
```

## Configuration Constants

### Service Tier Detection
The system automatically detects service tiers based on model names:
- **Mariana Depth**: Models with "70b" (non-Q4)
- **Open Ocean**: Models with "70b", "mixtral", "8x7b"
- **Blue Surge**: Models with "7b", "mistral", "llama-3-8b"
- **Tide Pool**: All other models, embeddings, scraping

### Referral Rates (Configurable)
```typescript
const DEFAULT_REFERRAL_RATES = {
  provider: {
    primary: 0.20,    // 20%
    secondary: 0.10,  // 10%
    tertiary: 0.05    // 5%
  },
  user: {
    signupBonus: 100,       // points
    milestoneBonus: 200,    // points
    activityThreshold: 50   // requests
  }
};
```

## Future Enhancements

### Planned Features
- **Smart Contract Integration**: On-chain reward distribution
- **NFT Rewards**: Special achievements and milestones
- **Governance Voting**: Points-based platform governance
- **Staking Mechanisms**: Lock points for higher rewards
- **Seasonal Events**: Limited-time bonus multipliers

### Analytics Dashboard
- Real-time points tracking
- Provider performance metrics
- User engagement analytics
- Referral conversion rates
- Revenue projections

## Testing

### Testnet Mode
- All services are free (pricing = 0)
- Points still accumulate normally
- Referral system fully functional
- Credits can be added for testing

### Development Testing
```bash
# Test referral code generation
curl -X POST http://localhost:3000/api/referrals/code \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","userType":"user"}'

# Test credit addition
curl -X POST http://localhost:3000/api/admin/credits \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","amount":100}'
```

This comprehensive rewards system provides a solid foundation for incentivizing platform growth through provider participation and user referrals while maintaining flexibility for future enhancements. 