// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CXPTToken.sol";

/// @notice Receives all user payments, auto-burns 5 %, forwards remainder to RewardDistributor.
contract Vault {
    CXPTToken public immutable token;
    address public rewardDistributor;
    uint256 public burnBps = 500; // 5 % (basis points)

    event Deposit(address indexed from, uint256 amount, uint256 burned);
    event Swept(uint256 amount);
    event RewardDistributorChanged(address indexed newAddr);

    modifier onlyRewardDistributor() {
        require(msg.sender == rewardDistributor, "Vault: not RD");
        _;
    }

    constructor(address _token) {
        token = CXPTToken(_token);
    }

    function setRewardDistributor(address rd) external {
        require(rewardDistributor == address(0), "RD already set");
        rewardDistributor = rd;
        emit RewardDistributorChanged(rd);
    }

    /// @notice Users transfer tokens directly then call deposit to record.
    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        uint256 burnAmt = (amount * burnBps) / 10_000;
        if (burnAmt > 0) token.burn(burnAmt);
        emit Deposit(msg.sender, amount, burnAmt);
    }

    /// @notice Admin helper for fiat on-ramp.
    function depositFor(address payer, uint256 amount) external {
        require(msg.sender == rewardDistributor, "only RD or admin");
        token.transferFrom(payer, address(this), amount);
        uint256 burnAmt = (amount * burnBps) / 10_000;
        if (burnAmt > 0) token.burn(burnAmt);
        emit Deposit(payer, amount, burnAmt);
    }

    /// @notice Called by RD to collect rewards share (95 % less protocol).
    function sweep() external onlyRewardDistributor {
        uint256 bal = token.balanceOf(address(this));
        require(bal > 0, "nothing to sweep");
        token.transfer(rewardDistributor, bal);
        emit Swept(bal);
    }
} 