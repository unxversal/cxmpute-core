// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Linear vesting vault for founding team.
contract TokenTimelock is Ownable {
    IERC20 public immutable token;
    uint256 public immutable start;
    uint256 public immutable duration;

    uint256 public released;

    constructor(address _token, uint256 _start, uint256 _duration) Ownable(msg.sender) {
        token = IERC20(_token);
        start = _start;
        duration = _duration; // e.g., 4*365 days
    }

    function releasable() public view returns (uint256) {
        uint256 total = token.balanceOf(address(this)) + released;
        uint256 elapsed = block.timestamp < start ? 0 : block.timestamp - start;
        if (elapsed >= duration) return total - released;
        return (total * elapsed) / duration - released;
    }

    function release(address beneficiary) external onlyOwner {
        uint256 amount = releasable();
        require(amount > 0, "none");
        released += amount;
        token.transfer(beneficiary, amount);
    }
} 