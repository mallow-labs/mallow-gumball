import { getAddressDecoder } from '@solana/kit';
import test from 'ava';
import {
  fetchMaybeSellerHistory,
  fetchSellerHistory,
  findSellerHistoryPda,
  getAddCoreAssetInstructionAsync,
  getMerkleProof,
  getMerkleRoot,
  getRemoveCoreAssetInstructionAsync,
  TokenStandard,
} from '../src';
import { createCoreAsset } from './_removeClaimSetup';
import {
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  type Client,
} from './_setup';

// MPL-Core AssetV1: byte 0 is the Key discriminator, bytes 1..33 are the owner.
const coreAssetOwner = (client: Client, asset: string): string => {
  const account = client.svm.getAccount(asset as any);
  if (!account || !account.exists) throw new Error(`asset ${asset} not found`);
  const data = account.data as Uint8Array;
  return getAddressDecoder().decode(data.slice(1, 33));
};

test('it can remove core asset from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { asset } = await createCoreAsset(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveCoreAssetInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      asset,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);
  t.deepEqual(account.items, []);

  // Then the asset is returned to the seller.
  t.is(coreAssetOwner(client, asset), client.payer.address);

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

test('it can remove core asset at a lower index than last from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const [{ asset: asset0 }, { asset: asset1 }] = await Promise.all([
    createCoreAsset(client),
    createCoreAsset(client),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: asset0,
    }),
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: asset1,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveCoreAssetInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      asset: asset0,
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
    mint: asset1,
    seller: client.payer.address,
    tokenStandard: TokenStandard.Core,
    amount: 1,
  });

  t.is(coreAssetOwner(client, asset0), client.payer.address);
});

test('it can remove additional core asset from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2 },
  });
  const [{ asset: asset0 }, { asset: asset1 }] = await Promise.all([
    createCoreAsset(client),
    createCoreAsset(client),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: asset0,
    }),
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: asset1,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveCoreAssetInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      asset: asset0,
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
    await getRemoveCoreAssetInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      asset: asset1,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);
  t.deepEqual(account.items, []);
});

test('it cannot remove core asset when the machine is empty', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { asset } = await createCoreAsset(client);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getRemoveCoreAssetInstructionAsync({
        gumballMachine,
        authority: client.payer,
        seller: client.payer.address,
        asset,
        index: 0,
      }),
    ]),
    { message: /AccountNotInitialized/ }
  );
});

test('it cannot remove core asset as a different seller', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { asset } = await createCoreAsset(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
  ]);

  const other = await generateKeyPairSignerWithSol(client.svm);
  await t.throwsAsync(
    sendTransaction(client.svm, other, [
      await getRemoveCoreAssetInstructionAsync({
        gumballMachine,
        authority: other,
        seller: client.payer.address,
        asset,
        index: 0,
      }),
    ]),
    { message: /InvalidAuthority/ }
  );
});

test('it can remove another seller core asset as the gumball authority', async (t) => {
  const client = await createClient();
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 1,
      sellersMerkleRoot: getMerkleRoot([seller.address]),
    },
  });
  const { asset } = await createCoreAsset(client, { owner: seller });

  await sendTransaction(client.svm, seller, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller,
      asset,
      args: {
        sellerProofPath: getMerkleProof([seller.address], seller.address),
      },
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveCoreAssetInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: seller.address,
      asset,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);

  // The asset remains owned by its seller.
  t.is(coreAssetOwner(client, asset), seller.address);
});

test('it can remove own asset as non gumball authority', async (t) => {
  const client = await createClient();
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 1,
      sellersMerkleRoot: getMerkleRoot([seller.address]),
    },
  });
  const { asset } = await createCoreAsset(client, { owner: seller });

  await sendTransaction(client.svm, seller, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller,
      asset,
      args: {
        sellerProofPath: getMerkleProof([seller.address], seller.address),
      },
    }),
  ]);

  await sendTransaction(client.svm, seller, [
    await getRemoveCoreAssetInstructionAsync({
      gumballMachine,
      authority: seller,
      seller: seller.address,
      asset,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);

  t.is(coreAssetOwner(client, asset), seller.address);
});
