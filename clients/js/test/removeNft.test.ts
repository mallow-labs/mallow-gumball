import {
  AccountState,
  fetchToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import type { Address } from '@solana/kit';
import test from 'ava';
import {
  fetchMaybeSellerHistory,
  fetchSellerHistory,
  findSellerHistoryPda,
  getAddNftInstructionAsync,
  getMerkleProof,
  getMerkleRoot,
  getRemoveNftInstructionAsync,
  TokenStandard,
} from '../src';
import { createNft, createProgrammableNft } from './_removeClaimSetup';
import {
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

const MPL_TOKEN_AUTH_RULES_PROGRAM_ID =
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address;

const tokenAccountOf = async (mint: string, owner: string) => {
  const [ata] = await findAssociatedTokenPda({
    mint: mint as any,
    owner: owner as any,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata;
};

test('it can remove nfts from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveNftInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);
  t.deepEqual(account.items, []);

  // Then nft is unfrozen and revoked.
  const token = await fetchToken(
    client.rpc,
    await tokenAccountOf(mint, client.payer.address)
  );
  t.is(token.data.state, AccountState.Initialized);
  t.is(token.data.owner, client.payer.address);
  t.is(token.data.delegate.__option, 'None');

  // Seller history should no longer exist.
  const [sellerHistoryPda] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerHistory = await fetchMaybeSellerHistory(
    client.rpc,
    sellerHistoryPda
  );
  t.false(sellerHistory.exists);
});

test('it can remove pnfts from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createProgrammableNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveNftInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint,
      index: 0,
      authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);
  t.deepEqual(account.items, []);

  // pNFT stays frozen but is no longer delegated.
  const token = await fetchToken(
    client.rpc,
    await tokenAccountOf(mint, client.payer.address)
  );
  t.is(token.data.state, AccountState.Frozen);
  t.is(token.data.owner, client.payer.address);
  t.is(token.data.delegate.__option, 'None');

  const [sellerHistoryPda] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerHistory = await fetchMaybeSellerHistory(
    client.rpc,
    sellerHistoryPda
  );
  t.false(sellerHistory.exists);
});

test('it can remove nfts at a lower index than last from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const [{ mint: mint0 }, { mint: mint1 }] = await Promise.all([
    createNft(client),
    createNft(client),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveNftInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint: mint0,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    isDrawn: false,
    isClaimed: false,
    isSettled: false,
    mint: mint1,
    seller: client.payer.address,
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });

  const token = await fetchToken(
    client.rpc,
    await tokenAccountOf(mint0, client.payer.address)
  );
  t.is(token.data.state, AccountState.Initialized);
  t.is(token.data.delegate.__option, 'None');
});

test('it can remove additional nfts from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2 },
  });
  const [{ mint: mint0 }, { mint: mint1 }] = await Promise.all([
    createNft(client),
    createNft(client),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveNftInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint: mint0,
      index: 0,
    }),
  ]);

  const [sellerHistoryPda] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerHistory = await fetchSellerHistory(client.rpc, sellerHistoryPda);
  t.is(sellerHistory.data.itemCount, 1n);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveNftInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint: mint1,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);
  t.deepEqual(account.items, []);
});

test('it cannot remove nfts when the machine is empty', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { mint } = await createNft(client);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getRemoveNftInstructionAsync({
        gumballMachine,
        authority: client.payer,
        seller: client.payer.address,
        mint,
        index: 0,
      }),
    ]),
    { message: /AccountNotInitialized/ }
  );
});

test('it cannot remove nfts as a different seller', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { mint } = await createNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
  ]);

  const other = await generateKeyPairSignerWithSol(client.svm);
  await t.throwsAsync(
    sendTransaction(client.svm, other, [
      await getRemoveNftInstructionAsync({
        gumballMachine,
        authority: other,
        seller: client.payer.address,
        mint,
        index: 0,
      }),
    ]),
    { message: /InvalidAuthority/ }
  );
});

test('it can remove another seller nft as the gumball authority', async (t) => {
  const client = await createClient();
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 1,
      sellersMerkleRoot: getMerkleRoot([seller.address]),
    },
  });
  const { mint } = await createNft(client, { owner: seller });

  await sendTransaction(client.svm, seller, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller,
      mint,
      args: {
        sellerProofPath: getMerkleProof([seller.address], seller.address),
      },
    }),
  ]);

  // The authority is not the seller, so the seller's token account must be
  // passed explicitly (the builder otherwise defaults it to the authority's ATA).
  await sendTransaction(client.svm, client.payer, [
    await getRemoveNftInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: seller.address,
      mint,
      tokenAccount: await tokenAccountOf(mint, seller.address),
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);

  const token = await fetchToken(
    client.rpc,
    await tokenAccountOf(mint, seller.address)
  );
  t.is(token.data.state, AccountState.Initialized);
  t.is(token.data.owner, seller.address);
  t.is(token.data.delegate.__option, 'None');
});

test('it can remove own nft as non gumball authority', async (t) => {
  const client = await createClient();
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 1,
      sellersMerkleRoot: getMerkleRoot([seller.address]),
    },
  });
  const { mint } = await createNft(client, { owner: seller });

  await sendTransaction(client.svm, seller, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller,
      mint,
      args: {
        sellerProofPath: getMerkleProof([seller.address], seller.address),
      },
    }),
  ]);

  await sendTransaction(client.svm, seller, [
    await getRemoveNftInstructionAsync({
      gumballMachine,
      authority: seller,
      seller: seller.address,
      mint,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);

  const token = await fetchToken(
    client.rpc,
    await tokenAccountOf(mint, seller.address)
  );
  t.is(token.data.state, AccountState.Initialized);
  t.is(token.data.owner, seller.address);
  t.is(token.data.delegate.__option, 'None');
});
