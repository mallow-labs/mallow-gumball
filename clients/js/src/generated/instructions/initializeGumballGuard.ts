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
  bytes,
  mapSerializer,
  Serializer,
  struct,
  u32,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { findGumballGuardPda } from '../../hooked';
import {
  expectPublicKey,
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';

// Accounts.
export type InitializeGumballGuardInstructionAccounts = {
  gumballGuard?: PublicKey | Pda;
  base: Signer;
  authority?: PublicKey | Pda;
  payer?: Signer;
  systemProgram?: PublicKey | Pda;
};

// Data.
export type InitializeGumballGuardInstructionData = {
  discriminator: Array<number>;
  data: Uint8Array;
};

export type InitializeGumballGuardInstructionDataArgs = { data: Uint8Array };

export function getInitializeGumballGuardInstructionDataSerializer(): Serializer<
  InitializeGumballGuardInstructionDataArgs,
  InitializeGumballGuardInstructionData
> {
  return mapSerializer<
    InitializeGumballGuardInstructionDataArgs,
    any,
    InitializeGumballGuardInstructionData
  >(
    struct<InitializeGumballGuardInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['data', bytes({ size: u32() })],
      ],
      { description: 'InitializeGumballGuardInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
    })
  ) as Serializer<
    InitializeGumballGuardInstructionDataArgs,
    InitializeGumballGuardInstructionData
  >;
}

// Args.
export type InitializeGumballGuardInstructionArgs =
  InitializeGumballGuardInstructionDataArgs;

// Instruction.
export function initializeGumballGuard(
  context: Pick<Context, 'eddsa' | 'identity' | 'payer' | 'programs'>,
  input: InitializeGumballGuardInstructionAccounts &
    InitializeGumballGuardInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyGuard',
    'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    gumballGuard: {
      index: 0,
      isWritable: true,
      value: input.gumballGuard ?? null,
    },
    base: { index: 1, isWritable: false, value: input.base ?? null },
    authority: { index: 2, isWritable: false, value: input.authority ?? null },
    payer: { index: 3, isWritable: true, value: input.payer ?? null },
    systemProgram: {
      index: 4,
      isWritable: false,
      value: input.systemProgram ?? null,
    },
  };

  // Arguments.
  const resolvedArgs: InitializeGumballGuardInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.gumballGuard.value) {
    resolvedAccounts.gumballGuard.value = findGumballGuardPda(context, {
      base: expectPublicKey(resolvedAccounts.base.value),
    });
  }
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity.publicKey;
  }
  if (!resolvedAccounts.payer.value) {
    resolvedAccounts.payer.value = context.payer;
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
  const data = getInitializeGumballGuardInstructionDataSerializer().serialize(
    resolvedArgs as InitializeGumballGuardInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}