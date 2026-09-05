import { type Instruction } from '@solana/kit';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  getInitializeGumballGuardInstructionAsync,
  type InitializeGumballGuardAsyncInput,
} from './generated/instructions/initializeGumballGuard';
import { GuardSetArgs } from './guards';
import {
  getGumballGuardDataEncoder,
  type GumballGuardDataArgs,
} from './hooked';

export type CreateGumballGuardInput<
  DA extends GuardSetArgs = DefaultGuardSetArgs,
> = Omit<InitializeGumballGuardAsyncInput, 'data'> &
  Partial<GumballGuardDataArgs<DA>>;

/**
 * High-level `createGumballGuard` builder: serializes the provided guards +
 * groups into the initialize instruction data.
 */
export async function createGumballGuard<
  DA extends GuardSetArgs = DefaultGuardSetArgs,
>(input: CreateGumballGuardInput<DA>): Promise<Instruction> {
  const { guards, groups, ...rest } = input;
  const data = new Uint8Array(
    getGumballGuardDataEncoder<DA>().encode({
      guards: guards ?? {},
      groups: groups ?? [],
    })
  );
  return await getInitializeGumballGuardInstructionAsync({ ...rest, data });
}
