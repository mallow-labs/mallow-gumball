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
  u8,
} from '@metaplex-foundation/umi/serializers';
import { findGumballMachineAuthorityPda } from '../../hooked';
import {
  expectPublicKey,
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';

// Accounts.
export type DeleteGumballGuardInstructionAccounts = {
  gumballGuard: PublicKey | Pda;
  authority?: Signer;
  gumballMachine: PublicKey | Pda;
  authorityPda?: PublicKey | Pda;
  /** Payment account for authority pda if using token payment */
  authorityPdaPaymentAccount?: PublicKey | Pda;
  gumballMachineProgram?: PublicKey | Pda;
  tokenProgram?: PublicKey | Pda;
};

// Data.
export type DeleteGumballGuardInstructionData = {
  discriminator: Array<number>;
};

export type DeleteGumballGuardInstructionDataArgs = {};

export function getDeleteGumballGuardInstructionDataSerializer(): Serializer<
  DeleteGumballGuardInstructionDataArgs,
  DeleteGumballGuardInstructionData
> {
  return mapSerializer<
    DeleteGumballGuardInstructionDataArgs,
    any,
    DeleteGumballGuardInstructionData
  >(
    struct<DeleteGumballGuardInstructionData>(
      [['discriminator', array(u8(), { size: 8 })]],
      { description: 'DeleteGumballGuardInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34],
    })
  ) as Serializer<
    DeleteGumballGuardInstructionDataArgs,
    DeleteGumballGuardInstructionData
  >;
}

// Instruction.
export function deleteGumballGuard(
  context: Pick<Context, 'eddsa' | 'identity' | 'programs'>,
  input: DeleteGumballGuardInstructionAccounts
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'gumballGuard',
    'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    gumballGuard: {
      index: 0,
      isWritable: true,
      value: input.gumballGuard ?? null,
    },
    authority: { index: 1, isWritable: true, value: input.authority ?? null },
    gumballMachine: {
      index: 2,
      isWritable: true,
      value: input.gumballMachine ?? null,
    },
    authorityPda: {
      index: 3,
      isWritable: true,
      value: input.authorityPda ?? null,
    },
    authorityPdaPaymentAccount: {
      index: 4,
      isWritable: true,
      value: input.authorityPdaPaymentAccount ?? null,
    },
    gumballMachineProgram: {
      index: 5,
      isWritable: false,
      value: input.gumballMachineProgram ?? null,
    },
    tokenProgram: {
      index: 6,
      isWritable: false,
      value: input.tokenProgram ?? null,
    },
  };

  // Default values.
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity;
  }
  if (!resolvedAccounts.authorityPda.value) {
    resolvedAccounts.authorityPda.value = findGumballMachineAuthorityPda(
      context,
      { gumballMachine: expectPublicKey(resolvedAccounts.gumballMachine.value) }
    );
  }
  if (!resolvedAccounts.gumballMachineProgram.value) {
    resolvedAccounts.gumballMachineProgram.value =
      context.programs.getPublicKey(
        'mallowGumball',
        'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
      );
    resolvedAccounts.gumballMachineProgram.isWritable = false;
  }
  if (!resolvedAccounts.tokenProgram.value) {
    resolvedAccounts.tokenProgram.value = context.programs.getPublicKey(
      'splToken',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    );
    resolvedAccounts.tokenProgram.isWritable = false;
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
  const data = getDeleteGumballGuardInstructionDataSerializer().serialize({});

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
