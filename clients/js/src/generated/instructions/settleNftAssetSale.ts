/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import {
  Context,
  Pda,
  PublicKey,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  array,
  mapSerializer,
  Serializer,
  struct,
  u32,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  expectPublicKey,
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';

// Accounts.
export type SettleNftAssetSaleInstructionAccounts = {
  settleAccounts: PublicKey | Pda;
  mint: PublicKey | Pda;
  tokenAccount: PublicKey | Pda;
  /** Nft token account for buyer */
  buyerTokenAccount: PublicKey | Pda;
  metadata?: PublicKey | Pda;
  tokenMetadataProgram?: PublicKey | Pda;
};

// Data.
export type SettleNftAssetSaleInstructionData = {
  discriminator: Array<number>;
  index: number;
};

export type SettleNftAssetSaleInstructionDataArgs = { index: number };

export function getSettleNftAssetSaleInstructionDataSerializer(): Serializer<
  SettleNftAssetSaleInstructionDataArgs,
  SettleNftAssetSaleInstructionData
> {
  return mapSerializer<
    SettleNftAssetSaleInstructionDataArgs,
    any,
    SettleNftAssetSaleInstructionData
  >(
    struct<SettleNftAssetSaleInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['index', u32()],
      ],
      { description: 'SettleNftAssetSaleInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [74, 68, 135, 142, 144, 227, 213, 44],
    })
  ) as Serializer<
    SettleNftAssetSaleInstructionDataArgs,
    SettleNftAssetSaleInstructionData
  >;
}

// Args.
export type SettleNftAssetSaleInstructionArgs =
  SettleNftAssetSaleInstructionDataArgs;

// Instruction.
export function settleNftAssetSale(
  context: Pick<Context, 'eddsa' | 'programs'>,
  input: SettleNftAssetSaleInstructionAccounts &
    SettleNftAssetSaleInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachineCore',
    'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    settleAccounts: {
      index: 0,
      isWritable: false,
      value: input.settleAccounts ?? null,
    },
    mint: { index: 1, isWritable: false, value: input.mint ?? null },
    tokenAccount: {
      index: 2,
      isWritable: true,
      value: input.tokenAccount ?? null,
    },
    buyerTokenAccount: {
      index: 3,
      isWritable: true,
      value: input.buyerTokenAccount ?? null,
    },
    metadata: { index: 4, isWritable: false, value: input.metadata ?? null },
    tokenMetadataProgram: {
      index: 5,
      isWritable: false,
      value: input.tokenMetadataProgram ?? null,
    },
  };

  // Arguments.
  const resolvedArgs: SettleNftAssetSaleInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.metadata.value) {
    resolvedAccounts.metadata.value = findMetadataPda(context, {
      mint: expectPublicKey(resolvedAccounts.mint.value),
    });
  }
  if (!resolvedAccounts.tokenMetadataProgram.value) {
    resolvedAccounts.tokenMetadataProgram.value = context.programs.getPublicKey(
      'mplTokenMetadata',
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
    );
    resolvedAccounts.tokenMetadataProgram.isWritable = false;
  }

  // Accounts in order.
  const orderedAccounts: ResolvedAccount[] = Object.values(
    resolvedAccounts
  ).sort((a, b) => a.index - b.index);

  // Keys and Signers.
  const [keys, signers] = getAccountMetasAndSigners(
    orderedAccounts,
    'programId',
    programId
  );

  // Data.
  const data = getSettleNftAssetSaleInstructionDataSerializer().serialize(
    resolvedArgs as SettleNftAssetSaleInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
