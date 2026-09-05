import { none, some } from '@solana/kit';
import test from 'ava';
import {
  createClient,
  createStandaloneGumballGuard,
  fetchGumballGuard,
  sol,
} from './_setup';

/**
 * This is the highest-risk part of the port: the features-bitset + per-guard
 * codec. We set three guards spread across the bitset (botTax at bit 0, startDate
 * and solPayment mid-set) and assert both the set guards decode with the correct
 * values AND that the unset guards decode as `none()`.
 */
test('it round-trips a guard set through the features bitset + guard codec', async (t) => {
  const client = await createClient();

  const startDate = 1_678_205_580n; // 2023-03-07T16:13:00Z

  const { base, gumballGuard } = await createStandaloneGumballGuard(client, {
    guards: {
      botTax: some({ lamports: sol(0.001), lastInstruction: true }),
      solPayment: some({ lamports: sol(1.5) }),
      startDate: some({ date: startDate }),
    },
  });

  const account = fetchGumballGuard(client.svm, gumballGuard);

  // Base account fields.
  t.is(account.base, base);
  t.is(account.authority, client.payer.address);
  t.deepEqual(account.groups, []);

  // The three set guards decode back with their exact values.
  t.deepEqual(
    account.guards.botTax,
    some({ lamports: sol(0.001), lastInstruction: true })
  );
  t.deepEqual(account.guards.solPayment, some({ lamports: sol(1.5) }));
  t.deepEqual(account.guards.startDate, some({ date: startDate }));

  // A representative sample of the unset guards decode as none() — proving the
  // bitset only flags the three guards we actually set.
  t.deepEqual(account.guards.tokenPayment, none());
  t.deepEqual(account.guards.endDate, none());
  t.deepEqual(account.guards.gatekeeper, none());
  t.deepEqual(account.guards.mintLimit, none());
  t.deepEqual(account.guards.allowList, none());
  t.deepEqual(account.guards.programGate, none());
  t.deepEqual(account.guards.token2022Payment, none());
});

test('it round-trips guard groups', async (t) => {
  const client = await createClient();

  const { gumballGuard } = await createStandaloneGumballGuard(client, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: false }),
    },
    groups: [
      {
        label: 'VIP',
        guards: {
          solPayment: some({ lamports: sol(1) }),
          startDate: some({ date: 1_662_393_600n }),
        },
      },
      {
        label: 'PUBLIC',
        guards: { solPayment: some({ lamports: sol(3) }) },
      },
    ],
  });

  const account = fetchGumballGuard(client.svm, gumballGuard);

  t.deepEqual(
    account.guards.botTax,
    some({ lamports: sol(0.01), lastInstruction: false })
  );
  t.is(account.groups.length, 2);
  t.is(account.groups[0].label, 'VIP');
  t.deepEqual(account.groups[0].guards.solPayment, some({ lamports: sol(1) }));
  t.deepEqual(
    account.groups[0].guards.startDate,
    some({ date: 1_662_393_600n })
  );
  t.deepEqual(account.groups[0].guards.botTax, none());
  t.is(account.groups[1].label, 'PUBLIC');
  t.deepEqual(account.groups[1].guards.solPayment, some({ lamports: sol(3) }));
});
