// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Quarter-locked release for liquidity provisioning.
contract LiquidityEscrow is Ownable {
    IERC20 public immutable token;
    address public recipient;
    uint256 public immutable trancheAmount;
    uint8 public releasedTranches; // 0..4
    uint256 public immutable start;

    event Claimed(uint8 tranche, uint256 amount);

    constructor(address _token, address _recipient, uint256 _start) Ownable(msg.sender) {
        token = IERC20(_token);
        recipient = _recipient;
        start = _start;
        trancheAmount = token.balanceOf(address(this)) / 4;
    }

    function currentTranche() public view returns (uint8) {
        if (block.timestamp < start) return 0;
        uint8 tranche = uint8((block.timestamp - start) / 90 days) + 1; // Every 3 months
        if (tranche > 4) tranche = 4;
        return tranche;
    }

    function claim() external {
        uint8 tranche = currentTranche();
        require(tranche > releasedTranches, "nothing");
        uint8 toRelease = tranche - releasedTranches;
        releasedTranches = tranche;
        token.transfer(recipient, trancheAmount * toRelease);
        emit Claimed(tranche, trancheAmount * toRelease);
    }

    function updateRecipient(address _new) external onlyOwner { recipient = _new; }
} 