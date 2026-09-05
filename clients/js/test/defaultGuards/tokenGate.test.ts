import { some } from '@solana/kit';
import test from 'ava';
import { draw } from '../../src';
import {
  COMPUTE_UNITS,
  createClient,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from '../_setup';
import {
  assertBotTax,
  createLoadedGumballMachine,
  createMintWithHolders,
  fetchTokenAmount,
  sendForLogs,
} from './_guardsBSetup';

test('it allows minting when the payer owns a specific token', async (t) => {
  const client = await createClient();
  const [mint] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 1 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenGate: some({ mint, amount: 1 }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenGate: some({ mint }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const [mint] = await createMintWithHolders(client, {
    holders: [{ owner: buyer.address, amount: 1 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenGate: some({ mint, amount: 1 }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: { tokenGate: some({ mint }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
});

test('it allows minting when the payer owns multiple tokens from a specific mint', async (t) => {
  const client = await createClient();
  const [mint, buyerAta] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 42 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenGate: some({ mint, amount: 5 }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenGate: some({ mint }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  // The gate does not spend tokens: the payer still has 42.
  t.is(fetchTokenAmount(client, buyerAta), 42n);
});

test('it forbids minting when the owner does not own any required tokens', async (t) => {
  const client = await createClient();
  const [mint] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 0 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenGate: some({ mint, amount: 1 }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { tokenGate: some({ mint }) },
      }),
    ]),
    { message: /NotEnoughTokens/ }
  );
});

test('it forbids minting when the owner does not own enough tokens', async (t) => {
  const client = await createClient();
  const [mint] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 5 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenGate: some({ mint, amount: 10 }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { tokenGate: some({ mint }) },
      }),
    ]),
    { message: /NotEnoughTokens/ }
  );
});

test('it charges a bot tax when trying to mint without the right amount of tokens', async (t) => {
  const client = await createClient();
  const [mint] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 0 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenGate: some({ mint, amount: 1 }),
    },
  });

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenGate: some({ mint }) },
    }),
  ]);

  assertBotTax(t, logs, /NotEnoughTokens/);
});
