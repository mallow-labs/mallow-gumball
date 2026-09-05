import { MPL_CORE_PROGRAM_ID } from '@metaplex-foundation/mpl-core';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  publicKey,
  PublicKey,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { TOKEN_2022_PROGRAM_ID } from './constants';
import { sellItemBack, TokenStandard } from './generated';
import { findGumballMachineAuthorityPda } from './hooked';
import { MPL_TOKEN_AUTH_RULES_PROGRAM_ID } from './programs';

export type SellItemInput = Parameters<typeof sellItemBack>[1] & {
  tokenStandard: TokenStandard;
  /**
   * The token program that owns `paymentMint`. Defaults to classic SPL Token;
   * a Token-2022 payment mint must pass it explicitly (TOKEN22_PLAN §D3). The
   * buy-back payout reads the program from §D5 remaining-account slot 0 — this
   * instruction has no other remaining accounts.
   */
  paymentTokenProgram?: PublicKey;
};

export const sellItem = (
  context: Parameters<typeof sellItemBack>[0] & Pick<Context, 'rpc'>,
  input: SellItemInput
): TransactionBuilder => {
  const defaults = getDefaultsForTokenStandard(context, input);
  const feePaymentAccount =
    input.paymentMint != null && input.feeAccount != null
      ? findAssociatedTokenPda(context, {
          mint: publicKey(input.paymentMint),
          owner: publicKey(input.feeAccount),
          tokenProgramId: input.paymentTokenProgram,
        })[0]
      : undefined;

  // The codama-generated resolver derives `sellerPaymentAccount` and
  // `authorityPdaPaymentAccount` with the *classic* program (the program id is
  // not among its seeds), which for a Token-2022 payment mint produces
  // addresses Token-2022 never created. Resolve them here instead, with the
  // program the caller named, unless they were passed explicitly.
  const paymentAccounts: {
    sellerPaymentAccount?: PublicKey;
    authorityPdaPaymentAccount?: PublicKey;
  } = {};
  if (
    input.paymentMint != null &&
    input.paymentTokenProgram === TOKEN_2022_PROGRAM_ID
  ) {
    if (input.sellerPaymentAccount == null && input.seller != null) {
      [paymentAccounts.sellerPaymentAccount] = findAssociatedTokenPda(context, {
        mint: publicKey(input.paymentMint),
        owner: publicKey(input.seller),
        tokenProgramId: input.paymentTokenProgram,
      });
    }
    if (input.authorityPdaPaymentAccount == null) {
      [paymentAccounts.authorityPdaPaymentAccount] = findAssociatedTokenPda(
        context,
        {
          mint: publicKey(input.paymentMint),
          owner: findGumballMachineAuthorityPda(context, {
            gumballMachine: publicKey(input.gumballMachine),
          })[0],
          tokenProgramId: input.paymentTokenProgram,
        }
      );
    }
  }

  const builder = sellItemBack(context, {
    ...input,
    ...defaults,
    ...paymentAccounts,
    feePaymentAccount,
  });
  if (
    input.paymentMint == null ||
    input.paymentTokenProgram !== TOKEN_2022_PROGRAM_ID
  ) {
    return builder;
  }
  return builder.addRemainingAccounts([
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ]);
};

function getDefaultsForTokenStandard(
  context: Parameters<typeof sellItemBack>[0] & Pick<Context, 'rpc'>,
  input: SellItemInput
) {
  const authorityPda = findGumballMachineAuthorityPda(context, {
    gumballMachine: publicKey(input.gumballMachine),
  });

  switch (input.tokenStandard) {
    case TokenStandard.Core:
      return {
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      };
    case TokenStandard.NonFungible:
      return {
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      };
    case TokenStandard.ProgrammableNonFungible:
      return {
        authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      };
    case TokenStandard.Fungible:
      return {
        authorityPdaTokenAccount: findAssociatedTokenPda(context, {
          mint: publicKey(input.mint),
          owner: publicKey(authorityPda),
        })[0],
        sellerTokenAccount: findAssociatedTokenPda(context, {
          mint: publicKey(input.mint),
          owner: publicKey(input.seller ?? context.identity.publicKey),
        })[0],
        buyerTokenAccount: findAssociatedTokenPda(context, {
          mint: publicKey(input.mint),
          owner: publicKey(input.buyer),
        })[0],
      };
    default:
      return {};
  }
}
