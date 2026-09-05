import { none, type Instruction, type OptionOrNullable } from '@solana/kit';
import {
  DefaultGuardSetRouteArgs,
  defaultGumballGuardNames,
} from './defaultGuards';
import {
  getRouteInstructionAsync,
  type RouteAsyncInput,
} from './generated/instructions/route';
import { findGumballGuardPda } from './generated/pdas';
import { MachineType } from './generated/types';
import {
  GuardRepository,
  GuardSetRouteArgs,
  parseGuardRemainingAccounts,
  parseRouteArgs,
  RouteContext,
} from './guards';
import { getDefaultGuardRepository } from './plugin';

export type RouteBuilderInput<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs = DefaultGuardSetRouteArgs,
> = Omit<RouteAsyncInput, 'guard' | 'data' | 'group'> & {
  guard: G;
  routeArgs: RA[G];
  group?: OptionOrNullable<string>;
  machineType?: MachineType;
  /** Override the guard repository (defaults to the built-in default guards). */
  guards?: GuardRepository;
};

/**
 * High-level `route` builder: runs the selected guard's route parser to produce
 * the instruction data + remaining accounts.
 */
export async function route<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs = DefaultGuardSetRouteArgs,
>(input: RouteBuilderInput<G, RA>): Promise<Instruction> {
  const {
    routeArgs,
    guard,
    group = none(),
    machineType = MachineType.Gumball,
    guards = getDefaultGuardRepository(),
    ...rest
  } = input;
  const manifests = guards.forProgram(defaultGumballGuardNames);
  const gumballGuard =
    input.gumballGuard ??
    (await findGumballGuardPda({ base: input.machine }))[0];
  const routeContext: RouteContext = {
    payer: input.payer,
    machine: input.machine,
    gumballGuard,
    machineType,
  };
  const { data, remainingAccounts, guardIndex } = await parseRouteArgs<G, RA>(
    manifests,
    routeContext,
    guard,
    routeArgs
  );
  const instruction = await getRouteInstructionAsync({
    ...rest,
    gumballGuard,
    guard: guardIndex,
    data,
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
