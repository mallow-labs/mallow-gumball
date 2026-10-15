import {
  Context,
  defaultPublicKey,
  isSome,
  PublicKey,
  publicKey,
  publicKeyBytes,
  Signer,
  TransactionBuilder,
  unwrapOption,
} from '@metaplex-foundation/umi';
import { array, mergeBytes, u16 } from '@metaplex-foundation/umi/serializers';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  adminRefundCnftSaleV2,
  claimCnftV2,
  findGlobalConfigPda,
  getAdminRefundCnftSaleV2InstructionDataSerializer,
  getCnftArgsV2Serializer,
  getCnftCreatorSerializer,
} from './generated';
import { findGumballMachineAuthorityPda } from './hooked';

import { getMissingCnftV2TreeEvidence } from './cnftV2TreeEvidence';

/** Prepare recovery only after the same escrow claim fails simulation. */
export async function prepareAdminRefundCnftSaleV2(
  context: Context,
  input: {
    authority: Signer;
    claim: Parameters<typeof claimCnftV2>[1];
    refund: Parameters<typeof adminRefundCnftSaleV2>[1];
    proof: PublicKey[];
  }
): Promise<TransactionBuilder> {
  const { claim, refund, authority, proof } = input;
  const refundData =
    getAdminRefundCnftSaleV2InstructionDataSerializer().deserialize(
      getAdminRefundCnftSaleV2InstructionDataSerializer().serialize(refund)
    )[0];
  const args = getCnftArgsV2Serializer().deserialize(
    getCnftArgsV2Serializer().serialize(claim.args)
  )[0];
  const equalBytes = (a: Uint8Array, b: Uint8Array) =>
    a.length === b.length && a.every((value, index) => value === b[index]);
  const escrow = findGumballMachineAuthorityPda(context, {
    gumballMachine: publicKey(refund.gumballMachine),
  })[0];
  if (
    publicKey(claim.gumballMachine) !== publicKey(refund.gumballMachine) ||
    publicKey(claim.merkleTree) !== publicKey(refund.merkleTree) ||
    publicKey(claim.seller) !== publicKey(refund.seller ?? context.identity) ||
    !refund.buyer ||
    publicKey(claim.buyer ?? context.identity) !== publicKey(refund.buyer) ||
    claim.index !== refund.index ||
    args.version !== 2 ||
    args.nonce !== refundData.nonce ||
    BigInt(args.index) !== refundData.nonce ||
    !equalBytes(args.root, refundData.root)
  ) {
    throw new Error(
      'Admin refund must simulate the same recorded draw and current proof'
    );
  }
  const missingLeaf = !isSome(refundData.leaf);
  if (!isSome(refundData.leaf)) {
    if (proof.length !== 0 || refundData.root.some((byte) => byte !== 0)) {
      throw new Error(
        'Missing-tree admin refund requires a zero root and no proof'
      );
    }
    if (
      !(await getMissingCnftV2TreeEvidence(
        context,
        publicKey(refund.merkleTree),
        args.index
      ))
    ) {
      throw new Error(
        'Missing-tree admin refund requires an absent recorded leaf slot'
      );
    }
  } else {
    const leaf = refundData.leaf.value;
    if (
      leaf.owner !== escrow ||
      !equalBytes(
        leaf.dataHash,
        keccak_256(
          mergeBytes([
            args.metaHash,
            u16().serialize(args.sellerFeeBasisPoints),
          ])
        )
      ) ||
      !equalBytes(
        leaf.creatorHash,
        keccak_256(
          array(getCnftCreatorSerializer(), { size: 'remainder' }).serialize(
            args.creators
          )
        )
      ) ||
      !equalBytes(
        leaf.collectionHash,
        keccak_256(
          publicKeyBytes(publicKey(claim.coreCollection ?? defaultPublicKey()))
        )
      ) ||
      !equalBytes(
        leaf.assetDataHash,
        unwrapOption(args.assetDataHash, () => keccak_256(new Uint8Array()))
      ) ||
      leaf.flags !== args.flags
    ) {
      throw new Error(
        'Admin refund claim metadata must match the proof-verified leaf'
      );
    }
  }
  const proofAccounts = proof.map((pubkey) => ({
    pubkey,
    isSigner: false,
    isWritable: false,
  }));
  const transaction = await claimCnftV2(context, claim)
    .addRemainingAccounts(proofAccounts)
    .buildAndSign(context);
  const simulation = await context.rpc.simulateTransaction(transaction);
  if (simulation.err === null) {
    throw new Error(
      'Compressed NFT claim succeeds; admin refund is not permitted'
    );
  }
  const logs = simulation.logs ?? [];
  if (
    (!(missingLeaf && logs.some((line) => /Error Number: 6069/.test(line))) &&
      !logs.some((line) =>
        line.startsWith(
          'Program BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY invoke'
        )
      )) ||
    logs.some((line) => /insufficient (lamports|funds)/i.test(line))
  ) {
    throw new Error(
      'Admin refund requires a failed Bubblegum delivery, not an invalid or unfunded claim'
    );
  }
  return adminRefundCnftSaleV2(context, refund).addRemainingAccounts([
    { signer: authority, isWritable: false },
    {
      pubkey: findGlobalConfigPda(context)[0],
      isSigner: false,
      isWritable: false,
    },
    ...proofAccounts,
  ]);
}
