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
  sendAndGetLogs,
} from './_guardsASetup';

const DAY = 24 * 60 * 60;
const yesterday = (): bigint => BigInt(Math.floor(Date.now() / 1000) - DAY);
const tomorrow = (): bigint => BigInt(Math.floor(Date.now() / 1000) + DAY);

test('it allows minting before the end date', async (t) => {
  // Given a gumball machine with an end date in the future.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { endDate: some({ date: tomorrow() }) },
  });

  // When a buyer draws from it.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Then the draw was successful.
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);
});

test('it forbids minting after the end date', async (t) => {
  // Given a gumball machine with an end date in the past.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { endDate: some({ date: yesterday() }) },
  });

  // When we try to draw from it, then we expect a program error.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await t.throwsAsync(
    sendTransaction(client.svm, buyer, [
      COMPUTE_UNITS,
      await draw({ gumballMachine, payer: buyer, buyer }),
    ]),
    { message: /AfterEndDate/ }
  );
});

test('it charges a bot tax when trying to mint after the end date', async (t) => {
  // Given a gumball machine with a bot tax and end date in the past.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      endDate: some({ date: yesterday() }),
    },
  });

  // When we draw from it.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const logs = await sendAndGetLogs(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Then we expect a silent bot tax error and no item redeemed.
  t.regex(logs, /Botting is taxed/);
  t.regex(logs, /AfterEndDate/);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 0n);
});
