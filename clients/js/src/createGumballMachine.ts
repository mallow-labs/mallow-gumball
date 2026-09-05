import { getCreateAccountInstruction } from '@solana-program/system';
import {
  type GetMinimumBalanceForRentExemptionApi,
  type Instruction,
  type Rpc,
  type TransactionSigner,
} from '@solana/kit';
import {
  getInitializeGumballMachineInstructionAsync,
  MALLOW_GUMBALL_PROGRAM_ADDRESS,
  type InitializeGumballMachineAsyncInput,
} from './generated';
import { getGumballMachineSizeForItemCount } from './hooked';

export type CreateGumballMachineInput = Omit<
  InitializeGumballMachineAsyncInput,
  'gumballMachine'
> & {
  gumballMachine: TransactionSigner;
};

/**
 * Builds the two instructions needed to create a gumball machine: the
 * `createAccount` for the correctly-sized (variable) machine account, plus the
 * `initializeGumballMachine` instruction. Needs an RPC to compute rent.
 */
export const getCreateGumballMachineInstructionsAsync = async (
  input: CreateGumballMachineInput,
  config: { rpc: Rpc<GetMinimumBalanceForRentExemptionApi> }
): Promise<Instruction[]> => {
  const space = BigInt(
    getGumballMachineSizeForItemCount(input.settings.itemCapacity)
  );
  const lamports = await config.rpc
    .getMinimumBalanceForRentExemption(space)
    .send();
  const createAccount = getCreateAccountInstruction({
    payer: input.payer,
    newAccount: input.gumballMachine,
    lamports,
    space,
    programAddress: MALLOW_GUMBALL_PROGRAM_ADDRESS,
  });
  const initialize = await getInitializeGumballMachineInstructionAsync({
    ...input,
    gumballMachine: input.gumballMachine.address,
  });
  return [createAccount, initialize];
};
