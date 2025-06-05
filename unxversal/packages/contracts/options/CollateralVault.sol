// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol"; // Owned by OptionsAdmin
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CollateralVault
 * @author Unxversal Team
 * @notice Securely holds and manages collateral for written options.
 * @dev Interacts with OptionNFT contract to lock collateral from writers and release it
 *      upon option exercise or expiry. Only authorized contracts (OptionNFT) can trigger
 *      core lock/release functions pertaining to user collateral.
 */
contract CollateralVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Address of the OptionNFT contract, authorized to instruct this vault.
    address public optionNFTContract;

    // Tracks locked collateral: seriesKey => writer => collateralToken => amount
    // seriesKey is keccak256(underlying, quote, strike, expiry, isCall)
    mapping(bytes32 => mapping(address => mapping(address => uint256))) public lockedCollateral;

    event CollateralLocked(
        bytes32 indexed seriesKey,
        address indexed writer,
        address indexed collateralToken,
        uint256 amountLocked
    );
    event CollateralReleasedForExercise(
        bytes32 indexed seriesKey,
        address indexed writer,
        address indexed holder,
        address payoutTokenToHolder,
        uint256 payoutAmountToHolder,
        address collateralTokenToWriter, // Token type returned to writer
        uint256 amountCollateralReturnedToWriter // Portion of original collateral returned
    );
    event ExpiredCollateralReleased(
        bytes32 indexed seriesKey,
        address indexed writer,
        address indexed collateralToken,
        uint256 amountReturned
    );
    event OptionNFTContractSet(address indexed newOptionNFTAddress);

    modifier onlyOptionNFT() {
        require(msg.sender == optionNFTContract, "CV: Caller not OptionNFT");
        _;
    }

    /**
     * @param _initialOwner The address of the OptionsAdmin contract.
     * @param _optionNFTContractAddress The initial address of the OptionNFT contract.
     */
    constructor(address _initialOwner, address _optionNFTContractAddress) Ownable(_initialOwner) {
        setOptionNFTContract(_optionNFTContractAddress); // Emits event
    }

    // --- Admin Functions (Callable by Owner - OptionsAdmin) ---
    function setOptionNFTContract(address _newOptionNFTAddress) public onlyOwner {
        require(_newOptionNFTAddress != address(0), "CV: Zero OptionNFT address");
        optionNFTContract = _newOptionNFTAddress;
        emit OptionNFTContractSet(_newOptionNFTAddress);
    }

    function pauseActions() external onlyOwner { // Pauses lock/release functions
        _pause();
    }

    function unpauseActions() external onlyOwner {
        _unpause();
    }

    // --- Core Functions (Callable by OptionNFT contract) ---

    /**
     * @notice Locks collateral from a writer for a new batch of written options.
     * @dev Called by OptionNFT. This vault pulls tokens from the writer.
     * @param seriesKey Identifier for the option series.
     * @param writer The address of the option writer.
     * @param collateralToken The ERC20 token being locked as collateral.
     * @param totalAmountToLock The total amount of collateralToken to lock.
     */
    function lockCollateral(
        bytes32 seriesKey,
        address writer,
        address collateralToken,
        uint256 totalAmountToLock
    ) external nonReentrant whenNotPaused onlyOptionNFT {
        require(writer != address(0), "CV: Zero writer address");
        require(collateralToken != address(0), "CV: Zero collateral token");
        require(totalAmountToLock > 0, "CV: Zero lock amount");

        lockedCollateral[seriesKey][writer][collateralToken] += totalAmountToLock;
        IERC20(collateralToken).safeTransferFrom(writer, address(this), totalAmountToLock);

        emit CollateralLocked(seriesKey, writer, collateralToken, totalAmountToLock);
    }

    /**
     * @notice Releases collateral and/or payout upon option exercise.
     * @dev Called by OptionNFT. Transfers assets from this vault.
     * @param seriesKey Identifier for the option series.
     * @param writer The original writer of the option.
     * @param holder The current holder exercising the option.
     * @param payoutTokenToHolder The token to be paid out to the holder.
     * @param payoutAmountToHolder The amount of payoutTokenToHolder to send to the holder.
     * @param strikePaymentTokenFromHolderForWriter For CALLS, this is quote asset. For PUTS, this is underlying.
     *                                               This token comes from holder to writer (via this vault).
     * @param strikePaymentAmountFromHolderForWriter Amount of strikePaymentToken.
     * @param collateralAssetOriginallyLocked The asset type originally locked by the writer for this option.
     * @param portionOfCollateralConsumedForPayout Amount of original collateral consumed for this exercise.
     */
    function releaseForExercise(
        bytes32 seriesKey,
        address writer,
        address holder,
        address payoutTokenToHolder,        // e.g., Underlying for Call, Quote for Put
        uint256 payoutAmountToHolder,
        address strikePaymentTokenFromHolderForWriter, // e.g., Quote for Call, Underlying for Put
        uint256 strikePaymentAmountFromHolderForWriter,
        address collateralAssetOriginallyLocked, // The token writer initially locked
        uint256 portionOfCollateralConsumedForPayout // In units of collateralAssetOriginallyLocked
    ) external nonReentrant whenNotPaused onlyOptionNFT {
        require(writer != address(0) && holder != address(0), "CV: Zero address");
        require(payoutTokenToHolder != address(0), "CV: Zero payout token");
        // payoutAmountToHolder can be 0 if OTM and still exercised (not typical, but possible if allowed by OptionNFT)

        // 1. Handle strike payment from holder (if any) -> to writer
        // OptionNFT should ensure this vault has received the strike payment from holder before calling this.
        // This function assumes strikePaymentAmountFromHolderForWriter is ALREADY in this vault, sent by OptionNFT.
        if (strikePaymentAmountFromHolderForWriter > 0) {
            require(strikePaymentTokenFromHolderForWriter != address(0), "CV: Zero strike payment token");
            IERC20(strikePaymentTokenFromHolderForWriter).safeTransfer(writer, strikePaymentAmountFromHolderForWriter);
        }

        // 2. Update writer's locked collateral record
        uint256 currentLocked = lockedCollateral[seriesKey][writer][collateralAssetOriginallyLocked];
        require(currentLocked >= portionOfCollateralConsumedForPayout, "CV: Insufficient locked collateral");
        lockedCollateral[seriesKey][writer][collateralAssetOriginallyLocked] = currentLocked - portionOfCollateralConsumedForPayout;

        // 3. Payout to holder (from the consumed collateral)
        if (payoutAmountToHolder > 0) {
            // This payoutTokenToHolder must be the same as collateralAssetOriginallyLocked for a simple model
            // OR this vault needs to manage diverse collateral pools.
            // For now, assume payoutTokenToHolder IS the collateralAssetOriginallyLocked for calls/puts.
            // e.g. Call: writer locks ETH, holder gets ETH. Put: writer locks USDC, holder gets USDC.
            require(payoutTokenToHolder == collateralAssetOriginallyLocked, "CV: Payout token mismatch with locked collateral asset");
            IERC20(payoutTokenToHolder).safeTransfer(holder, payoutAmountToHolder);
        }
        
        // What if portionOfCollateralConsumedForPayout > payoutAmountToHolder? (e.g. ITM Puts where strike > underlying value)
        // Example: ETH Put, Strike $3000. ETH price $2800. Holder gets $3000 USDC. Writer locked $3000 USDC.
        // Here, payoutTokenToHolder = USDC, payoutAmountToHolder = 3000.
        // collateralAssetOriginallyLocked = USDC, portionOfCollateralConsumed = 3000.
        // Example: ETH Call, Strike $3000. ETH price $3200. Holder gets 1 ETH. Writer locked 1 ETH.
        // Here, payoutTokenToHolder = ETH, payoutAmountToHolder = 1.
        // collateralAssetOriginallyLocked = ETH, portionOfCollateralConsumed = 1.

        emit CollateralReleasedForExercise(
            seriesKey, writer, holder,
            payoutTokenToHolder, payoutAmountToHolder,
            strikePaymentTokenFromHolderForWriter, strikePaymentAmountFromHolderForWriter // This is what writer received
        );
    }


    /**
     * @notice Releases collateral back to the writer for an expired and unexercised option.
     * @dev Called by OptionNFT.
     * @param seriesKey Identifier for the option series.
     * @param writer The address of the option writer.
     * @param collateralToken The ERC20 token that was locked.
     * @param amountToExpireAndReturn The amount of collateralToken to return.
     */
    function releaseExpiredCollateral(
        bytes32 seriesKey,
        address writer,
        address collateralToken,
        uint256 amountToExpireAndReturn
    ) external nonReentrant whenNotPaused onlyOptionNFT {
        require(writer != address(0), "CV: Zero writer");
        require(collateralToken != address(0), "CV: Zero collateral token");
        require(amountToExpireAndReturn > 0, "CV: Zero return amount");

        uint256 currentLocked = lockedCollateral[seriesKey][writer][collateralToken];
        require(currentLocked >= amountToExpireAndReturn, "CV: Exceeds locked collateral");
        lockedCollateral[seriesKey][writer][collateralToken] = currentLocked - amountToExpireAndReturn;

        IERC20(collateralToken).safeTransfer(writer, amountToExpireAndReturn);

        emit ExpiredCollateralReleased(seriesKey, writer, collateralToken, amountToExpireAndReturn);
    }

    // --- View Functions ---
    function getLockedCollateral(
        bytes32 seriesKey,
        address writer,
        address collateralToken
    ) external view returns (uint256) {
        return lockedCollateral[seriesKey][writer][collateralToken];
    }
}