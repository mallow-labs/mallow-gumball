import { AccountRole, Address, Instruction } from '@solana/kit';

/** Append the live-request accounting account after any compressed proof nodes. */
export function withRequestCancellationMachine<T extends Instruction>(
  instruction: T,
  gumballMachine: Address
): T {
  return {
    ...instruction,
    accounts: [
      ...(instruction.accounts ?? []),
      { address: gumballMachine, role: AccountRole.WRITABLE },
    ],
  };
}
