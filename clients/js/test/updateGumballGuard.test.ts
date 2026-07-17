import { some } from '@solana/kit';
import test from 'ava';
import {
  emptyDefaultGuardSetArgs,
  updateGumballGuard,
  type DefaultGuardSetArgs,
  type GumballGuardDataArgs,
} from '../src';
import {
  createClient,
  createGumballMachine,
  fetchGumballGuard,
  sendTransaction,
  sol,
} from './_setup';

const date = (iso: string) => BigInt(Date.parse(iso) / 1000);

test('it can update the guards of a gumball guard', async (t) => {
  // Given an existing gumball guard with defaults guards and groups.
  const client = await createClient();
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
    groups: [
      {
        label: 'OLD1',
        guards: {
          startDate: some({ date: date('2022-09-13T10:00:00.000Z') }),
          solPayment: some({ lamports: sol(2) }),
        },
      },
      {
        label: 'OLD2',
        guards: {
          startDate: some({ date: date('2022-09-13T12:00:00.000Z') }),
          solPayment: some({ lamports: sol(4) }),
        },
      },
    ],
  });

  // When we update all its guards — defaults and groups.
  await sendTransaction(client.svm, client.payer, [
    updateGumballGuard<DefaultGuardSetArgs>({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
      payer: client.payer,
      guards: {
        botTax: some({ lamports: sol(0.02), lastInstruction: false }),
      },
      groups: [
        {
          label: 'NEW1',
          guards: {
            startDate: some({ date: date('2022-09-15T10:00:00.000Z') }),
            solPayment: some({ lamports: sol(1) }),
            endDate: some({ date: date('2022-09-15T12:00:00.000Z') }),
          },
        },
        {
          label: 'NEW2',
          guards: {
            startDate: some({ date: date('2022-09-15T12:00:00.000Z') }),
            solPayment: some({ lamports: sol(3) }),
          },
        },
      ],
    }),
  ]);

  // Then all guards were updated as expected.
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.deepEqual(account.guards, {
    ...emptyDefaultGuardSetArgs,
    botTax: some({ lamports: sol(0.02), lastInstruction: false }),
  });
  t.deepEqual(account.groups, [
    {
      label: 'NEW1',
      guards: {
        ...emptyDefaultGuardSetArgs,
        startDate: some({ date: date('2022-09-15T10:00:00.000Z') }),
        solPayment: some({ lamports: sol(1) }),
        endDate: some({ date: date('2022-09-15T12:00:00.000Z') }),
      },
    },
    {
      label: 'NEW2',
      guards: {
        ...emptyDefaultGuardSetArgs,
        startDate: some({ date: date('2022-09-15T12:00:00.000Z') }),
        solPayment: some({ lamports: sol(3) }),
      },
    },
  ]);
});

test('it can remove all guards from a gumball guard', async (t) => {
  // Given an existing gumball guard with defaults guards and groups.
  const client = await createClient();
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
    groups: [
      {
        label: 'OLD1',
        guards: {
          startDate: some({ date: date('2022-09-13T10:00:00.000Z') }),
          solPayment: some({ lamports: sol(2) }),
        },
      },
      {
        label: 'OLD2',
        guards: {
          startDate: some({ date: date('2022-09-13T12:00:00.000Z') }),
          solPayment: some({ lamports: sol(4) }),
        },
      },
    ],
  });

  // When we update it so that it has no guards.
  await sendTransaction(client.svm, client.payer, [
    updateGumballGuard({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
      payer: client.payer,
      guards: {},
      groups: [],
    }),
  ]);

  // Then all guards were removed as expected.
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.deepEqual(account.guards, emptyDefaultGuardSetArgs);
  t.deepEqual(account.groups, []);
});

test('it can update a single guard by passing the current data', async (t) => {
  // Given an existing gumball guard with defaults guards and groups.
  const client = await createClient();
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
    groups: [
      {
        label: 'GROUP1',
        guards: {
          startDate: some({ date: date('2022-09-13T10:00:00.000Z') }),
          solPayment: some({ lamports: sol(2) }),
        },
      },
      {
        label: 'GROUP2',
        guards: {
          startDate: some({ date: date('2022-09-13T12:00:00.000Z') }),
          solPayment: some({ lamports: sol(4) }),
        },
      },
    ],
  });

  // And we have access to the data of that gumball guard.
  const { guards, groups } = fetchGumballGuard(
    client.svm,
    gumballGuard
  ) as GumballGuardDataArgs<DefaultGuardSetArgs>;

  // When we update one guard from one group and pass in the rest of the data.
  groups[1].guards.startDate = some({ date: date('2022-09-13T14:00:00.000Z') });
  await sendTransaction(client.svm, client.payer, [
    updateGumballGuard({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
      payer: client.payer,
      guards,
      groups,
    }),
  ]);

  // Then only that guard was updated.
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.deepEqual(account.guards, {
    ...emptyDefaultGuardSetArgs,
    botTax: some({ lamports: sol(0.01), lastInstruction: true }),
  });
  t.deepEqual(account.groups, [
    {
      label: 'GROUP1',
      guards: {
        ...emptyDefaultGuardSetArgs,
        startDate: some({ date: date('2022-09-13T10:00:00.000Z') }),
        solPayment: some({ lamports: sol(2) }),
      },
    },
    {
      label: 'GROUP2',
      guards: {
        ...emptyDefaultGuardSetArgs,
        startDate: some({ date: date('2022-09-13T14:00:00.000Z') }),
        solPayment: some({ lamports: sol(4) }),
      },
    },
  ]);
});
