import { some } from '@solana/kit';
import test from 'ava';
import {
  draw,
  findAllocationTrackerPda,
  findGumballGuardPda,
  getAllocationTrackerCodec,
  route,
} from '../../src';
import {
  COMPUTE_UNITS,
  createClient,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
  type Client,
} from '../_setup';
import {
  assertBotTax,
  createLoadedGumballMachine,
  sendForLogs,
} from './_guardsBSetup';

const fetchTrackerCount = async (
  client: Client,
  gumballMachine: string,
  id: number
): Promise<number> => {
  const [gumballGuard] = await findGumballGuardPda({
    base: gumballMachine as never,
  });
  const [tracker] = await findAllocationTrackerPda({
    id,
    machine: gumballMachine as never,
    gumballGuard,
  });
  const account = client.svm.getAccount(tracker);
  if (!account.exists) throw new Error('Allocation tracker not found');
  return getAllocationTrackerCodec().decode(account.data as Uint8Array).count;
};

test('it allows minting when the allocation limit is not reached', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createLoadedGumballMachine(client, {
    itemCount: 2,
    guards: { allocation: some({ id: 1, limit: 5 }) },
  });

  // Initialize the allocation PDA via the route instruction.
  await sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allocation',
      routeArgs: { id: 1, gumballGuardAuthority: client.payer },
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { allocation: some({ id: 1 }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  t.is(await fetchTrackerCount(client, gumballMachine, 1), 1);
});

test('it forbids minting when the allocation limit is reached', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createLoadedGumballMachine(client, {
    itemCount: 2,
    guards: { allocation: some({ id: 1, limit: 1 }) },
  });

  await sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allocation',
      routeArgs: { id: 1, gumballGuardAuthority: client.payer },
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { allocation: some({ id: 1 }) },
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { allocation: some({ id: 1 }) },
      }),
    ]),
    { message: /Allocation limit was reached/ }
  );
});

test('the allocation limit is local to each id', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createLoadedGumballMachine(client, {
    itemCount: 2,
    guards: {},
    groups: [
      { label: 'GROUPA', guards: { allocation: some({ id: 1, limit: 1 }) } },
      { label: 'GROUPB', guards: { allocation: some({ id: 2, limit: 1 }) } },
    ],
  });

  // Initialize both allocation PDAs.
  await sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allocation',
      routeArgs: { id: 1, gumballGuardAuthority: client.payer },
      group: some('GROUPA'),
    }),
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allocation',
      routeArgs: { id: 2, gumballGuardAuthority: client.payer },
      group: some('GROUPB'),
    }),
  ]);

  // Buyer A mints from GROUPA.
  const buyerA = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: buyerA,
      mintArgs: { allocation: some({ id: 1 }) },
      group: some('GROUPA'),
    }),
  ]);
  let account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyerA.address).length, 1);

  // Buyer B mints from GROUPB — succeeds because the limit is per id.
  const buyerB = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: buyerB,
      mintArgs: { allocation: some({ id: 2 }) },
      group: some('GROUPB'),
    }),
  ]);
  account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyerB.address).length, 1);
});

test('it charges a bot tax when trying to mint after the limit', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createLoadedGumballMachine(client, {
    itemCount: 2,
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      allocation: some({ id: 1, limit: 1 }),
    },
  });

  await sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allocation',
      routeArgs: { id: 1, gumballGuardAuthority: client.payer },
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { allocation: some({ id: 1 }) },
    }),
  ]);

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { allocation: some({ id: 1 }) },
    }),
  ]);

  assertBotTax(t, logs, /Allocation limit was reached/);
});
