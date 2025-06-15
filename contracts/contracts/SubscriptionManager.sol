// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title SubscriptionManager
 * @notice Mints non-transferable subscription NFTs that represent active plans.
 *         The admin (PeaqAdmin) calls `activatePlan` to issue a pass to a user.
 *         Each token embeds the planId in its metadata URI for easy retrieval.
 *         Tokens are Soul-Bound (non-transferable) – transfers are disabled.
 */
contract SubscriptionManager is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    string public baseTokenURI;

    // tokenId => planId
    mapping(uint256 => uint256) public planOf;

    event PlanActivated(address indexed user, uint256 indexed planId, uint256 tokenId);

    constructor(string memory initialBaseURI, address admin) ERC721("CXMP Subscription Pass", "CXMPPASS") Ownable(admin) {
        baseTokenURI = initialBaseURI;
    }

    /**
     * @notice Mint a subscription NFT representing `planId` to `user`.
     *         Reverts if the user already owns a pass (one pass per wallet).
     */
    function activatePlan(address user, uint256 planId) external onlyOwner returns (uint256 tokenId) {
        require(balanceOf(user) == 0, "already has pass");
        _tokenIdCounter += 1;
        tokenId = _tokenIdCounter;
        _safeMint(user, tokenId);
        planOf[tokenId] = planId;
        _setTokenURI(tokenId, _composeTokenURI(planId));
        emit PlanActivated(user, planId, tokenId);
    }

    // ------------------------------------------------------------------
    // Non-transferable overrides (soul-bound)
    // ------------------------------------------------------------------

    function approve(address /*to*/, uint256 /*tokenId*/) public virtual override(ERC721, IERC721) {
        revert("non-transferable");
    }

    function setApprovalForAll(address /*operator*/, bool /*approved*/) public virtual override(ERC721, IERC721) {
        revert("non-transferable");
    }

    function transferFrom(address /*from*/, address /*to*/, uint256 /*tokenId*/) public virtual override(ERC721, IERC721) {
        revert("non-transferable");
    }

    function safeTransferFrom(address /*from*/, address /*to*/, uint256 /*tokenId*/, bytes memory /*data*/) public virtual override(ERC721, IERC721) {
        revert("non-transferable");
    }

    // ------------------------------------------------------------------
    // Admin helpers
    // ------------------------------------------------------------------

    function setBaseURI(string calldata _base) external onlyOwner {
        baseTokenURI = _base;
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    function _composeTokenURI(uint256 planId) internal view returns (string memory) {
        // simple concatenation baseURI + planId, e.g., "ipfs://.../1"
        return string(abi.encodePacked(baseTokenURI, _toString(planId)));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
} 