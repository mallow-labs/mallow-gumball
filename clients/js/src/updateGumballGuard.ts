import { type Instruction } from '@solana/kit';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  getUpdateGumballGuardInstruction,
  type UpdateGumballGuardInput as BaseUpdateGumballGuardInput,
} from './generated/instructions/updateGumballGuard';
import { GuardSetArgs } from './guards';
import {
  getGumballGuardDataEncoder,
  type GumballGuardDataArgs,
} from './hooked';

export type UpdateGumballGuardBuilderInput<
  DA extends GuardSetArgs = DefaultGuardSetArgs,
> = Omit<BaseUpdateGumballGuardInput, 'data'> & GumballGuardDataArgs<DA>;

/**
 * High-level `updateGumballGuard` builder: serializes the provided guards +
 * groups into the update instruction data.
 */
export function updateGumballGuard<
  DA extends GuardSetArgs = DefaultGuardSetArgs,
>(input: UpdateGumballGuardBuilderInput<DA>): Instruction {
  const { guards, groups, ...rest } = input;
  const data = new Uint8Array(
    getGumballGuardDataEncoder<DA>().encode({ guards, groups })
  );
  return getUpdateGumballGuardInstruction({ ...rest, data });
}
