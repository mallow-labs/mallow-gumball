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
  publicKey,
  Signer,
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
  findEventAuthorityPda,
  findGumballMachineAuthorityPda,
} from '../../hooked';
import { findSellerHistoryPda } from '../accounts';
import {
  expectPublicKey,
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';

// Accounts.
export type BaseSettleCoreAssetSaleInstructionAccounts = {
  /** Anyone can settle the sale */
  payer?: Signer;
  /** Gumball machine account. */
  gumballMachine: PublicKey | Pda;
  authorityPda?: PublicKey | Pda;
  /** Payment account for authority pda if using token payment */
  authorityPdaPaymentAccount?: PublicKey | Pda;
  /** Seller of the nft */
  authority?: PublicKey | Pda;
  /** Payment account for authority if using token payment */
  authorityPaymentAccount?: PublicKey | Pda;
  /** Seller of the nft */
  seller: PublicKey | Pda;
  /** Payment account for seller if using token payment */
  sellerPaymentAccount?: PublicKey | Pda;
  /** Seller history account. */
  sellerHistory?: PublicKey | Pda;
  /** buyer of the nft */
  buyer?: PublicKey | Pda;
  /** Fee account for marketplace fee if using fee config */
  feeAccount?: PublicKey | Pda;
  /** Payment account for marketplace fee if using token payment */
  feePaymentAccount?: PublicKey | Pda;
  /** Payment mint if using non-native payment token */
  paymentMint?: PublicKey | Pda;
  tokenProgram?: PublicKey | Pda;
  associatedTokenProgram?: PublicKey | Pda;
  systemProgram?: PublicKey | Pda;
  rent?: PublicKey | Pda;
  asset: PublicKey | Pda;
  collection?: PublicKey | Pda;
  mplCoreProgram?: PublicKey | Pda;
  eventAuthority?: PublicKey | Pda;
  program?: PublicKey | Pda;
};

// Data.
export type BaseSettleCoreAssetSaleInstructionData = {
  discriminator: Array<number>;
  index: number;
};

export type BaseSettleCoreAssetSaleInstructionDataArgs = { index: number };

export function getBaseSettleCoreAssetSaleInstructionDataSerializer(): Serializer<
  BaseSettleCoreAssetSaleInstructionDataArgs,
  BaseSettleCoreAssetSaleInstructionData
> {
  return mapSerializer<
    BaseSettleCoreAssetSaleInstructionDataArgs,
    any,
    BaseSettleCoreAssetSaleInstructionData
  >(
    struct<BaseSettleCoreAssetSaleInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['index', u32()],
      ],
      { description: 'BaseSettleCoreAssetSaleInstructionData' }
    ),
    (value) => ({ ...value, discriminator: [78, 55, 252, 82, 233, 15, 98, 51] })
  ) as Serializer<
    BaseSettleCoreAssetSaleInstructionDataArgs,
    BaseSettleCoreAssetSaleInstructionData
  >;
}

// Args.
export type BaseSettleCoreAssetSaleInstructionArgs =
  BaseSettleCoreAssetSaleInstructionDataArgs;

// Instruction.
export function baseSettleCoreAssetSale(
  context: Pick<Context, 'eddsa' | 'identity' | 'payer' | 'programs'>,
  input: BaseSettleCoreAssetSaleInstructionAccounts &
    BaseSettleCoreAssetSaleInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachine',
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
    buyer: { index: 9, isWritable: false, value: input.buyer ?? null },
    feeAccount: {
      index: 10,
      isWritable: true,
      value: input.feeAccount ?? null,
    },
    feePaymentAccount: {
      index: 11,
      isWritable: true,
      value: input.feePaymentAccount ?? null,
    },
    paymentMint: {
      index: 12,
      isWritable: false,
      value: input.paymentMint ?? null,
    },
    tokenProgram: {
      index: 13,
      isWritable: false,
      value: input.tokenProgram ?? null,
    },
    associatedTokenProgram: {
      index: 14,
      isWritable: false,
      value: input.associatedTokenProgram ?? null,
    },
    systemProgram: {
      index: 15,
      isWritable: false,
      value: input.systemProgram ?? null,
    },
    rent: { index: 16, isWritable: false, value: input.rent ?? null },
    asset: { index: 17, isWritable: true, value: input.asset ?? null },
    collection: {
      index: 18,
      isWritable: false,
      value: input.collection ?? null,
    },
    mplCoreProgram: {
      index: 19,
      isWritable: false,
      value: input.mplCoreProgram ?? null,
    },
    eventAuthority: {
      index: 20,
      isWritable: false,
      value: input.eventAuthority ?? null,
    },
    program: { index: 21, isWritable: false, value: input.program ?? null },
  };

  // Arguments.
  const resolvedArgs: BaseSettleCoreAssetSaleInstructionArgs = { ...input };

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
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity.publicKey;
  }
  if (!resolvedAccounts.sellerHistory.value) {
    resolvedAccounts.sellerHistory.value = findSellerHistoryPda(context, {
      gumballMachine: expectPublicKey(resolvedAccounts.gumballMachine.value),
      seller: expectPublicKey(resolvedAccounts.seller.value),
    });
  }
  if (!resolvedAccounts.buyer.value) {
    resolvedAccounts.buyer.value = context.identity.publicKey;
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
  if (!resolvedAccounts.mplCoreProgram.value) {
    resolvedAccounts.mplCoreProgram.value = context.programs.getPublicKey(
      'mplCoreProgram',
      'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'
    );
    resolvedAccounts.mplCoreProgram.isWritable = false;
  }
  if (!resolvedAccounts.eventAuthority.value) {
    resolvedAccounts.eventAuthority.value = findEventAuthorityPda(context);
  }
  if (!resolvedAccounts.program.value) {
    resolvedAccounts.program.value = context.programs.getPublicKey(
      'mplCandyMachine',
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
  const data = getBaseSettleCoreAssetSaleInstructionDataSerializer().serialize(
    resolvedArgs as BaseSettleCoreAssetSaleInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
