<!-- onchain-addition-plan.md -->

# On-Chain Upgrade Plan (v0.1 · June 2025)

This document explains how Cxmpute will extend its architecture with peaq-based Decentralised Identifiers (DIDs), on-chain wallet linking and state-synchronised provisions.

---

## 1. Scope

1. Provider CLI generates a draft DID for every new provision.
2. Backend API finalises and stores the DID by injecting the provider's wallet address.
3. DID `state` field mirrors the provision lifecycle — `started → running → off`.
4. Users and Providers can link their EVM wallets from the dashboards.
5. All logic must default to **Agung testnet** until an admin flips `CHAIN_STAGE` to `mainnet`.

---

## 2. Data-Model Changes

### 2.1 `ProvisionsTable`

| Field | Type | Description |
|-------|------|-------------|
| `did` | string | The DID string (`did:peaq:evm:<hash>`) |
| `didState` | string | `started`, `running`, `off` |
| `deviceTier` | string | Tier label (e.g. `"Blue Surge"`) |
| `country` | string | ISO-3166 country code |
| `providerWallet` | string | EVM wallet address |

### 2.2 `ProviderTable` & `UserTable`

Add the following attributes (with GSIs where noted):

* `walletAddress` (string)
* `walletLinked` (boolean, GSI hash key)

---

## 3. DID Document Schema

```json
{
  "id": "did:peaq:evm:<hash>",
  "controller": "<providerWallet>",
  "service": [{
    "id": "#cxmpute",
    "type": "provision",
    "data": "<provisionId>"
  }],
  "extra": {
    "providerId": "<providerId>",
    "endpoint": "/chat/completions",
    "deviceTier": "Blue Surge",
    "country": "US",
    "state": "started"
  }
}
```

*CLI* sends the `extra` block; *API* inserts `controller`.

---

## 4. Flow Overview

1. **Provision CREATE**  
   CLI → `POST /api/v1/provision`  
   ‑ body = draft DID + machine public key  
   API signs DID, stores record, returns final DID.

2. **Provision START / STOP**  
   CLI → `PATCH /api/v1/provision/:id/state` `{ state: "running" | "off" }`  
   API updates Dynamo + calls `sdk.did.update()`.

3. **Wallet Linking**  
   Dashboard ↔ `/api/v1/wallet/link`  
   Signature‐based ownership proof → persist `walletAddress`.

---

## 5. CLI Enhancements (`cxmpute-provider`)

* Add `peaq.ts` wrapper around `@peaq-network/sdk`.
* Commands:
  * `cxmpute provision register` – creates draft DID.
  * `cxmpute provision start|stop` – state sync.
  * `cxmpute wallet show` – prints provider wallet.
* Machine private key stored in AES-encrypted keystore (`~/.cxmpute/.keys`).

---

## 6. API Route Stubs

```
POST   /api/v1/provision            → create + finalise DID
PATCH  /api/v1/provision/:id/state  → update DID state
POST   /api/v1/wallet/link          → link EVM wallet
```

Handlers reside under `src/app/api/v1/provider/` and reuse the existing SST infrastructure.

---

## 7. Dashboard Updates

* **LinkWalletButton** – MetaMask / WalletConnect integration, displays linked address.
* Provider dashboard lists provisions with DID status chips.
* User dashboard adds **Deposit CXPT** modal (stub until token launch).

---

## 8. Environment & Feature Flags

* `CHAIN_STAGE` (`testnet` | `mainnet`) – controls RPC URLs & pricing.
* `FEATURE_DID` – gate new flows until contracts are audited.

Admin switches flags via the existing `PricingConfigTable` UI.

---

## 9. Security Considerations

1. Backend never stores machine private keys.
2. All DID updates are signed with the machine wallet.
3. RPC credentials kept in AWS Secrets Manager.
4. Rate-limit provision operations to prevent spam DIDs.

---

End of file.
