/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  mapSerializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { findCandyMachineAuthorityPda } from '../../hooked';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  expectPublicKey,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type AddCoreAssetInstructionAccounts = {
  /** Candy Machine account. */
  candyMachine: PublicKey | Pda;
  authorityPda?: PublicKey | Pda;
  /** Seller of the asset. */
  seller?: Signer;
  asset: PublicKey | Pda;
  /** Core asset's collection if it's part of one. */
  collection?: PublicKey | Pda;
  allowlist?: PublicKey | Pda;
  mplCoreProgram?: PublicKey | Pda;
  systemProgram?: PublicKey | Pda;
};

// Data.
export type AddCoreAssetInstructionData = { discriminator: Array<number> };

export type AddCoreAssetInstructionDataArgs = {};

export function getAddCoreAssetInstructionDataSerializer(): Serializer<
  AddCoreAssetInstructionDataArgs,
  AddCoreAssetInstructionData
> {
  return mapSerializer<
    AddCoreAssetInstructionDataArgs,
    any,
    AddCoreAssetInstructionData
  >(
    struct<AddCoreAssetInstructionData>(
      [['discriminator', array(u8(), { size: 8 })]],
      { description: 'AddCoreAssetInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [30, 144, 222, 2, 197, 195, 17, 163],
    })
  ) as Serializer<AddCoreAssetInstructionDataArgs, AddCoreAssetInstructionData>;
}

// Instruction.
export function addCoreAsset(
  context: Pick<Context, 'eddsa' | 'identity' | 'programs'>,
  input: AddCoreAssetInstructionAccounts
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachineCore',
    'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    candyMachine: {
      index: 0,
      isWritable: true,
      value: input.candyMachine ?? null,
    },
    authorityPda: {
      index: 1,
      isWritable: true,
      value: input.authorityPda ?? null,
    },
    seller: { index: 2, isWritable: false, value: input.seller ?? null },
    asset: { index: 3, isWritable: true, value: input.asset ?? null },
    collection: { index: 4, isWritable: true, value: input.collection ?? null },
    allowlist: { index: 5, isWritable: false, value: input.allowlist ?? null },
    mplCoreProgram: {
      index: 6,
      isWritable: false,
      value: input.mplCoreProgram ?? null,
    },
    systemProgram: {
      index: 7,
      isWritable: false,
      value: input.systemProgram ?? null,
    },
  };

  // Default values.
  if (!resolvedAccounts.authorityPda.value) {
    resolvedAccounts.authorityPda.value = findCandyMachineAuthorityPda(
      context,
      { candyMachine: expectPublicKey(resolvedAccounts.candyMachine.value) }
    );
  }
  if (!resolvedAccounts.seller.value) {
    resolvedAccounts.seller.value = context.identity;
  }
  if (!resolvedAccounts.mplCoreProgram.value) {
    resolvedAccounts.mplCoreProgram.value = context.programs.getPublicKey(
      'mplCoreProgram',
      'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'
    );
    resolvedAccounts.mplCoreProgram.isWritable = false;
  }
  if (!resolvedAccounts.systemProgram.value) {
    resolvedAccounts.systemProgram.value = context.programs.getPublicKey(
      'splSystem',
      '11111111111111111111111111111111'
    );
    resolvedAccounts.systemProgram.isWritable = false;
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
  const data = getAddCoreAssetInstructionDataSerializer().serialize({});

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
