/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  none,
  Option,
  OptionOrNullable,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  array,
  bytes,
  mapSerializer,
  option,
  Serializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { findGumballMachineAuthorityPda } from '../../hooked';
import { findSellerHistoryPda } from '../accounts';
import {
  expectPublicKey,
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';

// Accounts.
export type AddCoreAssetInstructionAccounts = {
  /** Gumball Machine account. */
  gumballMachine: PublicKey | Pda;
  /** Seller history account. */
  sellerHistory?: PublicKey | Pda;
  authorityPda?: PublicKey | Pda;
  /** Seller of the asset. */
  seller?: Signer;
  asset: PublicKey | Pda;
  /** Core asset's collection if it's part of one. */
  collection?: PublicKey | Pda;
  mplCoreProgram?: PublicKey | Pda;
  systemProgram?: PublicKey | Pda;
};

// Data.
export type AddCoreAssetInstructionData = {
  discriminator: Array<number>;
  sellerProofPath: Option<Array<Uint8Array>>;
};

export type AddCoreAssetInstructionDataArgs = {
  sellerProofPath?: OptionOrNullable<Array<Uint8Array>>;
};

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
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['sellerProofPath', option(array(bytes({ size: 32 })))],
      ],
      { description: 'AddCoreAssetInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [30, 144, 222, 2, 197, 195, 17, 163],
      sellerProofPath: value.sellerProofPath ?? none(),
    })
  ) as Serializer<AddCoreAssetInstructionDataArgs, AddCoreAssetInstructionData>;
}

// Args.
export type AddCoreAssetInstructionArgs = AddCoreAssetInstructionDataArgs;

// Instruction.
export function addCoreAsset(
  context: Pick<Context, 'eddsa' | 'identity' | 'programs'>,
  input: AddCoreAssetInstructionAccounts & AddCoreAssetInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachine',
    'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    gumballMachine: {
      index: 0,
      isWritable: true,
      value: input.gumballMachine ?? null,
    },
    sellerHistory: {
      index: 1,
      isWritable: true,
      value: input.sellerHistory ?? null,
    },
    authorityPda: {
      index: 2,
      isWritable: true,
      value: input.authorityPda ?? null,
    },
    seller: { index: 3, isWritable: true, value: input.seller ?? null },
    asset: { index: 4, isWritable: true, value: input.asset ?? null },
    collection: { index: 5, isWritable: true, value: input.collection ?? null },
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

  // Arguments.
  const resolvedArgs: AddCoreAssetInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.seller.value) {
    resolvedAccounts.seller.value = context.identity;
  }
  if (!resolvedAccounts.sellerHistory.value) {
    resolvedAccounts.sellerHistory.value = findSellerHistoryPda(context, {
      gumballMachine: expectPublicKey(resolvedAccounts.gumballMachine.value),
      seller: expectPublicKey(resolvedAccounts.seller.value),
    });
  }
  if (!resolvedAccounts.authorityPda.value) {
    resolvedAccounts.authorityPda.value = findGumballMachineAuthorityPda(
      context,
      { gumballMachine: expectPublicKey(resolvedAccounts.gumballMachine.value) }
    );
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
  const data = getAddCoreAssetInstructionDataSerializer().serialize(
    resolvedArgs as AddCoreAssetInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
