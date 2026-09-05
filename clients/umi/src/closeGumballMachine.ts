import {
  findAssociatedTokenPda,
  SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
  SPL_SYSTEM_PROGRAM_ID,
} from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  defaultPublicKey,
  publicKey,
  PublicKey,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { TOKEN_2022_PROGRAM_ID } from './constants';
import { deleteGumballGuard } from './generated';

export type CloseGumballMachineInput = Parameters<
  typeof deleteGumballGuard
>[1] & {
  paymentMint?: PublicKey;
  /**
   * The token program that owns `paymentMint`. Defaults to classic SPL Token;
   * a Token-2022 payment mint must pass it explicitly (TOKEN22_PLAN §D3).
   *
   * `close_gumball_machine` closes the authority PDA's payment ATA, which for a
   * Token-2022 mint only the Token-2022 program can do — it reads the program
   * from §D5 remaining-account slot 4, after the existing four.
   */
  paymentTokenProgram?: PublicKey;
};

export const closeGumballMachine = (
  context: Parameters<typeof deleteGumballGuard>[0] &
    Pick<Context, 'rpc' | 'eddsa'>,
  input: CloseGumballMachineInput
): TransactionBuilder => {
  const builder = deleteGumballGuard(context, input);
  return transactionBuilder().add(
    input.paymentMint != null && input.paymentMint !== defaultPublicKey()
      ? builder.addRemainingAccounts([
          {
            pubkey: input.paymentMint,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: findAssociatedTokenPda(context, {
              mint: input.paymentMint,
              owner: context.identity.publicKey,
              tokenProgramId: input.paymentTokenProgram,
            })[0],
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SPL_SYSTEM_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
          // §D5 slot 4 — after the four accounts above, which is where
          // `close_gumball_machine` reads it. Omitted for a classic mint,
          // leaving the existing account list unchanged.
          ...(input.paymentTokenProgram === TOKEN_2022_PROGRAM_ID
            ? [
                {
                  pubkey: TOKEN_2022_PROGRAM_ID,
                  isSigner: false,
                  isWritable: false,
                },
              ]
            : []),
          {
            pubkey: publicKey('SysvarRent111111111111111111111111111111111'),
            isSigner: false,
            isWritable: false,
          },
        ])
      : builder
  );
};
