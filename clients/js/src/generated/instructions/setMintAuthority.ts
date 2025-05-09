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
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type SetMintAuthorityInstructionAccounts = {
  /** Gumball Machine account. */
  gumballMachine: PublicKey | Pda;
  /** Gumball Machine authority */
  authority?: Signer;
  /** New gumball machine authority */
  mintAuthority?: Signer;
};

// Data.
export type SetMintAuthorityInstructionData = { discriminator: Array<number> };

export type SetMintAuthorityInstructionDataArgs = {};

export function getSetMintAuthorityInstructionDataSerializer(): Serializer<
  SetMintAuthorityInstructionDataArgs,
  SetMintAuthorityInstructionData
> {
  return mapSerializer<
    SetMintAuthorityInstructionDataArgs,
    any,
    SetMintAuthorityInstructionData
  >(
    struct<SetMintAuthorityInstructionData>(
      [['discriminator', array(u8(), { size: 8 })]],
      { description: 'SetMintAuthorityInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [67, 127, 155, 187, 100, 174, 103, 121],
    })
  ) as Serializer<
    SetMintAuthorityInstructionDataArgs,
    SetMintAuthorityInstructionData
  >;
}

// Instruction.
export function setMintAuthority(
  context: Pick<Context, 'identity' | 'programs'>,
  input: SetMintAuthorityInstructionAccounts
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mallowGumball',
    'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    gumballMachine: {
      index: 0,
      isWritable: true,
      value: input.gumballMachine ?? null,
    },
    authority: { index: 1, isWritable: false, value: input.authority ?? null },
    mintAuthority: {
      index: 2,
      isWritable: false,
      value: input.mintAuthority ?? null,
    },
  };

  // Default values.
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity;
  }
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
  const data = getSetMintAuthorityInstructionDataSerializer().serialize({});

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
