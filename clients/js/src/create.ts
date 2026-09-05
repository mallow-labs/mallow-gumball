import {
  isOption,
  isSome,
  type GetMinimumBalanceForRentExemptionApi,
  type Instruction,
  type OptionOrNullable,
  type Rpc,
  type TransactionSigner,
} from '@solana/kit';
import { NATIVE_MINT } from './constants';
import { createGumballGuard } from './createGumballGuard';
import {
  getCreateGumballMachineInstructionsAsync,
  type CreateGumballMachineInput,
} from './createGumballMachine';
import { DefaultGuardSetArgs } from './defaultGuards';
import { getWrapInstruction, type TokenPaymentArgs } from './generated';
import { findGumballGuardPda } from './generated/pdas';
import { GuardSetArgs } from './guards';
import { GumballGuardDataArgs } from './hooked';

export type CreateInput<DA extends GuardSetArgs = DefaultGuardSetArgs> = Omit<
  CreateGumballMachineInput,
  'authority'
> & {
  authority: TransactionSigner;
} & Partial<GumballGuardDataArgs<DA>>;

/**
 * Creates a gumball machine + its gumball guard and wraps the machine with the
 * guard, returning the full instruction list (createAccount, initialize,
 * initializeGumballGuard, wrap). Needs an RPC to compute the machine's rent.
 */
export const create = async <DA extends GuardSetArgs = DefaultGuardSetArgs>(
  input: CreateInput<DA>,
  config: { rpc: Rpc<GetMinimumBalanceForRentExemptionApi> }
): Promise<Instruction[]> => {
  // Auto-set payment mint if solPayment or tokenPayment is set.
  input.settings.paymentMint = getPaymentMint(input);

  const { guards, groups, authority, ...rest } = input;
  const [gumballGuard] = await findGumballGuardPda({
    base: input.gumballMachine.address,
  });

  const machineInstructions = await getCreateGumballMachineInstructionsAsync(
    { ...rest, authority: authority.address },
    config
  );
  const guardInstruction = await createGumballGuard<DA>({
    base: input.gumballMachine,
    authority: authority.address,
    payer: input.payer,
    guards,
    groups,
  });
  const wrapInstruction = getWrapInstruction({
    gumballGuard,
    authority,
    machine: input.gumballMachine.address,
    machineAuthority: authority,
  });

  return [...machineInstructions, guardInstruction, wrapInstruction];
};

function getPaymentMint<DA extends GuardSetArgs = DefaultGuardSetArgs>(
  input: CreateInput<DA>
) {
  for (const group of input.groups ?? []) {
    const mint = getPaymentMintFromGuards(group.guards);
    if (mint) {
      return mint;
    }
  }
  return getPaymentMintFromGuards(input.guards);
}

// Guard settings accept `OptionOrNullable` — a raw value, `some(value)`,
// `none()`, or null/undefined. Resolve to the underlying value (or null).
function resolveGuardValue<T>(
  value: OptionOrNullable<T> | undefined
): T | null {
  if (value == null) return null;
  if (isOption(value)) return isSome(value) ? value.value : null;
  return value as T;
}

function getPaymentMintFromGuards(guards: Partial<GuardSetArgs> | undefined) {
  if (resolveGuardValue(guards?.solPayment)) {
    return NATIVE_MINT;
  }
  const tokenPayment = resolveGuardValue(
    guards?.tokenPayment as OptionOrNullable<TokenPaymentArgs> | undefined
  );
  if (tokenPayment) {
    return tokenPayment.mint;
  }
  const token2022Payment = resolveGuardValue(
    guards?.token2022Payment as OptionOrNullable<TokenPaymentArgs> | undefined
  );
  if (token2022Payment) {
    return token2022Payment.mint;
  }
  return NATIVE_MINT;
}
