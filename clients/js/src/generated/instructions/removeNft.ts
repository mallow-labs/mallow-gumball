/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { findMasterEditionPda } from '@metaplex-foundation/mpl-token-metadata';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  mapSerializer,
  struct,
  u32,
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
export type RemoveNftInstructionAccounts = {
  /** Candy Machine account. */
  candyMachine: PublicKey | Pda;
  authorityPda?: PublicKey | Pda;
  /** Authority allowed to remove the nft (must be the candy machine auth or the seller of the nft) */
  authority?: Signer;
  mint: PublicKey | Pda;
  tokenAccount?: PublicKey | Pda;
  tmpTokenAccount?: PublicKey | Pda;
  edition?: PublicKey | Pda;
  tokenProgram?: PublicKey | Pda;
  associatedTokenProgram?: PublicKey | Pda;
  tokenMetadataProgram?: PublicKey | Pda;
  systemProgram?: PublicKey | Pda;
  rent?: PublicKey | Pda;
};

// Data.
export type RemoveNftInstructionData = {
  discriminator: Array<number>;
  index: number;
};

export type RemoveNftInstructionDataArgs = { index: number };

export function getRemoveNftInstructionDataSerializer(): Serializer<
  RemoveNftInstructionDataArgs,
  RemoveNftInstructionData
> {
  return mapSerializer<
    RemoveNftInstructionDataArgs,
    any,
    RemoveNftInstructionData
  >(
    struct<RemoveNftInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['index', u32()],
      ],
      { description: 'RemoveNftInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [22, 52, 77, 58, 242, 146, 178, 20],
    })
  ) as Serializer<RemoveNftInstructionDataArgs, RemoveNftInstructionData>;
}

// Args.
export type RemoveNftInstructionArgs = RemoveNftInstructionDataArgs;

// Instruction.
export function removeNft(
  context: Pick<Context, 'eddsa' | 'identity' | 'programs'>,
  input: RemoveNftInstructionAccounts & RemoveNftInstructionArgs
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
    authority: { index: 2, isWritable: false, value: input.authority ?? null },
    mint: { index: 3, isWritable: false, value: input.mint ?? null },
    tokenAccount: {
      index: 4,
      isWritable: true,
      value: input.tokenAccount ?? null,
    },
    tmpTokenAccount: {
      index: 5,
      isWritable: true,
      value: input.tmpTokenAccount ?? null,
    },
    edition: { index: 6, isWritable: false, value: input.edition ?? null },
    tokenProgram: {
      index: 7,
      isWritable: false,
      value: input.tokenProgram ?? null,
    },
    associatedTokenProgram: {
      index: 8,
      isWritable: false,
      value: input.associatedTokenProgram ?? null,
    },
    tokenMetadataProgram: {
      index: 9,
      isWritable: false,
      value: input.tokenMetadataProgram ?? null,
    },
    systemProgram: {
      index: 10,
      isWritable: false,
      value: input.systemProgram ?? null,
    },
    rent: { index: 11, isWritable: false, value: input.rent ?? null },
  };

  // Arguments.
  const resolvedArgs: RemoveNftInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.authorityPda.value) {
    resolvedAccounts.authorityPda.value = findCandyMachineAuthorityPda(
      context,
      { candyMachine: expectPublicKey(resolvedAccounts.candyMachine.value) }
    );
  }
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity;
  }
  if (!resolvedAccounts.tokenAccount.value) {
    resolvedAccounts.tokenAccount.value = findAssociatedTokenPda(context, {
      mint: expectPublicKey(resolvedAccounts.mint.value),
      owner: expectPublicKey(resolvedAccounts.authority.value),
    });
  }
  if (!resolvedAccounts.tmpTokenAccount.value) {
    resolvedAccounts.tmpTokenAccount.value = findAssociatedTokenPda(context, {
      mint: expectPublicKey(resolvedAccounts.mint.value),
      owner: expectPublicKey(resolvedAccounts.authorityPda.value),
    });
  }
  if (!resolvedAccounts.edition.value) {
    resolvedAccounts.edition.value = findMasterEditionPda(context, {
      mint: expectPublicKey(resolvedAccounts.mint.value),
    });
  }
  if (!resolvedAccounts.tokenProgram.value) {
    resolvedAccounts.tokenProgram.value = context.programs.getPublicKey(
      'splToken',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    );
    resolvedAccounts.tokenProgram.isWritable = false;
  }
  if (!resolvedAccounts.associatedTokenProgram.value) {
    resolvedAccounts.associatedTokenProgram.value =
      context.programs.getPublicKey(
        'splAssociatedToken',
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
      );
    resolvedAccounts.associatedTokenProgram.isWritable = false;
  }
  if (!resolvedAccounts.tokenMetadataProgram.value) {
    resolvedAccounts.tokenMetadataProgram.value = context.programs.getPublicKey(
      'mplTokenMetadata',
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
    );
    resolvedAccounts.tokenMetadataProgram.isWritable = false;
  }
  if (!resolvedAccounts.systemProgram.value) {
    resolvedAccounts.systemProgram.value = context.programs.getPublicKey(
      'splSystem',
      '11111111111111111111111111111111'
    );
    resolvedAccounts.systemProgram.isWritable = false;
  }
  if (!resolvedAccounts.rent.value) {
    resolvedAccounts.rent.value = publicKey(
      'SysvarRent111111111111111111111111111111111'
    );
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
  const data = getRemoveNftInstructionDataSerializer().serialize(
    resolvedArgs as RemoveNftInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
