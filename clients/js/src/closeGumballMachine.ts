import { AccountRole, type Address, type Instruction } from '@solana/kit';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from './constants';
import {
  getDeleteGumballGuardInstructionAsync,
  type DeleteGumballGuardAsyncInput,
} from './generated/instructions/deleteGumballGuard';
import { findAssociatedTokenPda } from './hooked';

const SPL_ASSOCIATED_TOKEN_PROGRAM_ID =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111' as Address;
const SYSVAR_RENT = 'SysvarRent111111111111111111111111111111111' as Address;
const DEFAULT_ADDRESS = '11111111111111111111111111111111' as Address;

export type CloseGumballMachineInput = DeleteGumballGuardAsyncInput & {
  paymentMint?: Address;
  /**
   * The token program that owns `paymentMint`. Defaults to classic SPL Token;
   * a Token-2022 payment mint must pass it explicitly (TOKEN22_PLAN §D3).
   *
   * `close_gumball_machine` closes the authority PDA's payment ATA, which for a
   * Token-2022 mint only the Token-2022 program can do — it reads the program
   * from §D5 remaining-account slot 4, after the existing four.
   */
  paymentTokenProgram?: Address;
};

/**
 * Builds the `deleteGumballGuard` instruction, appending the payment-mint fee
 * remaining accounts when an SPL payment mint is used.
 */
export const getCloseGumballMachineInstructionAsync = async (
  input: CloseGumballMachineInput
): Promise<Instruction> => {
  const { paymentMint, paymentTokenProgram, ...rest } = input;
  const tokenProgram = paymentTokenProgram ?? TOKEN_PROGRAM_ID;
  const instruction = await getDeleteGumballGuardInstructionAsync(rest);
  if (paymentMint == null || paymentMint === DEFAULT_ADDRESS) {
    return instruction;
  }
  const [feePaymentAccount] = await findAssociatedTokenPda({
    mint: paymentMint,
    owner: input.authority.address,
    tokenProgram,
  });
  const remaining = [
    { address: paymentMint, role: AccountRole.WRITABLE },
    { address: feePaymentAccount, role: AccountRole.WRITABLE },
    { address: SPL_ASSOCIATED_TOKEN_PROGRAM_ID, role: AccountRole.READONLY },
    { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    // §D5 slot 4 — after the four accounts above, which is where
    // `close_gumball_machine` reads it. Omitted for a classic mint, leaving the
    // existing account list unchanged.
    ...(tokenProgram === TOKEN_2022_PROGRAM_ID
      ? [{ address: TOKEN_2022_PROGRAM_ID, role: AccountRole.READONLY }]
      : []),
    { address: SYSVAR_RENT, role: AccountRole.READONLY },
  ];
  return {
    ...instruction,
    accounts: [...(instruction.accounts ?? []), ...remaining],
  };
};
