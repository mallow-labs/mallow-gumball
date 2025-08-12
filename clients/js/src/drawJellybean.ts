import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import {
  none,
  Option,
  OptionOrNullable,
  publicKey,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { DefaultGuardSetMintArgs } from './defaultGuards';
import {
  drawJellybean as baseDrawJellybean,
  DrawJellybeanInstructionAccounts,
} from './generated/instructions/drawJellybean';
import { MachineType } from './generated/types';
import {
  GuardRepository,
  GuardSetMintArgs,
  GumballGuardProgram,
  MintContext,
  parseGuardRemainingAccounts,
  parseMintArgs,
} from './guards';
import { findGumballGuardPda } from './hooked';

export { DrawJellybeanInstructionAccounts };

export type DrawJellybeanInstructionData<MA extends GuardSetMintArgs> = {
  discriminator: Array<number>;
  mintArgs: MA;
  group: Option<string>;
};

export type DrawJellybeanInstructionDataArgs<MA extends GuardSetMintArgs> = {
  mintArgs?: Partial<MA>;
  group?: OptionOrNullable<string>;
  /** @defaultValue `TokenStandard.NonFungible`. */
  tokenStandard?: TokenStandard;
};

export function drawJellybean<
  MA extends GuardSetMintArgs = DefaultGuardSetMintArgs,
>(
  context: Parameters<typeof baseDrawJellybean>[0] & {
    guards: GuardRepository;
  },
  input: DrawJellybeanInstructionAccounts &
    DrawJellybeanInstructionDataArgs<
      MA extends undefined ? DefaultGuardSetMintArgs : MA
    >
): TransactionBuilder {
  const { mintArgs = {}, group = none(), ...rest } = input;

  // Parsing mint data.
  const program = context.programs.get<GumballGuardProgram>('gumballGuard');
  const jellybeanMachine = publicKey(input.jellybeanMachine, false);
  const mintContext: MintContext = {
    buyer: input.buyer ?? context.identity,
    payer: input.payer ?? context.payer,
    machine: jellybeanMachine,
    gumballGuard: publicKey(
      input.gumballGuard ??
        findGumballGuardPda(context, { base: jellybeanMachine }),
      false
    ),
    machineType: MachineType.Jellybean,
  };
  const { data, remainingAccounts } = parseMintArgs<
    MA extends undefined ? DefaultGuardSetMintArgs : MA
  >(context, program, mintContext, mintArgs);

  const ix = baseDrawJellybean(context, {
    ...rest,
    mintArgs: data,
    group,
  }).items[0];

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);
  ix.bytesCreatedOnChain = 0;

  return transactionBuilder([ix]);
}
