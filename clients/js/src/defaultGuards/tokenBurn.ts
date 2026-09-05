import { getTokenBurnCodec, TokenBurn, TokenBurnArgs } from '../generated';
import { GuardManifest, noopParser } from '../guards';
import { findAssociatedTokenPda } from '../hooked';

/**
 * The tokenBurn guard restricts minting to token holders
 * of a specified mint account and burns the holder's tokens
 * when minting. The `amount` determines how many tokens are required.
 *
 * This guard alone does not limit how many times a holder
 * can mint. A holder can mint as many times as they have
 * the required amount of tokens to burn.
 */
export const tokenBurnGuardManifest: GuardManifest<
  TokenBurnArgs,
  TokenBurn,
  TokenBurnMintArgs
> = {
  name: 'tokenBurn',
  codec: getTokenBurnCodec,
  mintParser: async (mintContext, args) => {
    const [tokenAccount] = await findAssociatedTokenPda({
      mint: args.mint,
      owner: mintContext.buyer.address,
    });
    return {
      data: new Uint8Array(),
      remainingAccounts: [
        { address: tokenAccount, isWritable: true },
        { address: args.mint, isWritable: true },
      ],
    };
  },
  routeParser: noopParser,
};

export type TokenBurnMintArgs = Omit<TokenBurnArgs, 'amount'>;
