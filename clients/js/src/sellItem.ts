import { type Address, type Instruction } from '@solana/kit';
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
};

/**
 * Builds the `sellItemBack` instruction, wiring the token-standard-specific
 * program + token-account defaults (Core / NFT / pNFT / Fungible).
 */
export const getSellItemInstructionAsync = async (
  input: SellItemInput
): Promise<Instruction> => {
  const defaults = await getDefaultsForTokenStandard(input);
  const feePaymentAccount =
    input.paymentMint != null && input.feeAccount != null
      ? (
          await findAssociatedTokenPda({
            mint: input.paymentMint,
            owner: input.feeAccount,
          })
        )[0]
      : undefined;
  return await getSellItemBackInstructionAsync({
    ...input,
    ...defaults,
    feePaymentAccount,
  });
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
