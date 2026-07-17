import { some } from '@solana/kit';
import test from 'ava';
import { draw } from '../../src';
import {
  COMPUTE_UNITS,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from '../_setup';
import {
  createClient,
  createMachineWithGuards,
  memoInstruction,
  sendAndGetLogs,
} from './_guardsASetup';

test('it does nothing if all conditions are valid', async (t) => {
  // Given a gumball machine with a bot tax guard.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
  });

  // When we draw from it as the last instruction.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Then the draw was successful.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
});

test('it optionally charges a bot tax if the mint instruction is not the last one', async (t) => {
  // Given a gumball machine with a bot tax guard with lastInstruction set to true.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
  });

  // When we draw whilst having more instructions after the draw instruction.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const logs = await sendAndGetLogs(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
    memoInstruction('I am a post-mint instruction'),
  ]);

  // Then we expect a silent bot tax error and no item redeemed.
  t.regex(logs, /Botting is taxed/);
  t.regex(logs, /MintNotLastTransaction/);
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 0n);
});
