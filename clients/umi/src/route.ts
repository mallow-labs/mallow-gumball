import {
  none,
  Option,
  OptionOrNullable,
  publicKey,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { DefaultGuardSetRouteArgs } from './defaultGuards';
import {
  route as baseRoute,
  RouteInstructionAccounts,
} from './generated/instructions/route';
import { MachineType } from './generated/types';
import {
  GuardRepository,
  GuardSetRouteArgs,
  GumballGuardProgram,
  parseGuardRemainingAccounts,
  parseRouteArgs,
  RouteContext,
} from './guards';
import { findGumballGuardPda } from './hooked';

export { RouteInstructionAccounts };

export type RouteInstructionData<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs,
> = {
  discriminator: Array<number>;
  guard: G;
  routeArgs: RA[G];
  group: Option<string>;
};

export type RouteInstructionDataArgs<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs,
> = {
  guard: G;
  routeArgs: RA[G];
  group?: OptionOrNullable<string>;
};

export function route<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs = DefaultGuardSetRouteArgs,
>(
  context: Parameters<typeof baseRoute>[0] & {
    guards: GuardRepository;
  },
  input: RouteInstructionAccounts &
    RouteInstructionDataArgs<
      G,
      RA extends undefined ? DefaultGuardSetRouteArgs : RA
    > & { machineType?: MachineType }
): TransactionBuilder {
  const { routeArgs = {}, group = none(), ...rest } = input;
  const program = context.programs.get<GumballGuardProgram>('gumballGuard');
  const machine = publicKey(input.machine, false);
  const machineType = input.machineType ?? MachineType.Gumball;
  const routeContext: RouteContext = {
    payer: input.payer ?? context.payer,
    machine,
    gumballGuard: publicKey(
      input.gumballGuard ?? findGumballGuardPda(context, { base: machine }),
      false
    ),
    machineType,
  };
  const { data, remainingAccounts, guardIndex } = parseRouteArgs<
    G,
    RA extends undefined ? DefaultGuardSetRouteArgs : RA
  >(context, program, routeContext, input.guard, input.routeArgs);
  const ix = baseRoute(context, { ...rest, guard: guardIndex, data, group })
    .items[0];

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);

  return transactionBuilder([ix]);
}
