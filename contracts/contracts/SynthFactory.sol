// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol"; // Or AccessControl if more complex permissions needed
import "./SynthERC20.sol";
import "./Vault.sol"; // To call Vault.registerSynth

contract SynthFactory is Ownable {
    Vault public immutable vault; // Address of the main Vault contract

    // Mapping from synth symbol (e.g., "sBTC") to its contract address
    mapping(string => address) public synthBySymbol;
    // Array to store all created synth addresses (optional, for iteration if needed)
    address[] public allSynths;

    event SynthCreated(
        address indexed synthContract,
        string name,
        string symbol,
        uint8 decimals,
        address indexed vaultAddress,
        address adminForSynth // The admin set for the SynthERC20 contract
    );

    constructor(address initialOwner, address vaultAddress) Ownable(initialOwner) {
        require(vaultAddress != address(0), "SynthFactory: Vault address cannot be zero");
        vault = Vault(vaultAddress);
    }

    /**
     * @dev Creates a new SynthERC20 token, grants minting/burning roles to the Vault,
     *      and registers it with the Vault.
     * @param name The name of the synthetic token (e.g., "Synthetic Bitcoin")
     * @param symbol The symbol of the synthetic token (e.g., "sBTC")
     * @param decimals_ The number of decimals for the token
     * Only callable by the owner of this factory (likely deployer initially, then can be DAO/multisig).
     */
    function createSynth(
        string calldata name,
        string calldata symbol,
        uint8 decimals_
    ) external onlyOwner returns (address synthContractAddress) {
        require(synthBySymbol[symbol] == address(0), "SynthFactory: Symbol already exists");
        require(bytes(name).length > 0, "SynthFactory: Name cannot be empty");
        require(bytes(symbol).length > 0, "SynthFactory: Symbol cannot be empty");
        require(decimals_ > 0 && decimals_ <= 18, "SynthFactory: Decimals must be between 1 and 18"); // Common range

        // Deploy the new SynthERC20 contract
        // The admin for the SynthERC20 itself can be this factory or another designated admin.
        // The minterAndBurner will be the Vault.
        address synthAdmin = owner(); // Factory owner becomes admin of the new Synth by default
        SynthERC20 newSynth = new SynthERC20(name, symbol, decimals_, synthAdmin, address(vault));
        synthContractAddress = address(newSynth);

        // Store and register
        synthBySymbol[symbol] = synthContractAddress;
        allSynths.push(synthContractAddress);

        // Register the newly created synth with the main Vault
        // The Vault needs GATEWAY_ROLE to be this factory, or this factory needs GATEWAY_ROLE on Vault.
        // Let's assume this factory needs GATEWAY_ROLE on the Vault, or Vault.registerSynth is public/permissoned.
        // If Vault.registerSynth is restricted to GATEWAY_ROLE, then this factory contract
        // must be granted GATEWAY_ROLE on the Vault contract after deployment.
        // For simplicity, assuming Vault.registerSynth has appropriate permissions for the factory to call.
        // If not, the admin of the Vault would call vault.registerSynth(newSynthAddress) manually
        // or grant this factory the GATEWAY_ROLE.
        // My Vault.sol revision has `registerSynth` callable by `GATEWAY_ROLE`.
        // So, this SynthFactory needs to be granted GATEWAY_ROLE on the Vault.
        vault.registerSynth(synthContractAddress);

        emit SynthCreated(synthContractAddress, name, symbol, decimals_, address(vault), synthAdmin);
        return synthContractAddress;
    }

    /**
     * @dev Retrieves the address of a synth contract by its symbol.
     * @param symbol The symbol of the synthetic token (e.g., "sBTC")
     * @return The address of the synth contract, or address(0) if not found.
     */
    function getSynthBySymbol(string calldata symbol) external view returns (address) {
        return synthBySymbol[symbol];
    }

    function getAllSynthsCount() external view returns (uint256) {
        return allSynths.length;
    }

    function getSynthAtIndex(uint256 index) external view returns (address) {
        require(index < allSynths.length, "SynthFactory: Index out of bounds");
        return allSynths[index];
    }

    // Function to update the Vault address if ever needed (onlyOwner)
    // This is generally not recommended after synths are created and roles granted unless carefully managed.
    /*
    function setVaultAddress(address newVaultAddress) external onlyOwner {
        require(newVaultAddress != address(0), "SynthFactory: New vault address cannot be zero");
        vault = Vault(newVaultAddress);
        // IMPORTANT: This does NOT re-grant roles on existing synths to the new vault.
        // That would require iterating all existing synths and calling role grant functions on them,
        // assuming this factory retained admin rights over them.
    }
    */
}