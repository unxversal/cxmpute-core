// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CXPTToken.sol";

/// @dev minimal interface for calling Vault.sweep() from RewardDistributor
interface IVault {
    function sweep() external;
}

/// @notice Minimal merkle-based streaming distributor.
contract RewardDistributor is Ownable {
    CXPTToken public immutable token;
    bytes32 public merkleRoot; // total cumulative amount per address

    mapping(address => uint256) public claimed; // amount already claimed

    event MerkleRootUpdated(bytes32 root);
    event Claimed(address indexed account, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = CXPTToken(_token);
    }

    function updateMerkleRoot(bytes32 root) external onlyOwner {
        merkleRoot = root;
        emit MerkleRootUpdated(root);
    }

    function pending(address account, uint256 totalEligible) public view returns (uint256) {
        return totalEligible - claimed[account];
    }

    function claim(uint256 totalEligible, bytes32[] calldata proof) external {
        require(_verify(msg.sender, totalEligible, proof), "invalid proof");
        uint256 pay = pending(msg.sender, totalEligible);
        require(pay > 0, "nothing");
        claimed[msg.sender] += pay;
        token.transfer(msg.sender, pay);
        emit Claimed(msg.sender, pay);
    }

    function _verify(address account, uint256 amount, bytes32[] calldata proof) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(account, amount));
        return MerkleProof.verifyCalldata(proof, merkleRoot, leaf);
    }

    /// ---------------------------------------------------------------------
    /// Admin helpers
    /// ---------------------------------------------------------------------

    /// @notice Manually trigger a Vault sweep for the current epoch.
    /// The call is relayed through the RewardDistributor so that the
    /// `msg.sender` inside Vault is still the RewardDistributor address,
    /// matching the `onlyRewardDistributor` modifier in Vault.
    /// @param vault The address of the Vault contract to sweep.
    function sweepVault(address vault) external onlyOwner {
        IVault(vault).sweep();
    }
} 