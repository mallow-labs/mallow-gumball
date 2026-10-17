import {
  Context,
  PublicKey,
  publicKey,
  publicKeyBytes,
} from '@metaplex-foundation/umi';

const MPL_COMPRESSION = publicKey(
  'mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW'
);
const SPL_COMPRESSION = publicKey(
  'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
);

const missingTreeSlot = (data: Uint8Array, index: number): boolean => {
  if (data.length < 80 || data[0] !== 1 || data[1] !== 0) return true;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const buffer = view.getUint32(2, true);
  const depth = view.getUint32(6, true);
  if (
    depth === 0 ||
    depth > 30 ||
    buffer < 8 ||
    buffer > 2048 ||
    // eslint-disable-next-line no-bitwise
    (buffer & (buffer - 1)) !== 0
  )
    return true;
  const rightmost = 80 + buffer * (40 + 32 * depth) + 32 * (depth + 1);
  if (data.length < rightmost + 8) return true;
  const active = view.getBigUint64(64, true);
  const used = view.getBigUint64(72, true);
  return (
    active >= BigInt(buffer) ||
    used === 0n ||
    used > BigInt(buffer) ||
    index >= 2 ** depth ||
    index >= view.getUint32(rightmost, true)
  );
};

// Full tree reads are confined to operator exits. Authority mismatch is only
// off-chain admin evidence; it never widens the permissionless program predicate.
export async function getMissingCnftV2TreeEvidence(
  context: Pick<Context, 'rpc' | 'eddsa'>,
  merkleTree: PublicKey,
  index: number
): Promise<'missing' | 'replacement' | null> {
  const tree = await context.rpc.getAccount(merkleTree);
  if (
    !tree.exists ||
    (tree.owner !== MPL_COMPRESSION && tree.owner !== SPL_COMPRESSION)
  )
    return 'missing';
  if (missingTreeSlot(tree.data, index)) return 'missing';
  // An occupied SPL slot may be a deliverable v1 item, even though claim_v2 fails.
  if (tree.owner === SPL_COMPRESSION) return null;
  const config = context.eddsa.findPda(
    publicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY'),
    [publicKeyBytes(merkleTree)]
  )[0];
  const expected = publicKeyBytes(config);
  return expected.every((byte, offset) => tree.data[10 + offset] === byte)
    ? null
    : 'replacement';
}
