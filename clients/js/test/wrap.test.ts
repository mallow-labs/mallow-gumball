import { generateKeyPairSigner, type Address } from '@solana/kit';
import test from 'ava';
import { getWrapInstruction } from '../src';
import { createGumballMachineOnly } from './_settleSetup';
import {
  createClient,
  createStandaloneGumballGuard,
  fetchGumballMachine,
  sendTransaction,
  type Client,
} from './_setup';

const wrap = (client: Client, machine: Address, gumballGuard: Address) =>
  sendTransaction(client.svm, client.payer, [
    getWrapInstruction({
      gumballGuard,
      authority: client.payer,
      machine,
      machineAuthority: client.payer,
    }),
  ]);

test('it can wrap a gumball machine v2 in a gumball guard', async (t) => {
  // Given an existing (unwrapped) gumball machine and gumball guard.
  const client = await createClient();
  const base = await generateKeyPairSigner();
  const { gumballMachine } = await createGumballMachineOnly(client, {
    gumballMachine: base,
  });
  const { gumballGuard } = await createStandaloneGumballGuard(client, { base });

  // When we wrap the gumball machine in the gumball guard.
  await wrap(client, gumballMachine, gumballGuard);

  // Then the mint authority of the gumball machine is the gumball guard.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.authority, client.payer.address);
  t.is(account.mintAuthority, gumballGuard);
});

test('it refuses a guard with a different immutable base', async (t) => {
  // Given a gumball machine already wrapped in a first gumball guard.
  const client = await createClient();
  const base = await generateKeyPairSigner();
  const { gumballMachine } = await createGumballMachineOnly(client, {
    gumballMachine: base,
  });
  const { gumballGuard: gumballGuardA } = await createStandaloneGumballGuard(
    client,
    { base }
  );
  await wrap(client, gumballMachine, gumballGuardA);

  // When we wrap the gumball machine in a different gumball guard.
  const { gumballGuard: gumballGuardB } =
    await createStandaloneGumballGuard(client);
  await t.throwsAsync(wrap(client, gumballMachine, gumballGuardB));

  // Then the mint authority of the gumball machine was updated accordingly.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.authority, client.payer.address);
  t.is(account.mintAuthority, gumballGuardA);
});
