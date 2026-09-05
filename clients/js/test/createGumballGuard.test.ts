import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import {
  createGumballGuard,
  emptyDefaultGuardSetArgs,
  findGumballGuardPda,
  type DefaultGuardSetArgs,
} from '../src';
import { getBalance } from './_settleSetup';
import {
  createClient,
  fetchGumballGuard,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from './_setup';

/** Convert an ISO date string to the unix-seconds bigint the guards store. */
const date = (iso: string) => BigInt(Date.parse(iso) / 1000);

test('it can create a gumball guard without guards', async (t) => {
  // Given a base address.
  const client = await createClient();
  const base = await generateKeyPairSigner();

  // When we create a new gumball guard without guards.
  await sendTransaction(client.svm, client.payer, [
    await createGumballGuard({
      base,
      authority: client.payer.address,
      payer: client.payer,
    }),
  ]);

  // Then a new gumball guard account was created with the expected data.
  const [gumballGuard] = await findGumballGuardPda({ base: base.address });
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.is(account.base, base.address);
  t.is(account.authority, client.payer.address);
  t.deepEqual(account.guards, emptyDefaultGuardSetArgs);
  t.deepEqual(account.groups, []);
});

test('it can create a gumball guard with guards', async (t) => {
  // Given a base address.
  const client = await createClient();
  const base = await generateKeyPairSigner();

  // When we create a new gumball guard with guards.
  const gatekeeperNetwork = (await generateKeyPairSigner()).address;
  const tokenMint = (await generateKeyPairSigner()).address;
  await sendTransaction(client.svm, client.payer, [
    await createGumballGuard({
      base,
      authority: client.payer.address,
      payer: client.payer,
      guards: {
        botTax: some({ lamports: sol(0.001), lastInstruction: true }),
        solPayment: some({ lamports: sol(1.5) }),
        startDate: some({ date: date('2023-03-07T16:13:00.000Z') }),
        endDate: some({ date: date('2023-03-08T16:13:00.000Z') }),
        gatekeeper: some({ gatekeeperNetwork, expireOnUse: true }),
        tokenPayment: some({ amount: 42, mint: tokenMint }),
      },
    }),
  ]);

  // Then a new gumball guard account was created with the expected data.
  const [gumballGuard] = await findGumballGuardPda({ base: base.address });
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.deepEqual(account.guards, {
    ...emptyDefaultGuardSetArgs,
    botTax: some({ lamports: sol(0.001), lastInstruction: true }),
    solPayment: some({ lamports: sol(1.5) }),
    startDate: some({ date: date('2023-03-07T16:13:00.000Z') }),
    endDate: some({ date: date('2023-03-08T16:13:00.000Z') }),
    gatekeeper: some({ gatekeeperNetwork, expireOnUse: true }),
    tokenPayment: some({ amount: 42n, mint: tokenMint }),
  });
  t.deepEqual(account.groups, []);
});

test('it can create a gumball guard with guard groups', async (t) => {
  // Given a base address.
  const client = await createClient();
  const base = await generateKeyPairSigner();

  // When we create a new gumball guard with guard groups.
  const gatekeeperNetwork = (await generateKeyPairSigner()).address;
  const tokenGateMint = (await generateKeyPairSigner()).address;
  const merkleRoot = new Uint8Array(Array(32).fill(42));
  await sendTransaction(client.svm, client.payer, [
    await createGumballGuard<DefaultGuardSetArgs>({
      base,
      authority: client.payer.address,
      payer: client.payer,
      guards: {
        botTax: some({ lamports: sol(0.01), lastInstruction: false }),
        endDate: some({ date: date('2022-09-06T16:00:00.000Z') }),
      },
      groups: [
        {
          label: 'VIP',
          guards: {
            startDate: some({ date: date('2022-09-05T16:00:00.000Z') }),
            allowList: some({ merkleRoot }),
            solPayment: some({ lamports: sol(1) }),
          },
        },
        {
          label: 'WLIST',
          guards: {
            startDate: some({ date: date('2022-09-05T18:00:00.000Z') }),
            tokenGate: some({ mint: tokenGateMint, amount: 1 }),
            solPayment: some({ lamports: sol(2) }),
          },
        },
        {
          label: 'PUBLIC',
          guards: {
            startDate: some({ date: date('2022-09-05T20:00:00.000Z') }),
            gatekeeper: some({ gatekeeperNetwork, expireOnUse: false }),
            solPayment: some({ lamports: sol(3) }),
          },
        },
      ],
    }),
  ]);

  // Then a new gumball guard account was created with the expected data.
  const [gumballGuard] = await findGumballGuardPda({ base: base.address });
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.deepEqual(account.guards, {
    ...emptyDefaultGuardSetArgs,
    botTax: some({ lamports: sol(0.01), lastInstruction: false }),
    endDate: some({ date: date('2022-09-06T16:00:00.000Z') }),
  });
  t.is(account.groups.length, 3);
  t.deepEqual(account.groups[0], {
    label: 'VIP',
    guards: {
      ...emptyDefaultGuardSetArgs,
      startDate: some({ date: date('2022-09-05T16:00:00.000Z') }),
      allowList: some({ merkleRoot }),
      solPayment: some({ lamports: sol(1) }),
    },
  });
  t.deepEqual(account.groups[1], {
    label: 'WLIST',
    guards: {
      ...emptyDefaultGuardSetArgs,
      startDate: some({ date: date('2022-09-05T18:00:00.000Z') }),
      tokenGate: some({ mint: tokenGateMint, amount: 1n }),
      solPayment: some({ lamports: sol(2) }),
    },
  });
  t.deepEqual(account.groups[2], {
    label: 'PUBLIC',
    guards: {
      ...emptyDefaultGuardSetArgs,
      startDate: some({ date: date('2022-09-05T20:00:00.000Z') }),
      gatekeeper: some({ gatekeeperNetwork, expireOnUse: false }),
      solPayment: some({ lamports: sol(3) }),
    },
  });
});

test('it fails to create a group with a label that is too long', async (t) => {
  // Given a base address.
  const client = await createClient();
  const base = await generateKeyPairSigner();

  // When we try to create a new Gumball Guard with a group label that is too long.
  await t.throwsAsync(
    createGumballGuard({
      base,
      authority: client.payer.address,
      payer: client.payer,
      guards: {},
      groups: [{ label: 'IAMALABELTHATISTOOLONG', guards: {} }],
    }),
    {
      message:
        /The provided group label \[IAMALABELTHATISTOOLONG\] is too long/,
    }
  );
});

test('it can create a gumball guard with an explicit authority', async (t) => {
  // Given a base address and an explicit authority.
  const client = await createClient();
  const base = await generateKeyPairSigner();
  const authority = (await generateKeyPairSigner()).address;

  // When we create a new Gumball Guard using that authority.
  await sendTransaction(client.svm, client.payer, [
    await createGumballGuard({ base, authority, payer: client.payer }),
  ]);

  // Then we expect the Gumball Guard's authority to be the given authority.
  const [gumballGuard] = await findGumballGuardPda({ base: base.address });
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.is(account.base, base.address);
  t.is(account.authority, authority);
});

test('it can create a gumball guard with an explicit payer', async (t) => {
  // Given a base address and an explicit payer with SOLs.
  const client = await createClient();
  const base = await generateKeyPairSigner();
  const payer = await generateKeyPairSignerWithSol(client.svm);
  const payerBalanceBefore = getBalance(client, payer.address);

  // When we create a new Gumball Guard using that payer.
  await sendTransaction(client.svm, payer, [
    await createGumballGuard({ base, authority: client.payer.address, payer }),
  ]);

  // Then the Gumball Guard was created successfully.
  const [gumballGuard] = await findGumballGuardPda({ base: base.address });
  const account = client.svm.getAccount(gumballGuard);
  t.true(Boolean(account && account.exists));

  // And the payer paid for the rent.
  const payerBalanceAfter = getBalance(client, payer.address);
  t.true(payerBalanceAfter < payerBalanceBefore);
});
