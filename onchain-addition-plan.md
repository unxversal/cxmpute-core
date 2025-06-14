# On-chain Addition Plan

## Overview

This document outlines the implementation plan for integrating peaq network functionality into the Cxmpute platform. The integration focuses on three main areas:

1. Provider DID Management
2. User/Provider Wallet Linking
3. Provision State Management

## Provider DID Management

### DID Creation Flow

1. **Provider CLI DID Creation**
   - When a new provision is created, the CLI will:
     - Generate a new DID document with initial state
     - Include provider wallet address
     - Set initial state as "started" or "off"
     - Include provision metadata (model, endpoint, tier, location)
     - Send DID to backend API for completion

2. **Backend API DID Completion**
   - API route will:
     - Receive DID from provider CLI
     - Add provider wallet address
     - Sign and complete DID
     - Store DID in database
     - Return completed DID to provider

### DID State Management

1. **State Transitions**
   - "started" → "running" (when provision starts)
   - "running" → "off" (when provision stops)
   - Each state change requires DID update

2. **DID Update Process**
   - Provider sends state change request
   - Backend verifies request
   - Updates DID state
   - Stores updated DID
   - Returns confirmation

## Wallet Linking Implementation

### User Dashboard

1. **Wallet Link Component**
   - Add "Link Wallet" button
   - Implement wallet connection flow
   - Store wallet address in user record
   - Display linked wallet status

2. **Wallet Management**
   - Allow wallet disconnection
   - Show wallet balance
   - Display transaction history

### Provider Dashboard

1. **Wallet Link Component**
   - Similar to user dashboard
   - Additional provider-specific features
   - Link to provision DIDs

2. **Wallet Management**
   - Manage multiple provision wallets
   - View provision-specific transactions
   - Monitor earnings

## Database Schema Updates

### New Tables

```sql
CREATE TABLE provider_dids (
    id UUID PRIMARY KEY,
    provider_id UUID REFERENCES providers(id),
    did_document JSONB,
    state VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE user_wallets (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    wallet_address VARCHAR(42),
    created_at TIMESTAMP
);

CREATE TABLE provider_wallets (
    id UUID PRIMARY KEY,
    provider_id UUID REFERENCES providers(id),
    wallet_address VARCHAR(42),
    created_at TIMESTAMP
);
```

## API Routes

### New Routes

```typescript
// Provider DID Management
POST /api/v1/providers/did/create
POST /api/v1/providers/did/update
GET /api/v1/providers/did/:id

// Wallet Management
POST /api/v1/users/wallet/link
POST /api/v1/providers/wallet/link
DELETE /api/v1/users/wallet/unlink
DELETE /api/v1/providers/wallet/unlink
```

## Implementation Steps

1. **Phase 1: DID Infrastructure**
   - Implement DID creation in provider CLI
   - Create backend DID management routes
   - Set up DID storage and retrieval

2. **Phase 2: Wallet Linking**
   - Add wallet components to dashboards
   - Implement wallet connection flows
   - Create wallet management routes

3. **Phase 3: State Management**
   - Implement provision state transitions
   - Add DID state update logic
   - Create state change verification

4. **Phase 4: Testing & Integration**
   - Test DID creation and updates
   - Verify wallet linking flows
   - Validate state management
   - End-to-end testing

## Security Considerations

1. **DID Security**
   - Secure storage of DID documents
   - Proper signature verification
   - Access control for DID updates

2. **Wallet Security**
   - Secure wallet connection process
   - Private key protection
   - Transaction signing security

3. **State Management Security**
   - Verify state change requests
   - Prevent unauthorized updates
   - Maintain audit trail

## Testing Plan

1. **Unit Tests**
   - DID creation and updates
   - Wallet linking
   - State transitions

2. **Integration Tests**
   - End-to-end flows
   - API route testing
   - Database operations

3. **Security Tests**
   - Access control
   - Signature verification
   - State change validation

## Deployment Strategy

1. **Staging Deployment**
   - Deploy to testnet
   - Verify DID creation
   - Test wallet linking
   - Validate state management

2. **Production Deployment**
   - Gradual rollout
   - Monitor performance
   - Collect feedback
   - Address issues

## Monitoring & Maintenance

1. **Metrics to Track**
   - DID creation success rate
   - Wallet linking success rate
   - State transition errors
   - API response times

2. **Maintenance Tasks**
   - Regular DID verification
   - Wallet address validation
   - State consistency checks
   - Performance optimization 