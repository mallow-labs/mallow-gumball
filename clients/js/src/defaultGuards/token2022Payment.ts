import { type Address } from '@solana/kit';
import {
  getToken2022PaymentCodec,
  MachineType,
  Token2022Payment,
  Token2022PaymentArgs,
} from '../generated';
import { GuardManifest, GuardRemainingAccount, noopParser } from '../guards';
import {
  findAssociatedTokenPda,
  findGumballMachineAuthorityPda,
} from '../hooked';

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

    // Jellybean: `[payer ATA, mint, Token-2022 program, ...one ATA per
    // JellybeanMachine.fee_accounts entry]`. `draw_jellybean` keeps its named
    // `spl_token_program` on classic SPL, so the Token-2022 program rides in the
    // remaining accounts exactly as it does on the Gumball branch.
    if (mintContext.machineType === MachineType.Jellybean) {
      const feeAtas = await Promise.all(
        (args.feeAccounts ?? []).map(async (feeAccount) => ({
          address: (
            await findAssociatedTokenPda({
              mint: args.mint,
              owner: feeAccount,
              tokenProgram: SPL_TOKEN_2022_PROGRAM_ID,
            })
          )[0],
          isWritable: true,
        }))
      );

      return {
        data: new Uint8Array(),
        remainingAccounts: [
          { address: sourceAta, isWritable: true },
          { address: args.mint, isWritable: false },
          { address: SPL_TOKEN_2022_PROGRAM_ID, isWritable: false },
          ...feeAtas,
        ],
      };
    }

    // The Gumball destination is the machine authority PDA's ATA — where
    // `pre_actions_gumball` sends proceeds and where settle later claims them.
    // Derived here, as `tokenPayment` does, so callers need not thread it.
    const destinationAta =
      args.destinationAta ??
      (
        await findAssociatedTokenPda({
          mint: args.mint,
          owner: (
            await findGumballMachineAuthorityPda({
              gumballMachine: mintContext.machine,
            })
          )[0],
          tokenProgram: SPL_TOKEN_2022_PROGRAM_ID,
        })
      )[0];

    const [feeDestinationAta] = args.feeAccount
      ? await findAssociatedTokenPda({
          mint: args.mint,
          owner: args.feeAccount,
          tokenProgram: SPL_TOKEN_2022_PROGRAM_ID,
        })
      : [];

    const remainingAccounts: GuardRemainingAccount[] = [
      { address: sourceAta, isWritable: true },
      { address: destinationAta, isWritable: true },
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

export type Token2022PaymentMintArgs = Omit<
  Token2022PaymentArgs,
  'amount' | 'destinationAta'
> & {
  /** Gumball only; defaults to the machine authority PDA's Token-2022 ATA. */
  destinationAta?: Address;
  /** Gumball only: the marketplace fee account (v1+ machines with a fee config). */
  feeAccount?: Address;
  /** Jellybean only: one entry per `JellybeanMachine.fee_accounts` entry, in order. */
  feeAccounts?: Address[];
};
