import { none, type Instruction, type OptionOrNullable } from '@solana/kit';
import {
  DefaultGuardSetMintArgs,
  defaultGumballGuardNames,
} from './defaultGuards';
import {
  getDrawInstructionAsync,
  type DrawAsyncInput,
} from './generated/instructions/draw';
import { findGumballGuardPda } from './generated/pdas';
import { MachineType } from './generated/types';
import {
  GuardRepository,
  GuardSetMintArgs,
  MintContext,
  parseGuardRemainingAccounts,
  parseMintArgs,
} from './guards';
import { getDefaultGuardRepository } from './plugin';

export type DrawBuilderInput<
  MA extends GuardSetMintArgs = DefaultGuardSetMintArgs,
> = Omit<DrawAsyncInput, 'mintArgs' | 'group'> & {
  mintArgs?: Partial<MA>;
  group?: OptionOrNullable<string>;
  /** Override the guard repository (defaults to the built-in default guards). */
  guards?: GuardRepository;
};

/**
 * High-level `draw` builder: serializes the provided guard mint args and appends
 * each guard's remaining accounts to the low-level draw instruction.
 */
export async function draw<
  MA extends GuardSetMintArgs = DefaultGuardSetMintArgs,
>(input: DrawBuilderInput<MA>): Promise<Instruction> {
  const {
    mintArgs = {},
    group = none(),
    guards = getDefaultGuardRepository(),
    ...rest
  } = input;
  const manifests = guards.forProgram(defaultGumballGuardNames);
  const gumballGuard =
    input.gumballGuard ??
    (await findGumballGuardPda({ base: input.gumballMachine }))[0];
  const mintContext: MintContext = {
    buyer: input.buyer,
    payer: input.payer,
    machine: input.gumballMachine,
    gumballGuard,
    machineType: MachineType.Gumball,
  };
  const { data, remainingAccounts } = await parseMintArgs<MA>(
    manifests,
    mintContext,
    mintArgs
  );
  const instruction = await getDrawInstructionAsync({
    ...rest,
    gumballGuard,
    mintArgs: data,
    group,
  });
  return {
    ...instruction,
    accounts: [
      ...(instruction.accounts ?? []),
      ...parseGuardRemainingAccounts(remainingAccounts),
    ],
  };
}
