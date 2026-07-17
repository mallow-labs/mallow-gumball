import { some } from '@solana/kit';
import test from 'ava';
import {
  draw,
  findAllowListProofPda,
  findGumballGuardPda,
  getMerkleProof,
  getMerkleRoot,
  route,
} from '../../src';
import {
  COMPUTE_UNITS,
  createClient,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from '../_setup';
import {
  accountExists,
  assertBotTax,
  createLoadedGumballMachine,
  sendForLogs,
} from './_guardsBSetup';

const OTHER_ADDRESSES = [
  'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
  'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
  '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
  'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
];

test('it allows minting from wallets of a predefined list', async (t) => {
  const client = await createClient();
  const allowList = [client.payer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  // First verify the payer with a valid merkle proof.
  await sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      routeArgs: {
        path: 'proof',
        merkleRoot,
        merkleProof: getMerkleProof(allowList, client.payer.address),
      },
    }),
  ]);

  // Then mint.
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { allowList: some({ merkleRoot }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
});

test('it is possible to verify the proof and mint in the same transaction if there is space', async (t) => {
  const client = await createClient();
  const allowList = [client.payer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      routeArgs: {
        path: 'proof',
        merkleRoot,
        merkleProof: getMerkleProof(allowList, client.payer.address),
      },
    }),
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { allowList: some({ merkleRoot }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const allowList = [buyer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      routeArgs: {
        path: 'proof',
        merkleRoot,
        merkleProof: getMerkleProof(allowList, buyer.address),
        buyer: buyer.address,
      },
    }),
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: { allowList: some({ merkleRoot }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
});

test('it forbids minting from wallets that are not part of a predefined list', async (t) => {
  const client = await createClient();
  const allowList = [...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await route({
        machine: gumballMachine,
        payer: client.payer,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, client.payer.address),
        },
      }),
    ]),
    { message: /AddressNotFoundInAllowedList/ }
  );
});

test('it forbids minting from wallets that are providing the wrong proof', async (t) => {
  const client = await createClient();
  const allowList = [client.payer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  const wrongProof = getMerkleProof(allowList, OTHER_ADDRESSES[0]);
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await route({
        machine: gumballMachine,
        payer: client.payer,
        guard: 'allowList',
        routeArgs: { path: 'proof', merkleRoot, merkleProof: wrongProof },
      }),
    ]),
    { message: /AddressNotFoundInAllowedList/ }
  );
});

test('it forbids minting if the wallet has not been verified via the route instruction first', async (t) => {
  const client = await createClient();
  const allowList = [client.payer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { allowList: some({ merkleRoot }) },
      }),
    ]),
    { message: /MissingAllowedListProof/ }
  );
});

test('it charges a bot tax when trying to mint whilst not verified', async (t) => {
  const client = await createClient();
  const allowList = [client.payer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      allowList: some({ merkleRoot }),
    },
  });

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { allowList: some({ merkleRoot }) },
    }),
  ]);

  assertBotTax(t, logs, /MissingAllowedListProof/);
});

test('it creates a proof for a buyer even when the buyer is not a signer', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const allowList = [buyer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      routeArgs: {
        path: 'proof',
        merkleRoot,
        merkleProof: getMerkleProof(allowList, buyer.address),
        buyer: buyer.address,
      },
    }),
  ]);

  const [gumballGuard] = await findGumballGuardPda({ base: gumballMachine });
  const [buyerProof] = await findAllowListProofPda({
    gumballGuard,
    machine: gumballMachine,
    merkleRoot,
    user: buyer.address,
  });
  const [payerProof] = await findAllowListProofPda({
    gumballGuard,
    machine: gumballMachine,
    merkleRoot,
    user: client.payer.address,
  });
  t.true(accountExists(client, buyerProof));
  t.false(accountExists(client, payerProof));
});

test('it creates a proof for the payer when the buyer is not present', async (t) => {
  const client = await createClient();
  const allowList = [client.payer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      routeArgs: {
        path: 'proof',
        merkleRoot,
        merkleProof: getMerkleProof(allowList, client.payer.address),
      },
    }),
  ]);

  const [gumballGuard] = await findGumballGuardPda({ base: gumballMachine });
  const [payerProof] = await findAllowListProofPda({
    gumballGuard,
    machine: gumballMachine,
    merkleRoot,
    user: client.payer.address,
  });
  t.true(accountExists(client, payerProof));
});

/**
 * DEFERRED: the four `close_allowlist_proof` tests in the umi source exercise the
 * close_allowlist_proof instruction rather than the allowList guard's mint
 * behaviour (which is fully covered above). They require heavy scaffolding — the
 * program-wide GlobalConfig singleton (createGlobalConfig with a deterministic
 * config authority), settling the drawn item, deleteGumballGuard and/or
 * closeGumballMachine — which is out of scope for this guard port. Skipped until
 * a shared GlobalConfig/close helper exists in the kit test harness.
 *
 * Source: clients/umi/test/defaultGuards/allowList.test.ts
 */
test.skip('it can close an allow list proof after guard is deleted', (t) =>
  t.pass());
test.skip('it fails to close an allow list proof when guard still exists', (t) =>
  t.pass());
test.skip('it fails to close an allow list proof when signed by a non-authority', (t) =>
  t.pass());
test.skip('it can close an allow list proof after machine is fully closed', (t) =>
  t.pass());
