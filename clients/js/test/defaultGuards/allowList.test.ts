import {
  generateKeyPairSigner,
  some,
  type Address,
  type Instruction,
} from '@solana/kit';
import test from 'ava';
import {
  draw,
  findAllowListProofPda,
  findGumballGuardPda,
  getAddNftInstructionAsync,
  getCloseAllowlistProofInstructionAsync,
  getCloseGumballMachineInstructionAsync,
  getDeleteGumballGuardInstructionAsync,
  getMerkleProof,
  getMerkleRoot,
  getSettleNftSaleInstructionAsync,
  getStartSaleInstruction,
  route,
} from '../../src';
import { createNft } from '../_nftKit';
import {
  COMPUTE_UNITS,
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  setupGlobalConfig,
  sol,
  type Client,
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

// ---------------------------------------------------------------------------
// close_allowlist_proof
// ---------------------------------------------------------------------------

/**
 * A machine with the allow-list guard and `itemCount` loaded nfts. The payer is
 * verified through the route instruction and draws one item in the same
 * transaction. With a single item that draw ends the sale, which is what later
 * lets the guard be deleted or the machine closed.
 */
const drawWithAllowList = async (client: Client, itemCount: number) => {
  const allowList = [client.payer.address, ...OTHER_ADDRESSES];
  const merkleRoot = getMerkleRoot(allowList);
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    settings: { itemCapacity: itemCount },
    guards: { allowList: some({ merkleRoot }) },
  });

  const mints: Address[] = [];
  const loadInstructions: Instruction[] = [COMPUTE_UNITS];
  for (let i = 0; i < itemCount; i += 1) {
    const { mint } = await createNft(client);
    mints.push(mint);
    loadInstructions.push(
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: client.payer,
        mint,
      })
    );
  }
  loadInstructions.push(
    getStartSaleInstruction({ gumballMachine, authority: client.payer })
  );
  await sendTransaction(client.svm, client.payer, loadInstructions);

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

  const [allowListProof] = await findAllowListProofPda({
    gumballGuard,
    machine: gumballMachine,
    merkleRoot,
    user: client.payer.address,
  });
  return { gumballMachine, gumballGuard, allowListProof, mints };
};

/** Settle the single drawn nft of a one-item machine (payer bought from payer). */
const settleOnlyItem = async (
  client: Client,
  gumballMachine: Address,
  mint: Address
) =>
  sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: client.payer.address,
      mint,
      creators: [client.payer.address],
    }),
  ]);

test('it can close an allow list proof after guard is deleted', async (t) => {
  const client = await createClient();
  const { gumballMachine, gumballGuard, allowListProof, mints } =
    await drawWithAllowList(client, 1);
  t.true(accountExists(client, allowListProof));

  // Settle the only item so the guard can be deleted, then delete it.
  await settleOnlyItem(client, gumballMachine, mints[0]);
  await sendTransaction(client.svm, client.payer, [
    await getDeleteGumballGuardInstructionAsync({
      gumballGuard,
      authority: client.payer,
      machine: gumballMachine,
    }),
  ]);

  // The protocol's account-fee authority can now reclaim the proof's rent.
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);
  await sendTransaction(client.svm, client.payer, [
    await getCloseAllowlistProofInstructionAsync({
      authority,
      gumballGuard,
      allowListProof,
    }),
  ]);
  t.false(accountExists(client, allowListProof));
});

test('it fails to close an allow list proof when guard still exists', async (t) => {
  const client = await createClient();
  // Two items: the draw leaves the sale live and the guard in place.
  const { gumballGuard, allowListProof } = await drawWithAllowList(client, 2);
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getCloseAllowlistProofInstructionAsync({
        authority,
        gumballGuard,
        allowListProof,
      }),
    ]),
    { message: /InvalidMachineState/ }
  );
  t.true(accountExists(client, allowListProof));
});

test('it fails to close an allow list proof when signed by a non-authority', async (t) => {
  const client = await createClient();
  const { gumballMachine, gumballGuard, allowListProof, mints } =
    await drawWithAllowList(client, 1);
  await settleOnlyItem(client, gumballMachine, mints[0]);
  await sendTransaction(client.svm, client.payer, [
    await getDeleteGumballGuardInstructionAsync({
      gumballGuard,
      authority: client.payer,
      machine: gumballMachine,
    }),
  ]);
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  // A wallet other than the account-fee authority cannot reclaim the rent.
  const randomSigner = await generateKeyPairSigner();
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getCloseAllowlistProofInstructionAsync({
        authority: randomSigner,
        gumballGuard,
        allowListProof,
      }),
    ]),
    { message: /MissingRequiredSignature/ }
  );
  t.true(accountExists(client, allowListProof));
});

test('it can close an allow list proof after machine is fully closed', async (t) => {
  const client = await createClient();
  const { gumballMachine, gumballGuard, allowListProof, mints } =
    await drawWithAllowList(client, 1);
  await settleOnlyItem(client, gumballMachine, mints[0]);

  // Close the machine and its guard together.
  await sendTransaction(client.svm, client.payer, [
    await getCloseGumballMachineInstructionAsync({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
    }),
  ]);
  t.false(accountExists(client, gumballMachine));
  t.false(accountExists(client, gumballGuard));

  // The proof outlives both and is reclaimed by the account-fee authority.
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);
  await sendTransaction(client.svm, client.payer, [
    await getCloseAllowlistProofInstructionAsync({
      authority,
      gumballGuard,
      allowListProof,
    }),
  ]);
  t.false(accountExists(client, allowListProof));
});
