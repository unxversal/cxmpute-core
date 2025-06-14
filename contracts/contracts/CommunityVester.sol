// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CXPTToken.sol";

/// @notice Streams community allocation daily to RewardDistributor.
contract CommunityVester is Ownable {
    CXPTToken public immutable token;
    address public immutable rewardDistributor;

    uint256 public immutable dailyEmission; // tokens per day
    uint256 public lastPoke; // timestamp when last transfer happened

    event Poked(uint256 daysElapsed, uint256 amount);

    constructor(address _token, address _rd, uint256 _startTimestamp) Ownable(msg.sender) {
        token = CXPTToken(_token);
        rewardDistributor = _rd;
        uint256 total = token.balanceOf(address(this));
        dailyEmission = total / 3650; // ~10 years
        lastPoke = _startTimestamp;
    }

    function poke() external {
        require(block.timestamp > lastPoke, "not yet");
        uint256 daysElapsed = (block.timestamp - lastPoke) / 1 days;
        require(daysElapsed > 0, "<1d");
        uint256 amount = dailyEmission * daysElapsed;
        uint256 bal = token.balanceOf(address(this));
        if (amount > bal) amount = bal; // final stretch
        lastPoke += daysElapsed * 1 days;
        token.transfer(rewardDistributor, amount);
        emit Poked(daysElapsed, amount);
    }
} 