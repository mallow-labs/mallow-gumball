import {
  generateKeyPairSigner,
  some,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import {
  getCreateGumballMachineInstructionsAsync,
  type BuyBackConfigArgs,
  type FeeConfigArgs,
  type GumballSettingsArgs,
} from '../src';
import { defaultGumballSettings, sendTransaction, type Client } from './_setup';

/**
 * Create a gumball machine WITHOUT wrapping a gumball guard, via the low-level
 * `getCreateGumballMachineInstructionsAsync` builder. Unlike the high-level
 * `create` (which always wraps a guard and hands mint authority to the guard
 * PDA), this leaves the machine as its own mint authority — mirroring the umi
 * `create` helper when no `guards` are passed. Needed by the authority / delete
 * / buyback lifecycle tests that assert on the un-wrapped machine.
 */
export const createMachineNoGuard = async (
  client: Client,
  input: {
    gumballMachine?: TransactionSigner;
    authority?: TransactionSigner;
    settings?: Partial<GumballSettingsArgs>;
    buyBackConfig?: BuyBackConfigArgs;
    feeConfig?: FeeConfigArgs;
    disablePrimarySplit?: boolean;
    disableRoyalties?: boolean;
  } = {}
): Promise<{ gumballMachine: Address; authority: TransactionSigner }> => {
  const gumballMachine =
    input.gumballMachine ?? (await generateKeyPairSigner());
  const authority = input.authority ?? client.payer;
  const instructions = await getCreateGumballMachineInstructionsAsync(
    {
      gumballMachine,
      authority: authority.address,
      payer: client.payer,
      settings: defaultGumballSettings(input.settings),
      ...(input.feeConfig ? { feeConfig: some(input.feeConfig) } : {}),
      ...(input.buyBackConfig
        ? { buyBackConfig: some(input.buyBackConfig) }
        : {}),
      ...(input.disablePrimarySplit !== undefined
        ? { disablePrimarySplit: input.disablePrimarySplit }
        : {}),
      ...(input.disableRoyalties !== undefined
        ? { disableRoyalties: input.disableRoyalties }
        : {}),
    },
    { rpc: client.rpc }
  );
  await sendTransaction(client.svm, client.payer, instructions);
  return { gumballMachine: gumballMachine.address, authority };
};
