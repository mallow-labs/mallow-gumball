import { getTokenGateCodec, TokenGate, TokenGateArgs } from '../generated';
import { GuardManifest, noopParser } from '../guards';
import { findAssociatedTokenPda } from '../hooked';

/**
 * The tokenGate guard restricts minting to token holders
 * of a specified mint account. The `amount` determines
 * how many tokens are required.
 *
 * This guard alone does not limit how many times a holder
 * can mint. A holder can mint as many times as they have
 * the required amount of tokens to pay with.
 */
export const tokenGateGuardManifest: GuardManifest<
  TokenGateArgs,
  TokenGate,
  TokenGateMintArgs
> = {
  name: 'tokenGate',
  codec: getTokenGateCodec,
  mintParser: async (mintContext, args) => {
    const [tokenAccount] = await findAssociatedTokenPda({
      mint: args.mint,
      owner: mintContext.buyer.address,
    });
    return {
      data: new Uint8Array(),
      remainingAccounts: [{ address: tokenAccount, isWritable: true }],
    };
  },
  routeParser: noopParser,
};

export type TokenGateMintArgs = Omit<TokenGateArgs, 'amount'>;
