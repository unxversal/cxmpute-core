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


Oracle Flow

```
Ethereum L1 (Not used for OracleRelayerSrc in this scenario)

        |
        |
        V

Polygon (or other L2/Sidechain)
+---------------------------------+
|      Chainlink Aggregators      | --(reads price)--> OracleRelayerSrc.sol
|        (e.g., BTC/USD)          |                    (on Polygon)
+---------------------------------+                        |
                                                           |--(sends LZ message via Polygon L0 Endpoint)-+
                                                           |                                            |
                                                           V                                            |
                                                    LayerZero Network                                   |
                                                           |                                            |
                                                           |                                            |
                                                           V                                            |
Peaq EVM                                                                                                |
+---------------------------------+                                                                     |
| OracleRelayerDst.sol            | <--(receives LZ message via Peaq L0 Endpoint)-------------------------+
|   (on Peaq)                     |
+---------------------------------+
      |
      | --(getPrice)--> Unxversal Synth, Lend, Perps (on Peaq)
      V
```