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

test('it allows minting after the start date', async (t) => {
  // Given a gumball machine with a start date in the past.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      solPayment: some({ lamports: sol(1) }),
      startDate: some({ date: yesterday() }),
    },
  });

  // When a buyer draws from it.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  // Then the draw was successful.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
});

test('it forbids minting before the start date', async (t) => {
  // Given a gumball machine with a start date in the future.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { startDate: some({ date: tomorrow() }) },
  });

  // When we try to draw from it, then we expect a program error.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await t.throwsAsync(
    sendTransaction(client.svm, buyer, [
      COMPUTE_UNITS,
      await draw({ gumballMachine, payer: buyer, buyer }),
    ]),
    { message: /MintNotLive/ }
  );
});

test('it charges a bot tax when trying to mint before the start date', async (t) => {
  // Given a gumball machine with a bot tax and start date in the future.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      startDate: some({ date: tomorrow() }),
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
  t.regex(logs, /MintNotLive/);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 0n);
});
