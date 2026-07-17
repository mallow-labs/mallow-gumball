import { AccountRole, type Address, type Instruction } from '@solana/kit';
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
};

/**
 * Builds the `deleteGumballGuard` instruction, appending the payment-mint fee
 * remaining accounts when an SPL payment mint is used.
 */
export const getCloseGumballMachineInstructionAsync = async (
  input: CloseGumballMachineInput
): Promise<Instruction> => {
  const { paymentMint, ...rest } = input;
  const instruction = await getDeleteGumballGuardInstructionAsync(rest);
  if (paymentMint == null || paymentMint === DEFAULT_ADDRESS) {
    return instruction;
  }
  const [feePaymentAccount] = await findAssociatedTokenPda({
    mint: paymentMint,
    owner: input.authority.address,
  });
  const remaining = [
    { address: paymentMint, role: AccountRole.WRITABLE },
    { address: feePaymentAccount, role: AccountRole.WRITABLE },
    { address: SPL_ASSOCIATED_TOKEN_PROGRAM_ID, role: AccountRole.READONLY },
    { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    { address: SYSVAR_RENT, role: AccountRole.READONLY },
  ];
  return {
    ...instruction,
    accounts: [...(instruction.accounts ?? []), ...remaining],
  };
};
