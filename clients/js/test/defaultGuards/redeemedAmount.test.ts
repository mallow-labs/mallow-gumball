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

test('it allows minting until a threshold of NFTs have been redeemed', async (t) => {
  // Given a loaded Gumball Machine with a redeemedAmount guard (threshold of 1).
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    quantity: 2,
    guards: { redeemedAmount: some({ maximum: 1 }) },
  });

  // When we draw its first item.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Then minting was successful.
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);
});

test('it forbids minting once the redeemed threshold has been reached', async (t) => {
  // Given a loaded Gumball Machine with a redeemedAmount guard (threshold of 1).
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    quantity: 2,
    guards: { redeemedAmount: some({ maximum: 1 }) },
  });

  // And assuming its first item has already been minted.
  const buyer1 = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer1, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer1, buyer: buyer1 }),
  ]);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);

  // When we try to draw its second item, then we expect a program error.
  const buyer2 = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await t.throwsAsync(
    sendTransaction(client.svm, buyer2, [
      COMPUTE_UNITS,
      await draw({ gumballMachine, payer: buyer2, buyer: buyer2 }),
    ]),
    { message: /MaximumRedeemedAmount/ }
  );
});

test('it charges a bot tax when trying to mint once the threshold has been reached', async (t) => {
  // Given a loaded Gumball Machine with a bot tax guard and a redeemedAmount
  // guard (threshold of 1).
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    quantity: 2,
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      redeemedAmount: some({ maximum: 1 }),
    },
  });

  // And assuming its first item has already been minted.
  const buyer1 = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer1, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer1, buyer: buyer1 }),
  ]);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);

  // When we try to draw its second item.
  const buyer2 = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const logs = await sendAndGetLogs(client.svm, buyer2, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer2, buyer: buyer2 }),
  ]);

  // Then we expect a silent bot tax error and still only one item redeemed.
  t.regex(logs, /Botting is taxed/);
  t.regex(logs, /MaximumRedeemedAmount/);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);
});
