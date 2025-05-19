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


# Run the Deployment Script

## To Agung Testnet:

```shell
npx hardhat run scripts/deploy.ts --network agung
```

## To Peaq Mainnet (USE WITH EXTREME CAUTION)

```shell
npx hardhat run scripts/deploy.ts --network peaq
```

## To Local Hardhat Network (for quick tests)

```shell
npx hardhat node # Start a local node in one terminal
npx hardhat run scripts/deploy.ts --network localhost # Run script in another terminal
```