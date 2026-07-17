import test from 'ava';
import {
  getAddCoreAssetInstructionAsync,
  getRequestAddCoreAssetInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
} from '../src';
import {
  createCoreAsset,
  getAddItemRequest,
  getSellerHistory,
} from './_addSetup';
import {
  createClient,
  createGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

test('it can create a request to add core asset to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { asset } = await createCoreAsset(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddCoreAssetInstructionAsync({
      gumballMachine,
      seller,
      asset,
    }),
  ]);

  const request = await getAddItemRequest(client, asset);
  t.like(request, {
    asset,
    seller: seller.address,
    gumballMachine,
    tokenStandard: TokenStandard.Core,
  });

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    seller.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it cannot request to add core asset as the gumball machine authority', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { asset } = await createCoreAsset(client);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getRequestAddCoreAssetInstructionAsync({
        gumballMachine,
        seller: client.payer,
        asset,
      }),
    ]),
    { message: /SellerCannotBeAuthority/ }
  );
});

test('it cannot request to add core asset when limit has been reached', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5, itemsPerSeller: 1 },
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { asset: asset0 } = await createCoreAsset(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddCoreAssetInstructionAsync({
      gumballMachine,
      seller,
      asset: asset0,
    }),
  ]);

  const { asset: asset1 } = await createCoreAsset(client, seller);
  await t.throwsAsync(
    sendTransaction(client.svm, seller, [
      await getRequestAddCoreAssetInstructionAsync({
        gumballMachine,
        seller,
        asset: asset1,
      }),
    ]),
    { message: /SellerTooManyItems/ }
  );
});

test('it cannot request to add core asset when sale has started', async (t) => {
  const client = await createClient();
  const { asset: initialAsset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: initialAsset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { asset } = await createCoreAsset(client, seller);

  await t.throwsAsync(
    sendTransaction(client.svm, seller, [
      await getRequestAddCoreAssetInstructionAsync({
        gumballMachine,
        seller,
        asset,
      }),
    ]),
    { message: /InvalidState/ }
  );
});
