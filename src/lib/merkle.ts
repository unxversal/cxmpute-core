import { keccak256, toUtf8Bytes } from "ethers";

export interface LeafInput {
  address: string;
  amount: bigint; // in token wei
}

export interface MerkleResult {
  root: string; // 0x...
  leaves: string[]; // hashed leaves in order
}

/**
 * Build a Merkle tree whose leaf = keccak256(abi.encodePacked(addr, amount)).
 * Uses simple pairwise hashing, sorted pairs (ETH merkle airdrop convention).
 */
export function buildMerkle(leavesIn: LeafInput[]): MerkleResult {
  if (leavesIn.length === 0) throw new Error("no leaves");
  const leafHashes = leavesIn.map((l) => keccak256(solidityLeaf(l.address, l.amount)));
  let level: string[] = [...leafHashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      const [a, b] = left.toLowerCase() < right.toLowerCase() ? [left, right] : [right, left];
      const concatenated = a + b.slice(2); // remove 0x from second
      next.push(keccak256(concatenated));
    }
    level = next;
  }
  return { root: level[0], leaves: leafHashes };
}

function solidityLeaf(addr: string, amount: bigint): Uint8Array {
  const addrBytes = addr.toLowerCase().replace("0x", "");
  const amountHex = amount.toString(16).padStart(64, "0");
  const data = "0x" + addrBytes + amountHex;
  return toUtf8Bytes(data);
}

/* eslint-disable @typescript-eslint/no-unused-vars */ 