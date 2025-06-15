import { type Abi, encodeFunctionData } from 'viem';

// Minimal ABIs for the contracts we need to interact with
export const MULTISIG_ABI = [
  {
    type: 'function',
    name: 'propose',
    inputs: [
      { name: 'target', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'id', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [{ name: 'id', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const; // Use 'as const' for better type inference with viem

export const REWARD_DISTRIBUTOR_ABI = [
  {
    type: 'function',
    name: 'withdrawProtocolFees',
    inputs: [
      { name: 'recipient', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const SUBSCRIPTION_MANAGER_ABI = [
  {
    type: 'function',
    name: 'activatePlan',
    inputs: [
      { name: 'user', type: 'address', internalType: 'address' },
      { name: 'planId', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * Encodes the calldata for a `withdrawProtocolFees` proposal.
 * @param recipient The address to receive the fees.
 * @param amount The amount of tokens to withdraw (as a bigint).
 * @returns The encoded calldata (0x...).
 */
export function encodeWithdraw(recipient: `0x${string}`, amount: bigint) {
  return encodeFunctionData({
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'withdrawProtocolFees',
    args: [recipient, amount],
  });
} 