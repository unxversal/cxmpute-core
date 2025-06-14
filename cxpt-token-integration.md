# CXPT Token Integration Plan

## Overview

This document outlines the technical implementation plan for integrating the CXPT token into the Cxmpute platform. The integration spans smart contracts, backend services, and frontend components, with a focus on centralized administration and credit management.

## Smart Contracts

### 1. CXPT Token Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CXPTToken is ERC20, Ownable {
    constructor() ERC20("Cxmpute Token", "CXPT") {
        _mint(msg.sender, 1000000000 * 10**decimals());
    }
    
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
```

### 2. Vault Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CXPTVault is Ownable {
    IERC20 public cxptToken;
    
    struct CreditTracking {
        uint256 loadedCredits;    // Total credits deposited
        uint256 spentCredits;     // Credits consumed
        uint256 protocolBalance;  // Admin-determined protocol share
    }
    
    struct RewardPool {
        uint256 providerRewards;  // Available for provider distribution
        uint256 platformOps;      // Platform operations fund
    }
    
    CreditTracking public credits;
    RewardPool public rewards;
    
    constructor(address _cxptToken) {
        cxptToken = IERC20(_cxptToken);
    }
    
    function depositCredits(uint256 amount) external {
        require(cxptToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        credits.loadedCredits += amount;
    }
    
    function spendCredits(uint256 amount) external onlyOwner {
        require(credits.loadedCredits >= amount, "Insufficient credits");
        credits.loadedCredits -= amount;
        credits.spentCredits += amount;
    }
    
    function updateProtocolBalance(uint256 amount) external onlyOwner {
        credits.protocolBalance = amount;
    }
    
    function distributeRewards(
        address[] calldata providers,
        uint256[] calldata providerAmounts
    ) external onlyOwner {
        // Distribution logic
    }
}
```

### 3. Subscription Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SubscriptionManager is Ownable {
    IERC20 public cxptToken;
    address public vault;
    
    struct Subscription {
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }
    
    mapping(address => Subscription) public subscriptions;
    
    function subscribe(uint256 amount, uint256 duration) external {
        require(cxptToken.transferFrom(msg.sender, vault, amount), "Transfer failed");
        // Subscription logic
    }
}
```

## Backend Integration

### 1. Database Schema Updates

```sql
-- User Token Balance
ALTER TABLE users ADD COLUMN cxpt_balance DECIMAL(20,8);
ALTER TABLE users ADD COLUMN subscription_type VARCHAR(20);
ALTER TABLE users ADD COLUMN subscription_end TIMESTAMP;

-- Provider Token Balance
ALTER TABLE providers ADD COLUMN cxpt_balance DECIMAL(20,8);
ALTER TABLE providers ADD COLUMN total_earnings DECIMAL(20,8);

-- Credit Tracking
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    provider_id UUID REFERENCES providers(id),
    amount DECIMAL(20,8),
    type VARCHAR(20),
    status VARCHAR(20),
    created_at TIMESTAMP
);

-- Vault Tracking
CREATE TABLE vault_balances (
    id UUID PRIMARY KEY,
    loaded_credits DECIMAL(20,8),
    spent_credits DECIMAL(20,8),
    protocol_balance DECIMAL(20,8),
    updated_at TIMESTAMP
);
```

### 2. API Routes

```typescript
// Token Management
POST /api/v1/tokens/deposit
POST /api/v1/tokens/withdraw
GET /api/v1/tokens/balance

// Subscription Management
POST /api/v1/subscriptions/create
POST /api/v1/subscriptions/cancel
GET /api/v1/subscriptions/status

// Admin Routes
POST /api/v1/admin/vault/update-balance
POST /api/v1/admin/vault/distribute-rewards
GET /api/v1/admin/vault/status
```

### 3. Service Layer

```typescript
// TokenService
class TokenService {
    async depositTokens(userId: string, amount: number): Promise<void>
    async withdrawTokens(userId: string, amount: number): Promise<void>
    async getBalance(userId: string): Promise<number>
}

// VaultService
class VaultService {
    async updateCreditTracking(amount: number, type: string): Promise<void>
    async getVaultStatus(): Promise<VaultStatus>
    async distributeRewards(providerId: string, amount: number): Promise<void>
}

// SubscriptionService
class SubscriptionService {
    async createSubscription(userId: string, plan: string): Promise<void>
    async cancelSubscription(userId: string): Promise<void>
    async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>
}
```

## Frontend Integration

### 1. User Dashboard Components

```typescript
// TokenBalance.tsx
const TokenBalance: React.FC = () => {
    // Display current balance
    // Deposit/withdraw buttons
    // Transaction history
}

// SubscriptionManager.tsx
const SubscriptionManager: React.FC = () => {
    // Current subscription status
    // Plan selection
    // Payment processing
}
```

### 2. Admin Dashboard Components

```typescript
// VaultManager.tsx
const VaultManager: React.FC = () => {
    // Credit tracking
    // Reward distribution
    // Protocol balance
}

// ProviderRewards.tsx
const ProviderRewards: React.FC = () => {
    // Provider earnings
    // Reward distribution
    // Performance metrics
}
```

## Integration Flow

### 1. User Onboarding

1. User creates account
2. Links wallet
3. Chooses pricing model (subscription/usage)
4. Deposits initial tokens

### 2. Provider Onboarding

1. Provider creates account
2. Links wallet
3. Sets up provisions
4. Starts earning tokens

### 3. Compute Resource Allocation

1. User requests compute
2. System checks:
   - Subscription status
   - Token balance
   - Available providers
3. Allocates resources
4. Processes payment to vault

### 4. Reward Distribution

1. Track provider performance
2. Calculate rewards
3. Admin approves distribution
4. Process distributions from vault

## Testing Strategy

### 1. Smart Contract Tests

```typescript
describe("CXPTToken", () => {
    it("should mint correct amount")
    it("should burn tokens correctly")
    it("should transfer tokens")
})

describe("Vault", () => {
    it("should track credits correctly")
    it("should distribute rewards")
    it("should maintain protocol balance")
})
```

### 2. Integration Tests

```typescript
describe("Token Integration", () => {
    it("should process deposits")
    it("should handle withdrawals")
    it("should manage subscriptions")
})

describe("Vault System", () => {
    it("should track credit flow")
    it("should distribute rewards")
    it("should maintain balances")
})
```

## Deployment Plan

### 1. Smart Contract Deployment

1. Deploy CXPT token
2. Deploy vault
3. Deploy subscription manager
4. Initialize contracts

### 2. Backend Deployment

1. Update database schema
2. Deploy new API routes
3. Configure services
4. Test integration

### 3. Frontend Deployment

1. Deploy new components
2. Update existing pages
3. Test user flows
4. Monitor performance

## Monitoring & Maintenance

### 1. Key Metrics

- Credit transactions
- Subscription conversions
- Reward distributions
- System performance

### 2. Alerts

- Low balance warnings
- Failed transactions
- System errors
- Performance issues

### 3. Maintenance Tasks

- Regular balance checks
- Transaction reconciliation
- Performance optimization
- Security updates 