import test from 'ava';
import {
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getCancelAddCoreAssetRequestInstructionAsync,
  getDeleteGumballMachineInstructionAsync,
  getRequestAddCoreAssetInstructionAsync,
} from '../src';
import {
  createCoreAsset,
  createUnwrappedGumballMachine,
  getAddItemRequest,
  getSellerHistory,
} from './_addSetup';
import {
  createClient,
  createGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

// NOTE: umi additionally asserts that the core asset's freeze/transfer delegates
// are removed after cancelling. There is no generated kit mpl-core account
// decoder in this workspace, so that plugin-state assertion is omitted; the
// request-closed and seller-history-closed behaviors (the cancel's core effect)
// are still verified.

test('it can cancel a request to add core asset to a gumball machine', async (t) => {
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

  const [sellerHistory] = await findSellerHistoryPda({
    gumballMachine,
    seller: seller.address,
  });
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });

  await sendTransaction(client.svm, seller, [
    await getCancelAddCoreAssetRequestInstructionAsync({
      seller,
      asset,
      sellerHistory,
      authorityPda,
    }),
  ]);

  t.is(await getAddItemRequest(client, asset), null);
  t.is(await getSellerHistory(client, gumballMachine, seller.address), null);
});

test('it can cancel a request to add core asset to a gumball machine after the gumball has closed', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createUnwrappedGumballMachine(client, {
    itemCapacity: 5,
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

  await sendTransaction(client.svm, client.payer, [
    await getDeleteGumballMachineInstructionAsync({
      gumballMachine,
      authority: client.payer,
      mintAuthority: client.payer,
    }),
  ]);

  const [sellerHistory] = await findSellerHistoryPda({
    gumballMachine,
    seller: seller.address,
  });
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });

  await sendTransaction(client.svm, seller, [
    await getCancelAddCoreAssetRequestInstructionAsync({
      seller,
      asset,
      sellerHistory,
      authorityPda,
    }),
  ]);

  t.is(await getAddItemRequest(client, asset), null);
  t.is(await getSellerHistory(client, gumballMachine, seller.address), null);
});
