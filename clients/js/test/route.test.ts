import { generateKeyPairSigner, none, some, type Address } from '@solana/kit';
import test from 'ava';
import {
  findAllowListProofPda,
  findGumballGuardPda,
  getMerkleProof,
  getMerkleRoot,
  route,
} from '../src';
import {
  createClient,
  createGumballMachine,
  sendTransaction,
  sol,
} from './_setup';

const accountExists = (
  client: Awaited<ReturnType<typeof createClient>>,
  address: Address
) => {
  const account = client.svm.getAccount(address);
  return Boolean(account && account.exists);
};

test('it can call the route instruction of a specific guard', async (t) => {
  // Given a gumball machine with an allow list guard.
  const client = await createClient();
  const buyer = (await generateKeyPairSigner()).address;
  const allowedWallets = [
    buyer,
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB' as Address,
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS' as Address,
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG' as Address,
  ];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  // When we call the route instruction of the allow list guard.
  const merkleProof = getMerkleProof(allowedWallets, buyer);
  await sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      routeArgs: { path: 'proof', merkleRoot, merkleProof, buyer },
    }),
  ]);

  // Then the allow list proof PDA was created.
  const [gumballGuard] = await findGumballGuardPda({ base: gumballMachine });
  const [allowListProofPda] = await findAllowListProofPda({
    merkleRoot,
    user: buyer,
    machine: gumballMachine,
    gumballGuard,
  });
  t.true(accountExists(client, allowListProofPda));
});

test('it can call the route instruction of a specific guard on a group', async (t) => {
  // Given a Gumball Machine with two allowList guards in groups.
  const client = await createClient();
  const allowedWalletsA = [
    client.payer.address,
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB' as Address,
  ];
  const allowedWalletsB = [
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS' as Address,
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG' as Address,
  ];
  const merkleRootA = getMerkleRoot(allowedWalletsA);
  const merkleRootB = getMerkleRoot(allowedWalletsB);
  const { gumballMachine } = await createGumballMachine(client, {
    groups: [
      {
        label: 'GROUP1',
        guards: { allowList: some({ merkleRoot: merkleRootA }) },
      },
      {
        label: 'GROUP2',
        guards: { allowList: some({ merkleRoot: merkleRootB }) },
      },
    ],
  });

  // When we call the "proof" route of the guard in group 1.
  const merkleProofA = getMerkleProof(allowedWalletsA, client.payer.address);
  await sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      group: some('GROUP1'),
      routeArgs: {
        path: 'proof',
        merkleRoot: merkleRootA,
        merkleProof: merkleProofA,
      },
    }),
  ]);

  // Then the allow list proof PDA was created for group 1.
  const [gumballGuard] = await findGumballGuardPda({ base: gumballMachine });
  const [allowListProofPdaA] = await findAllowListProofPda({
    merkleRoot: merkleRootA,
    user: client.payer.address,
    machine: gumballMachine,
    gumballGuard,
  });
  t.true(accountExists(client, allowListProofPdaA));

  // But not for group 2.
  const [allowListProofPdaB] = await findAllowListProofPda({
    merkleRoot: merkleRootB,
    user: client.payer.address,
    machine: gumballMachine,
    gumballGuard,
  });
  t.false(accountExists(client, allowListProofPdaB));
});

test('it cannot call the route instruction of a guard that does not support it', async (t) => {
  // Given a gumball machine with a bot tax guard which does not support route.
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
  });

  // When we try to call the route instruction of the bot tax guard.
  const promise = sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'botTax',
      routeArgs: {},
    }),
  ]);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InstructionNotFound/ });
});

test('it must provide a group label if the gumball guard has groups', async (t) => {
  // Given a gumball machine with an allow list guard in a group.
  const client = await createClient();
  const allowedWallets = [client.payer.address];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { gumballMachine } = await createGumballMachine(client, {
    groups: [{ label: 'GROUP1', guards: { allowList: some({ merkleRoot }) } }],
  });

  // When we try to call the route instruction without a group label.
  const merkleProof = getMerkleProof(allowedWallets, allowedWallets[0]);
  const promise = sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      group: none(),
      routeArgs: { path: 'proof', merkleRoot, merkleProof },
    }),
  ]);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /RequiredGroupLabelNotFound/ });
});

test('it must not provide a group label if the gumball guard does not have groups', async (t) => {
  // Given a gumball machine with an allow list guard and no groups.
  const client = await createClient();
  const allowedWallets = [client.payer.address];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { allowList: some({ merkleRoot }) },
  });

  // When we try to call the route instruction with a group label.
  const merkleProof = getMerkleProof(allowedWallets, allowedWallets[0]);
  const promise = sendTransaction(client.svm, client.payer, [
    await route({
      machine: gumballMachine,
      payer: client.payer,
      guard: 'allowList',
      group: some('GROUPX'),
      routeArgs: { path: 'proof', merkleRoot, merkleProof },
    }),
  ]);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /GroupNotFound/ });
});
