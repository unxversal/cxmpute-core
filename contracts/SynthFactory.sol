// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SynthERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SynthFactory is Ownable {
    event SynthCreated(address indexed synth, string name, string symbol);

    address public immutable vault;

    constructor(address _vault) {
        vault = _vault;
    }

    function createSynth(
        string calldata name,
        string calldata symbol
    ) external onlyOwner returns (address synth) {
        // Simple CREATE2 gives deterministic addresses if you ever need them
        bytes32 salt = keccak256(abi.encodePacked(symbol));
        synth = address(new SynthERC20{salt: salt}(name, symbol, vault));

        emit SynthCreated(synth, name, symbol);
    }
}