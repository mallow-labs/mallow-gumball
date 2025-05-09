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
export type EndSaleInstructionAccounts = {
  /** Gumball machine account. */
  gumballMachine: PublicKey | Pda;
  /** Gumball Machine authority. This is the address that controls the upate of the gumball machine. */
  authority?: Signer;
};

// Data.
export type EndSaleInstructionData = { discriminator: Array<number> };

export type EndSaleInstructionDataArgs = {};

export function getEndSaleInstructionDataSerializer(): Serializer<
  EndSaleInstructionDataArgs,
  EndSaleInstructionData
> {
  return mapSerializer<EndSaleInstructionDataArgs, any, EndSaleInstructionData>(
    struct<EndSaleInstructionData>(
      [['discriminator', array(u8(), { size: 8 })]],
      { description: 'EndSaleInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [37, 239, 52, 17, 120, 44, 213, 125],
    })
  ) as Serializer<EndSaleInstructionDataArgs, EndSaleInstructionData>;
}

// Instruction.
export function endSale(
  context: Pick<Context, 'identity' | 'programs'>,
  input: EndSaleInstructionAccounts
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
    authority: { index: 1, isWritable: true, value: input.authority ?? null },
  };

  // Default values.
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity;
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
  const data = getEndSaleInstructionDataSerializer().serialize({});

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
