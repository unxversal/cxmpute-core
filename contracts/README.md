# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

## Agung Testnet Deploy (2025-06-14)

| Contract | Address |
|----------|-------------------------------------------|
| CXPTToken | `0xf19C0e1Fef0bAe2be417df5Fbd9442e84f156380` |
| RewardDistributor | `0xcE45522442E11669ac2a1Fb7c98fbc6c9D726470` |
| Vault | `0x38482E24f9Ecf3432C998CA0c3e5645C4f3b4710` |
| CommunityVester | `0xC308D136c322C94a118d4E1283610D7741C5203e` |

> Note: CommunityVester `startTimestamp` is set ~1 year ahead to keep emissions paused during testnet.
