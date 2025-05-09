/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

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
import {
  findEventAuthorityPda,
  findGumballMachineAuthorityPda,
} from '../../hooked';
import { findSellerHistoryPda } from '../accounts';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  expectPublicKey,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type SettleTokensSaleClaimedInstructionAccounts = {
  /** Anyone can settle the sale */
  payer?: Signer;
  /** Gumball machine account. */
  gumballMachine: PublicKey | Pda;
  authorityPda?: PublicKey | Pda;
  /** Payment account for authority pda if using token payment */
  authorityPdaPaymentAccount?: PublicKey | Pda;
  /** Seller of the tokens */
  authority?: PublicKey | Pda;
  /** Payment account for authority if using token payment */
  authorityPaymentAccount?: PublicKey | Pda;
  /** Seller of the item */
  seller: PublicKey | Pda;
  /** Payment account for seller if using token payment */
  sellerPaymentAccount?: PublicKey | Pda;
  /** Seller history account. */
  sellerHistory?: PublicKey | Pda;
  /** Payment mint if using non-native payment token */
  paymentMint?: PublicKey | Pda;
  tokenProgram?: PublicKey | Pda;
  associatedTokenProgram?: PublicKey | Pda;
  systemProgram?: PublicKey | Pda;
  rent?: PublicKey | Pda;
  mint: PublicKey | Pda;
  sellerTokenAccount?: PublicKey | Pda;
  authorityPdaTokenAccount?: PublicKey | Pda;
  eventAuthority?: PublicKey | Pda;
  program?: PublicKey | Pda;
};

// Data.
export type SettleTokensSaleClaimedInstructionData = {
  discriminator: Array<number>;
  startIndex: number;
  endIndex: number;
};

export type SettleTokensSaleClaimedInstructionDataArgs = {
  startIndex: number;
  endIndex: number;
};

export function getSettleTokensSaleClaimedInstructionDataSerializer(): Serializer<
  SettleTokensSaleClaimedInstructionDataArgs,
  SettleTokensSaleClaimedInstructionData
> {
  return mapSerializer<
    SettleTokensSaleClaimedInstructionDataArgs,
    any,
    SettleTokensSaleClaimedInstructionData
  >(
    struct<SettleTokensSaleClaimedInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['startIndex', u32()],
        ['endIndex', u32()],
      ],
      { description: 'SettleTokensSaleClaimedInstructionData' }
    ),
    (value) => ({ ...value, discriminator: [78, 10, 170, 112, 84, 2, 243, 13] })
  ) as Serializer<
    SettleTokensSaleClaimedInstructionDataArgs,
    SettleTokensSaleClaimedInstructionData
  >;
}

// Args.
export type SettleTokensSaleClaimedInstructionArgs =
  SettleTokensSaleClaimedInstructionDataArgs;

