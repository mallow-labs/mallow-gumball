import { getAddressDecoder } from '@solana/kit';
import test from 'ava';
import {
  draw,
  getAddCoreAssetInstructionAsync,
  getClaimCoreAssetInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
} from '../src';
import { createCoreAsset } from './_removeClaimSetup';
import {
  COMPUTE_UNITS,
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

test('it can claim a core asset item', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const { asset } = await createCoreAsset(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimCoreAssetInstructionAsync({
      payer: buyer,
      gumballMachine,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      index: 0,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 0n);
  t.like(account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint: asset,
    seller: client.payer.address,
    buyer: buyer.address,
    tokenStandard: TokenStandard.Core,
    amount: 1,
  });

  // Buyer should now own the asset.
  t.is(coreAssetOwner(client, asset), buyer.address);
});

test('it cannot claim a core asset item as another buyer', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const { asset } = await createCoreAsset(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await getClaimCoreAssetInstructionAsync({
        payer: client.payer,
        gumballMachine,
        seller: client.payer.address,
        buyer: client.payer.address,
        asset,
        index: 0,
      }),
    ]),
    { message: /InvalidBuyer/ }
  );
});
