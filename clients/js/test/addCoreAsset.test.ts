import { some } from '@solana/kit';
import test from 'ava';
import {
  draw,
  getAddCoreAssetInstructionAsync,
  getMerkleProof,
  getMerkleRoot,
  getSettleCoreAssetSaleInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
} from '../src';
import {
  createCoreAsset,
  getSellerHistory,
  transferCoreAsset,
} from './_addSetup';
import {
  COMPUTE_UNITS,
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from './_setup';

test('it can add core assets to a gumball machine', async (t) => {
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

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    isDrawn: false,
    isClaimed: false,
    isSettled: false,
    mint: asset,
    seller: client.payer.address,
    buyer: undefined,
    tokenStandard: TokenStandard.Core,
    amount: 1,
  });

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it can add core asset to a gumball machine as allowlisted seller', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const { asset } = await createCoreAsset(client, otherSeller);

  await sendTransaction(client.svm, otherSeller, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      asset,
      args: {
        sellerProofPath: some(
          getMerkleProof([otherSeller.address], otherSeller.address)
        ),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    mint: asset,
    seller: otherSeller.address,
    tokenStandard: TokenStandard.Core,
    amount: 1,
  });
});

test('it cannot add core asset as non gumball authority when there is no seller allowlist set', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { asset } = await createCoreAsset(client, otherSeller);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddCoreAssetInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        asset,
        args: {
          sellerProofPath: some(
            getMerkleProof([otherSeller.address], otherSeller.address)
          ),
        },
      }),
    ]),
    { message: /InvalidProofPath/ }
  );
});

test('it cannot add core asset as non-allowlisted seller when there is a seller allowlist set', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([client.payer.address]),
    },
  });
  const { asset } = await createCoreAsset(client, otherSeller);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddCoreAssetInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        asset,
        args: {
          sellerProofPath: some(
            getMerkleProof([otherSeller.address], otherSeller.address)
          ),
        },
      }),
    ]),
    { message: /InvalidProofPath/ }
  );
});

test('it can append additional core assets to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2 },
  });
  const { asset: asset0 } = await createCoreAsset(client);
  const { asset: asset1 } = await createCoreAsset(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: asset0,
    }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: asset1,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 2);
  t.like(account.items[0], {
    index: 0,
    mint: asset0,
    tokenStandard: TokenStandard.Core,
  });
  t.like(account.items[1], {
    index: 1,
    mint: asset1,
    tokenStandard: TokenStandard.Core,
  });
});

test('it cannot add core assets that would make the gumball machine exceed the maximum capacity', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { asset: asset0 } = await createCoreAsset(client);
  const { asset: asset1 } = await createCoreAsset(client);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
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
    ]),
    { message: /IndexGreaterThanLength/ }
  );
});

test('it cannot add core assets once the gumball machine is fully loaded', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { asset: asset0 } = await createCoreAsset(client);
  const { asset: asset1 } = await createCoreAsset(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: asset0,
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getAddCoreAssetInstructionAsync({
        gumballMachine,
        seller: client.payer,
        asset: asset1,
      }),
    ]),
    { message: /IndexGreaterThanLength/ }
  );
});

test('it cannot add more core assets than allowed per seller', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2, itemsPerSeller: 1, sellersMerkleRoot },
  });
  const { asset: asset0 } = await createCoreAsset(client, otherSeller);
  const { asset: asset1 } = await createCoreAsset(client, otherSeller);

  const proof = some(
    getMerkleProof([otherSeller.address], otherSeller.address)
  );

  await sendTransaction(client.svm, otherSeller, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      asset: asset0,
      args: { sellerProofPath: proof },
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddCoreAssetInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        asset: asset1,
        args: { sellerProofPath: proof },
      }),
    ]),
    { message: /SellerTooManyItems/ }
  );
});

test('it can re-add core asset to a gumball machine as the authority', async (t) => {
  const client = await createClient();
  const { asset: asset0 } = await createCoreAsset(client);
  const { asset: asset1 } = await createCoreAsset(client);
  const assets = [asset0, asset1];

  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

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
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  let account = fetchGumballMachine(client.svm, gumballMachine);
  const drawnIndex = account.items.findIndex((i) => i.isDrawn);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: drawnIndex,
      payer: client.payer,
      gumballMachine,
      authority: client.payer.address,
      buyer: buyer.address,
      seller: client.payer.address,
      asset: assets[drawnIndex],
      creators: [client.payer.address],
    }),
  ]);

  // Transfer the core asset back to the seller (mpl-core TransferV1).
  await sendTransaction(client.svm, buyer, [
    transferCoreAsset(assets[drawnIndex], buyer, client.payer.address),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: assets[drawnIndex],
      args: { index: some(drawnIndex) },
    }),
  ]);

  account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 2);
  t.is(account.itemsRedeemed, 0n);
  t.is(account.itemsSettled, 0n);
  t.is(account.totalProceedsSettled, sol(0.5));
  t.like(account.items[0], {
    index: 0,
    mint: asset0,
    tokenStandard: TokenStandard.Core,
  });
  t.like(account.items[1], {
    index: 1,
    mint: asset1,
    tokenStandard: TokenStandard.Core,
  });

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, 2n);
});