// Instruction.
export function settleTokensSaleClaimed(
  context: Pick<Context, 'eddsa' | 'identity' | 'payer' | 'programs'>,
  input: SettleTokensSaleClaimedInstructionAccounts &
    SettleTokensSaleClaimedInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mallowGumball',
    'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    payer: { index: 0, isWritable: true, value: input.payer ?? null },
    gumballMachine: {
      index: 1,
      isWritable: true,
      value: input.gumballMachine ?? null,
    },
    authorityPda: {
      index: 2,
      isWritable: true,
      value: input.authorityPda ?? null,
    },
    authorityPdaPaymentAccount: {
      index: 3,
      isWritable: true,
      value: input.authorityPdaPaymentAccount ?? null,
    },
    authority: { index: 4, isWritable: true, value: input.authority ?? null },
    authorityPaymentAccount: {
      index: 5,
      isWritable: true,
      value: input.authorityPaymentAccount ?? null,
    },
    seller: { index: 6, isWritable: true, value: input.seller ?? null },
    sellerPaymentAccount: {
      index: 7,
      isWritable: true,
      value: input.sellerPaymentAccount ?? null,
    },
    sellerHistory: {
      index: 8,
      isWritable: true,
      value: input.sellerHistory ?? null,
    },
    paymentMint: {
      index: 9,
      isWritable: false,
      value: input.paymentMint ?? null,
    },
    tokenProgram: {
      index: 10,
      isWritable: false,
      value: input.tokenProgram ?? null,
    },
    associatedTokenProgram: {
      index: 11,
      isWritable: false,
      value: input.associatedTokenProgram ?? null,
    },
    systemProgram: {
      index: 12,
      isWritable: false,
      value: input.systemProgram ?? null,
    },
    rent: { index: 13, isWritable: false, value: input.rent ?? null },
    mint: { index: 14, isWritable: false, value: input.mint ?? null },
    sellerTokenAccount: {
      index: 15,
      isWritable: true,
      value: input.sellerTokenAccount ?? null,
    },
    authorityPdaTokenAccount: {
      index: 16,
      isWritable: true,
      value: input.authorityPdaTokenAccount ?? null,
    },
    eventAuthority: {
      index: 17,
      isWritable: false,
      value: input.eventAuthority ?? null,
    },
    program: { index: 18, isWritable: false, value: input.program ?? null },
  };

  // Arguments.
  const resolvedArgs: SettleTokensSaleClaimedInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.payer.value) {
    resolvedAccounts.payer.value = context.payer;
  }
  if (!resolvedAccounts.authorityPda.value) {
    resolvedAccounts.authorityPda.value = findGumballMachineAuthorityPda(
      context,
      { gumballMachine: expectPublicKey(resolvedAccounts.gumballMachine.value) }
    );
  }
  if (!resolvedAccounts.authorityPdaPaymentAccount.value) {
    if (resolvedAccounts.paymentMint.value) {
      resolvedAccounts.authorityPdaPaymentAccount.value =
        findAssociatedTokenPda(context, {
          mint: expectPublicKey(resolvedAccounts.paymentMint.value),
          owner: expectPublicKey(resolvedAccounts.authorityPda.value),
        });
    }
  }
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity.publicKey;
  }
  if (!resolvedAccounts.authorityPaymentAccount.value) {
    if (resolvedAccounts.paymentMint.value) {
      resolvedAccounts.authorityPaymentAccount.value = findAssociatedTokenPda(
        context,
        {
          mint: expectPublicKey(resolvedAccounts.paymentMint.value),
          owner: expectPublicKey(resolvedAccounts.authority.value),
        }
      );
    }
  }
  if (!resolvedAccounts.sellerPaymentAccount.value) {
    if (resolvedAccounts.paymentMint.value) {
      resolvedAccounts.sellerPaymentAccount.value = findAssociatedTokenPda(
        context,
        {
          mint: expectPublicKey(resolvedAccounts.paymentMint.value),
          owner: expectPublicKey(resolvedAccounts.seller.value),
        }
      );
    }
  }
  if (!resolvedAccounts.sellerHistory.value) {
    resolvedAccounts.sellerHistory.value = findSellerHistoryPda(context, {
      gumballMachine: expectPublicKey(resolvedAccounts.gumballMachine.value),
      seller: expectPublicKey(resolvedAccounts.seller.value),
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
  if (!resolvedAccounts.sellerTokenAccount.value) {
    resolvedAccounts.sellerTokenAccount.value = findAssociatedTokenPda(
      context,
      {
        mint: expectPublicKey(resolvedAccounts.mint.value),
        owner: expectPublicKey(resolvedAccounts.seller.value),
      }
    );
  }
  if (!resolvedAccounts.authorityPdaTokenAccount.value) {
    resolvedAccounts.authorityPdaTokenAccount.value = findAssociatedTokenPda(
      context,
      {
        mint: expectPublicKey(resolvedAccounts.mint.value),
        owner: expectPublicKey(resolvedAccounts.authorityPda.value),
      }
    );
  }
  if (!resolvedAccounts.eventAuthority.value) {
    resolvedAccounts.eventAuthority.value = findEventAuthorityPda(context);
  }
  if (!resolvedAccounts.program.value) {
    resolvedAccounts.program.value = context.programs.getPublicKey(
      'mallowGumball',
      'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
    );
    resolvedAccounts.program.isWritable = false;
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
  const data = getSettleTokensSaleClaimedInstructionDataSerializer().serialize(
    resolvedArgs as SettleTokensSaleClaimedInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
