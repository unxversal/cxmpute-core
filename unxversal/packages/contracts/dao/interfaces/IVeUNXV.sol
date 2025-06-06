// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IVeUNXV {
    function get_last_user_slope(address addr) external view returns (uint256);
    function locked__end(address addr) external view returns (uint256);
    function balanceOf(address addr, uint256 ts) external view returns (uint256);
    function totalSupply(uint256 ts) external view returns (uint256);
} 