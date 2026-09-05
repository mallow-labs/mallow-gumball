import { some, type Address } from '@solana/kit';
import test from 'ava';
import { LiteSVM } from 'litesvm';
import { draw, findMintCounterPda, getMintCounterDecoder } from '../../src';
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

/** Read the mint-counter PDA's `count` straight off the ledger. */
const fetchMintCounterCount = (svm: LiteSVM, pda: Address): number => {
  const account = svm.getAccount(pda);
  if (!account || !account.exists)
    throw new Error(`Mint counter ${pda} missing`);
  return getMintCounterDecoder().decode(account.data).count;
};

test('it allows minting when the mint limit is not reached', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 5.
  const client = await createClient();
  const { gumballMachine, gumballGuard } = await createMachineWithGuards(
    client,
    {
      quantity: 2,
      guards: { mintLimit: some({ id: 1, limit: 5 }) },
    }
  );

  // When we draw from it.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { mintLimit: some({ id: 1 }) },
    }),
  ]);

  // Then minting was successful and the mint limit PDA was incremented.
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);
  const [counterPda] = await findMintCounterPda({
    id: 1,
    user: buyer.address,
    machine: gumballMachine,
    gumballGuard,
  });
  t.is(fetchMintCounterCount(client.svm, counterPda), 1);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 5.
  const client = await createClient();
  const { gumballMachine, gumballGuard } = await createMachineWithGuards(
    client,
    {
      quantity: 2,
      guards: { mintLimit: some({ id: 1, limit: 5 }) },
    }
  );

  // When we draw from it using a separate buyer, paid for by the authority.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: { mintLimit: some({ id: 1 }) },
    }),
  ]);

  // Then minting was successful and the buyer's mint limit PDA was incremented.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
  const [counterPda] = await findMintCounterPda({
    id: 1,
    user: buyer.address,
    machine: gumballMachine,
    gumballGuard,
  });
  t.is(fetchMintCounterCount(client.svm, counterPda), 1);
});

test('it forbids minting when the mint limit is reached', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    quantity: 2,
    guards: { mintLimit: some({ id: 42, limit: 1 }) },
  });

  // And the buyer already minted their item.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { mintLimit: some({ id: 42 }) },
    }),
  ]);

  // When that same buyer tries to draw again, then we expect an error.
  await t.throwsAsync(
    sendTransaction(client.svm, buyer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: buyer,
        buyer,
        mintArgs: { mintLimit: some({ id: 42 }) },
      }),
    ]),
    { message: /AllowedMintLimitReached/ }
  );
});

test('the mint limit is local to each wallet', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    quantity: 2,
    guards: { mintLimit: some({ id: 42, limit: 1 }) },
  });

  // And buyer A already minted their item.
  const buyerA = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyerA, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyerA,
      buyer: buyerA,
      mintArgs: { mintLimit: some({ id: 42 }) },
    }),
  ]);

  // When buyer B mints from the same Gumball Machine.
  const buyerB = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyerB, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyerB,
      buyer: buyerB,
      mintArgs: { mintLimit: some({ id: 42 }) },
    }),
  ]);

  // Then minting was successful as the limit is per wallet.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyerB.address).length, 1);
});

test('it charges a bot tax when trying to mint after the limit', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1 and a bot tax guard.
  const client = await createClient();
  const { gumballMachine } = await createMachineWithGuards(client, {
    quantity: 2,
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And the buyer already minted their item.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { mintLimit: some({ id: 42 }) },
    }),
  ]);

  // When the buyer tries to draw again.
  const logs = await sendAndGetLogs(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { mintLimit: some({ id: 42 }) },
    }),
  ]);

  // Then we expect a silent bot tax error and only one item redeemed.
  t.regex(logs, /Botting is taxed/);
  t.regex(logs, /AllowedMintLimitReached/);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);
});
