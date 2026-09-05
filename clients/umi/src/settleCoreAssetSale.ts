import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import {
  AccountMeta,
  Context,
  publicKey,
  PublicKey,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from './constants';
import { baseSettleCoreAssetSale } from './generated';
import { findGumballMachineAuthorityPda } from './hooked';

export type SettleCoreAssetSaleInput = Parameters<
  typeof baseSettleCoreAssetSale
>[1] & {
  creators: PublicKey[];
  /**
   * The token program that owns `paymentMint`. Defaults to classic SPL Token;
   * a Token-2022 payment mint must pass it explicitly (TOKEN22_PLAN §D3 —
   * resolved from the token registry, never probed).
   *
   * Two things depend on it: the program id is part of the ATA seeds, so a
   * classic derivation lands on an address Token-2022 never credits; and the
   * on-chain settle path reads the program itself from §D5 remaining-account
   * slot 0, ahead of the creator pairs.
   */
  paymentTokenProgram?: PublicKey;
};

export const settleCoreAssetSale = (
  context: Parameters<typeof baseSettleCoreAssetSale>[0] & Pick<Context, 'rpc'>,
  input: SettleCoreAssetSaleInput
): TransactionBuilder => {
  const isNativePayment =
    input.paymentMint == null || input.paymentMint === NATIVE_MINT;
  const remainingAccounts: AccountMeta[] = [];

  // §D5 slot 0 — before the creator pairs, which is where `claim_proceeds`
  // consumes it. Absent for a classic payment mint, so an existing settle call
  // is byte-for-byte unchanged.
  if (!isNativePayment && input.paymentTokenProgram === TOKEN_2022_PROGRAM_ID) {
    remainingAccounts.push({
      pubkey: TOKEN_2022_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
  }

  input.creators.forEach((creator) => {
    remainingAccounts.push({
      pubkey: creator,
      isSigner: false,
      isWritable: isNativePayment,
    });
    if (!isNativePayment) {
      remainingAccounts.push({
        pubkey: findAssociatedTokenPda(context, {
          mint: publicKey(input.paymentMint!),
          owner: creator,
          tokenProgramId: input.paymentTokenProgram,
        })[0],
        isSigner: false,
        isWritable: true,
      });
    }
  });

  // The codama-generated resolver derives every payment ATA with the *classic*
  // program (the program id is not among its seeds), which for a Token-2022
  // payment mint produces addresses Token-2022 never created. Resolve them here
  // instead, with the program the caller named, unless they were passed
  // explicitly.
  const paymentAccounts: Record<string, PublicKey> = {};
  if (!isNativePayment && input.paymentTokenProgram === TOKEN_2022_PROGRAM_ID) {
    const mint = publicKey(input.paymentMint!);
    const tokenProgramId = input.paymentTokenProgram;
    const authorityPda = findGumballMachineAuthorityPda(context, {
      gumballMachine: publicKey(input.gumballMachine),
    })[0];
    if (input.authorityPdaPaymentAccount == null) {
      [paymentAccounts.authorityPdaPaymentAccount] = findAssociatedTokenPda(
        context,
        { mint, owner: authorityPda, tokenProgramId }
      );
    }
    if (input.authorityPaymentAccount == null && input.authority != null) {
      [paymentAccounts.authorityPaymentAccount] = findAssociatedTokenPda(
        context,
        {
          mint,
          owner: publicKey(input.authority),
          tokenProgramId,
        }
      );
    }
    if (input.sellerPaymentAccount == null && input.seller != null) {
      [paymentAccounts.sellerPaymentAccount] = findAssociatedTokenPda(context, {
        mint,
        owner: publicKey(input.seller),
        tokenProgramId,
      });
    }
    if (input.feePaymentAccount == null && input.feeAccount != null) {
      [paymentAccounts.feePaymentAccount] = findAssociatedTokenPda(context, {
        mint,
        owner: publicKey(input.feeAccount),
        tokenProgramId,
      });
    }
  }

  return transactionBuilder().add(
    baseSettleCoreAssetSale(context, {
      ...input,
      ...paymentAccounts,
    }).addRemainingAccounts(remainingAccounts)
  );
};
