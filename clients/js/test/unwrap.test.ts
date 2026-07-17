import test from 'ava';
import { getUnwrapInstruction, getWrapInstruction } from '../src';
import { createGumballMachineOnly } from './_settleSetup';
import {
  createClient,
  createStandaloneGumballGuard,
  fetchGumballMachine,
  sendTransaction,
} from './_setup';

test('it can unwrap a gumball machine v2 from its gumball guard', async (t) => {
  // Given an existing gumball machine wrapped in a gumball guard.
  const client = await createClient();
  const { gumballMachine } = await createGumballMachineOnly(client);
  const { gumballGuard } = await createStandaloneGumballGuard(client);
  await sendTransaction(client.svm, client.payer, [
    getWrapInstruction({
      gumballGuard,
      authority: client.payer,
      machine: gumballMachine,
      machineAuthority: client.payer,
    }),
  ]);

  // When we unwrap the gumball machine from its gumball guard.
  await sendTransaction(client.svm, client.payer, [
    getUnwrapInstruction({
      gumballGuard,
      authority: client.payer,
      gumballMachine,
      gumballMachineAuthority: client.payer,
    }),
  ]);

  // Then the mint authority of the gumball machine is the authority again.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.authority, client.payer.address);
  t.is(account.mintAuthority, client.payer.address);
});
