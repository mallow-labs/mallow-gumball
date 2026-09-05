import { PublicKey, publicKey } from '@metaplex-foundation/umi';
import { publicKey as publicKeySerializer } from '@metaplex-foundation/umi/serializers';
import {
  getToken2022PaymentSerializer,
  MachineType,
  Token2022Payment,
  Token2022PaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';
import { findGumballMachineAuthorityPda } from '../hooked';

const SPL_TOKEN_2022_PROGRAM_ID = publicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

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
  serializer: getToken2022PaymentSerializer,
  mintParser: (context, mintContext, args) => {
    const associatedTokenProgramId =
      context.programs.get('splAssociatedToken').publicKey;
    const sourceAta = context.eddsa.findPda(associatedTokenProgramId, [
      publicKeySerializer().serialize(mintContext.payer.publicKey),
      publicKeySerializer().serialize(SPL_TOKEN_2022_PROGRAM_ID),
      publicKeySerializer().serialize(args.mint),
    ])[0];

    // Jellybean: `[payer ATA, mint, Token-2022 program, ...one ATA per
    // JellybeanMachine.fee_accounts entry]`. `draw_jellybean` keeps its named
    // `spl_token_program` on classic SPL, so the Token-2022 program rides in the
    // remaining accounts exactly as it does on the Gumball branch.
    if (mintContext.machineType === MachineType.Jellybean) {
      const feeAtas = (args.feeAccounts ?? []).map((feeAccount) => ({
        publicKey: context.eddsa.findPda(associatedTokenProgramId, [
          publicKeySerializer().serialize(feeAccount),
          publicKeySerializer().serialize(SPL_TOKEN_2022_PROGRAM_ID),
          publicKeySerializer().serialize(args.mint),
        ])[0],
        isWritable: true,
      }));

      return {
        data: new Uint8Array(),
        remainingAccounts: [
          { publicKey: sourceAta, isWritable: true },
          { publicKey: args.mint, isWritable: false },
          { publicKey: SPL_TOKEN_2022_PROGRAM_ID, isWritable: false },
          ...feeAtas,
        ],
      };
    }

    // The Gumball destination is the machine authority PDA's ATA — where
    // `pre_actions_gumball` sends proceeds and where settle later claims them.
    // Derived here, as `tokenPayment` does, so callers need not thread it.
    const destinationAta =
      args.destinationAta ??
      context.eddsa.findPda(associatedTokenProgramId, [
        publicKeySerializer().serialize(
          findGumballMachineAuthorityPda(context, {
            gumballMachine: mintContext.machine,
          })[0]
        ),
        publicKeySerializer().serialize(SPL_TOKEN_2022_PROGRAM_ID),
        publicKeySerializer().serialize(args.mint),
      ])[0];

    const [feeDestinationAta] = args.feeAccount
      ? context.eddsa.findPda(associatedTokenProgramId, [
          publicKeySerializer().serialize(args.feeAccount),
          publicKeySerializer().serialize(SPL_TOKEN_2022_PROGRAM_ID),
          publicKeySerializer().serialize(args.mint),
        ])
      : [];

    return {
      data: new Uint8Array(),
      remainingAccounts: [
        { publicKey: sourceAta, isWritable: true },
        { publicKey: destinationAta, isWritable: true },
        { publicKey: args.mint, isWritable: false },
        { publicKey: SPL_TOKEN_2022_PROGRAM_ID, isWritable: false },
        ...(feeDestinationAta
          ? [{ publicKey: feeDestinationAta, isWritable: true }]
          : []),
      ],
    };
  },
  routeParser: noopParser,
};

export type Token2022PaymentMintArgs = Omit<
  Token2022PaymentArgs,
  'amount' | 'destinationAta'
> & {
  /** Gumball only; defaults to the machine authority PDA's Token-2022 ATA. */
  destinationAta?: PublicKey;
  /** Gumball only: the marketplace fee account (v1+ machines with a fee config). */
  feeAccount?: PublicKey;
  /** Jellybean only: one entry per `JellybeanMachine.fee_accounts` entry, in order. */
  feeAccounts?: PublicKey[];
};
