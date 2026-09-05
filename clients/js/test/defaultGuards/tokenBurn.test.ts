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

test('it burns a specific token to allow minting', async (t) => {
  const client = await createClient();
  const [mint, buyerAta] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 1 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenBurn: some({ mint, amount: 1 }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenBurn: some({ mint }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
  t.is(fetchTokenAmount(client, buyerAta), 0n);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const [mint, buyerAta] = await createMintWithHolders(client, {
    holders: [{ owner: buyer.address, amount: 1 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenBurn: some({ mint, amount: 1 }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: { tokenBurn: some({ mint }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
  t.is(fetchTokenAmount(client, buyerAta), 0n);
});

test('it may burn multiple tokens from a specific mint', async (t) => {
  const client = await createClient();
  const [mint, buyerAta] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 42 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenBurn: some({ mint, amount: 5 }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenBurn: some({ mint }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
  t.is(fetchTokenAmount(client, buyerAta), 37n);
});

test('it fails to mint if there are not enough tokens to burn', async (t) => {
  const client = await createClient();
  const [mint, buyerAta] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 1 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { tokenBurn: some({ mint, amount: 2 }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { tokenBurn: some({ mint }) },
      }),
    ]),
    { message: /NotEnoughTokens/ }
  );

  t.is(fetchTokenAmount(client, buyerAta), 1n);
});

test('it charges a bot tax when trying to mint without the required amount of tokens', async (t) => {
  const client = await createClient();
  const [mint, buyerAta] = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 1 }],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenBurn: some({ mint, amount: 2 }),
    },
  });

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenBurn: some({ mint }) },
    }),
  ]);

  assertBotTax(t, logs, /NotEnoughTokens/);
  t.is(fetchTokenAmount(client, buyerAta), 1n);
});
