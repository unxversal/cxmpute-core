// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title MultisigControl
 * @notice Simple on-chain multisig controller that can own other contracts.
 *         A proposal is created with the target address, ETH value and calldata.
 *         Once the proposal reaches the signature threshold it is executed
 *         immediately. This contract is intentionally minimal – it is not
 *         upgradeable and has no concept of proposal expiration or
 *         revocation; an owner can simply abstain from signing if they
 *         disagree.
 */
contract MultisigControl is ERC165 {
    using Address for address;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct Proposal {
        address target;
        uint256 value;
        bytes data;
        uint256 approvals;
        bool executed;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address[] public owners;
    uint256 public immutable threshold;

    // proposalId => proposal
    mapping(uint256 => Proposal) private _proposals;
    uint256 private _nextId;

    // proposalId => owner => approved?
    mapping(uint256 => mapping(address => bool)) private _approvedBy;

    // owner quick lookup
    mapping(address => bool) public isOwner;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ProposalCreated(uint256 indexed id, address indexed proposer, address target, uint256 value, bytes data);
    event ProposalApproved(uint256 indexed id, address indexed approver, uint256 approvals);
    event ProposalExecuted(uint256 indexed id, bytes result);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(address[] memory _owners, uint256 _threshold) {
        require(_owners.length >= _threshold && _threshold > 0, "invalid threshold");
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "zero owner");
            require(!isOwner[owner], "duplicate owner");
            isOwner[owner] = true;
        }
        owners = _owners;
        threshold = _threshold;
        _nextId = 1; // start ids at 1 for gas micro-optimisations in clients
    }

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    // ---------------------------------------------------------------------
    // Public getters
    // ---------------------------------------------------------------------

    function proposal(uint256 id)
        external
        view
        returns (address target, uint256 value, bytes memory data, uint256 approvals, bool executed)
    {
        Proposal storage p = _proposals[id];
        return (p.target, p.value, p.data, p.approvals, p.executed);
    }

    // ---------------------------------------------------------------------
    // Core multisig functions
    // ---------------------------------------------------------------------

    /**
     * @notice Create a new proposal. The proposer automatically casts the first
     *         approval. If the threshold is one, the transaction executes
     *         immediately.
     */
    function propose(address target, uint256 value, bytes calldata data) external onlyOwner returns (uint256 id) {
        require(target != address(0), "target zero");

        id = _nextId++;
        Proposal storage p = _proposals[id];
        p.target = target;
        p.value = value;
        p.data = data;
        // first approval
        p.approvals = 1;
        _approvedBy[id][msg.sender] = true;

        emit ProposalCreated(id, msg.sender, target, value, data);
        emit ProposalApproved(id, msg.sender, 1);

        if (p.approvals >= threshold) {
            _execute(id);
        }
    }

    /**
     * @notice Approve an existing proposal by id. Executes automatically when
     *         approvals reach the threshold.
     */
    function approve(uint256 id) external onlyOwner {
        Proposal storage p = _proposals[id];
        require(p.target != address(0), "no proposal");
        require(!p.executed, "executed");
        require(!_approvedBy[id][msg.sender], "already approved");

        _approvedBy[id][msg.sender] = true;
        p.approvals += 1;

        emit ProposalApproved(id, msg.sender, p.approvals);

        if (p.approvals >= threshold) {
            _execute(id);
        }
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _execute(uint256 id) internal {
        Proposal storage p = _proposals[id];
        require(!p.executed, "executed");
        p.executed = true;

        bytes memory result = p.target.functionCallWithValue(p.data, p.value);
        emit ProposalExecuted(id, result);
    }

    // ---------------------------------------------------------------------
    // ERC-165 support
    // ---------------------------------------------------------------------

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        // no custom interfaces yet
        return super.supportsInterface(interfaceId);
    }
} 