import { AccountRole, type Address, type Instruction } from '@solana/kit';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from './constants';
import {
  getSellItemBackInstructionAsync,
  TokenStandard,
  type SellItemBackAsyncInput,
} from './generated';
import {
  findAssociatedTokenPda,
  findGumballMachineAuthorityPda,
} from './hooked';

const MPL_CORE_PROGRAM_ID =
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address;
const MPL_TOKEN_METADATA_PROGRAM_ID =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as Address;
const MPL_TOKEN_AUTH_RULES_PROGRAM_ID =
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address;

export type SellItemInput = SellItemBackAsyncInput & {
  tokenStandard: TokenStandard;
  /**
   * The token program that owns `paymentMint`. Defaults to classic SPL Token;
   * a Token-2022 payment mint must pass it explicitly (TOKEN22_PLAN §D3). The
   * buy-back payout reads the program from §D5 remaining-account slot 0 — this
   * instruction has no other remaining accounts.
   */
  paymentTokenProgram?: Address;
};

/**
 * Builds the `sellItemBack` instruction, wiring the token-standard-specific
 * program + token-account defaults (Core / NFT / pNFT / Fungible).
 */
export const getSellItemInstructionAsync = async (
  input: SellItemInput
): Promise<Instruction> => {
  const defaults = await getDefaultsForTokenStandard(input);
  const tokenProgram = input.paymentTokenProgram ?? TOKEN_PROGRAM_ID;
  const feePaymentAccount =
    input.paymentMint != null && input.feeAccount != null
      ? (
          await findAssociatedTokenPda({
            mint: input.paymentMint,
            owner: input.feeAccount,
            tokenProgram,
          })
        )[0]
      : undefined;

  // The codama-generated resolver derives `sellerPaymentAccount` and
  // `authorityPdaPaymentAccount` with the *classic* program (the program id is
  // not among its seeds), which for a Token-2022 payment mint produces
  // addresses Token-2022 never created. Resolve them here instead, with the
  // program the caller named, unless they were passed explicitly.
  const paymentAccounts: Partial<{
    sellerPaymentAccount: Address;
    authorityPdaPaymentAccount: Address;
  }> = {};
  if (input.paymentMint != null && tokenProgram === TOKEN_2022_PROGRAM_ID) {
    const [authorityPda] = await findGumballMachineAuthorityPda({
      gumballMachine: input.gumballMachine,
    });
    if (input.sellerPaymentAccount == null) {
      [paymentAccounts.sellerPaymentAccount] = await findAssociatedTokenPda({
        mint: input.paymentMint,
        owner: input.seller,
        tokenProgram,
      });
    }
    if (input.authorityPdaPaymentAccount == null) {
      [paymentAccounts.authorityPdaPaymentAccount] =
        await findAssociatedTokenPda({
          mint: input.paymentMint,
          owner: authorityPda,
          tokenProgram,
        });
    }
  }

  const instruction = await getSellItemBackInstructionAsync({
    ...input,
    ...defaults,
    ...paymentAccounts,
    feePaymentAccount,
  });
  if (input.paymentMint == null || tokenProgram !== TOKEN_2022_PROGRAM_ID) {
    return instruction;
  }
  return {
    ...instruction,
    accounts: [
      ...(instruction.accounts ?? []),
      { address: TOKEN_2022_PROGRAM_ID, role: AccountRole.READONLY },
    ],
  };
};

async function getDefaultsForTokenStandard(
  input: SellItemInput
): Promise<Partial<SellItemBackAsyncInput>> {
  switch (input.tokenStandard) {
    case TokenStandard.Core:
      return { mplCoreProgram: MPL_CORE_PROGRAM_ID };
    case TokenStandard.NonFungible:
      return { tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID };
    case TokenStandard.ProgrammableNonFungible:
      return {
        authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      };
    case TokenStandard.Fungible: {
      const [authorityPda] = await findGumballMachineAuthorityPda({
        gumballMachine: input.gumballMachine,
      });
      const [authorityPdaTokenAccount, sellerTokenAccount, buyerTokenAccount] =
        await Promise.all([
          findAssociatedTokenPda({ mint: input.mint, owner: authorityPda }),
          findAssociatedTokenPda({ mint: input.mint, owner: input.seller }),
          findAssociatedTokenPda({ mint: input.mint, owner: input.buyer }),
        ]);
      return {
        authorityPdaTokenAccount: authorityPdaTokenAccount[0],
        sellerTokenAccount: sellerTokenAccount[0],
        buyerTokenAccount: buyerTokenAccount[0],
      };
    }
    default:
      return {};
  }
}
