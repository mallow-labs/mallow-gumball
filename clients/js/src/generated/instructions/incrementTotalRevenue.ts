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
  array,
  mapSerializer,
  Serializer,
  struct,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';

// Accounts.
export type IncrementTotalRevenueInstructionAccounts = {
  /** Candy machine account. */
  candyMachine: PublicKey | Pda;
  /** Candy machine mint authority (mint only allowed for the mint_authority). */
  mintAuthority?: Signer;
};

// Data.
export type IncrementTotalRevenueInstructionData = {
  discriminator: Array<number>;
  revenue: bigint;
};

export type IncrementTotalRevenueInstructionDataArgs = {
  revenue: number | bigint;
};

export function getIncrementTotalRevenueInstructionDataSerializer(): Serializer<
  IncrementTotalRevenueInstructionDataArgs,
  IncrementTotalRevenueInstructionData
> {
  return mapSerializer<
    IncrementTotalRevenueInstructionDataArgs,
    any,
    IncrementTotalRevenueInstructionData
  >(
    struct<IncrementTotalRevenueInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['revenue', u64()],
      ],
      { description: 'IncrementTotalRevenueInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [197, 168, 14, 157, 91, 203, 104, 102],
    })
  ) as Serializer<
    IncrementTotalRevenueInstructionDataArgs,
    IncrementTotalRevenueInstructionData
  >;
}

// Args.
export type IncrementTotalRevenueInstructionArgs =
  IncrementTotalRevenueInstructionDataArgs;

// Instruction.
export function incrementTotalRevenue(
  context: Pick<Context, 'identity' | 'programs'>,
  input: IncrementTotalRevenueInstructionAccounts &
    IncrementTotalRevenueInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachine',
    'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    candyMachine: {
      index: 0,
      isWritable: true,
      value: input.candyMachine ?? null,
    },
    mintAuthority: {
      index: 1,
      isWritable: false,
      value: input.mintAuthority ?? null,
    },
  };

  // Arguments.
  const resolvedArgs: IncrementTotalRevenueInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.mintAuthority.value) {
    resolvedAccounts.mintAuthority.value = context.identity;
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
  const data = getIncrementTotalRevenueInstructionDataSerializer().serialize(
    resolvedArgs as IncrementTotalRevenueInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
