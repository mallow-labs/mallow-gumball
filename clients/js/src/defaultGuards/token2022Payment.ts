import { type Address } from '@solana/kit';
import {
  getToken2022PaymentCodec,
  Token2022Payment,
  Token2022PaymentArgs,
} from '../generated';
import { GuardManifest, GuardRemainingAccount, noopParser } from '../guards';
import { findAssociatedTokenPda } from '../hooked';

const SPL_TOKEN_2022_PROGRAM_ID =
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;

/**
 * The token2022Payment guard allows minting by charging the
 * payer a specific amount of tokens from a certain mint acount
 * using Token2022. The tokens will be transfered to a predefined
 * destination.
 *
 * This guard alone does not limit how many times a holder
 * can mint. A holder can mint as many times as they have
 * the required amount of tokens to pay with.
 */
export const token2022PaymentGuardManifest: GuardManifest<
  Token2022PaymentArgs,
  Token2022Payment,
  Token2022PaymentMintArgs
> = {
  name: 'token2022Payment',
  codec: getToken2022PaymentCodec,
  mintParser: async (mintContext, args) => {
    const [sourceAta] = await findAssociatedTokenPda({
      mint: args.mint,
      owner: mintContext.payer.address,
      tokenProgram: SPL_TOKEN_2022_PROGRAM_ID,
    });

    const [feeDestinationAta] = args.feeAccount
      ? await findAssociatedTokenPda({
          mint: args.mint,
          owner: args.feeAccount,
          tokenProgram: SPL_TOKEN_2022_PROGRAM_ID,
        })
      : [];

    const remainingAccounts: GuardRemainingAccount[] = [
      { address: sourceAta, isWritable: true },
      { address: args.destinationAta, isWritable: true },
      { address: args.mint, isWritable: false },
      { address: SPL_TOKEN_2022_PROGRAM_ID, isWritable: false },
      ...(feeDestinationAta
        ? [{ address: feeDestinationAta, isWritable: true }]
        : []),
    ];

    return {
      data: new Uint8Array(),
      remainingAccounts,
    };
  },
  routeParser: noopParser,
};

export type Token2022PaymentMintArgs = Omit<Token2022PaymentArgs, 'amount'> & {
  feeAccount?: Address;
};
