import { AssetV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  AddItemRequest,
  cancelAddCoreAssetRequest,
  fetchAddItemRequestFromSeeds,
  fetchSellerHistoryFromSeeds,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  requestAddCoreAsset,
  SellerHistory,
  TokenStandard,
} from '../src';
import { create, createCoreAsset, createUmi } from './_setup';

test('it can cancel a request to add core asset to a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 core assets.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });

  const sellerUmi = await createUmi();
  const coreAsset = await createCoreAsset(sellerUmi);

  // When we create a request to add an coreAsset to the Gumball Machine.
  await transactionBuilder()
    .add(
      requestAddCoreAsset(sellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(sellerUmi);

  // Then cancel the request to add an coreAsset to the Gumball Machine.
  await transactionBuilder()
    .add(
      cancelAddCoreAssetRequest(sellerUmi, {
        asset: coreAsset.publicKey,
        sellerHistory: findSellerHistoryPda(umi, {
          gumballMachine: gumballMachine.publicKey,
          seller: sellerUmi.identity.publicKey,
        }),
        authorityPda: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachine.publicKey,
        }),
      })
    )
    .sendAndConfirm(sellerUmi);

  // Then the request is created properly.
  const addItemRequestAccount = await fetchAddItemRequestFromSeeds(umi, {
    asset: coreAsset.publicKey,
  });

  t.like(addItemRequestAccount, <AddItemRequest>{
    asset: coreAsset.publicKey,
    seller: sellerUmi.identity.publicKey,
    gumballMachine: gumballMachine.publicKey,
    tokenStandard: TokenStandard.Core,
  });

  const asset = await fetchAssetV1(umi, coreAsset.publicKey);
  t.like(asset, <AssetV1>{
    owner: sellerUmi.identity.publicKey,
    transferDelegate: {
      authority: {
        type: 'Address',
        address: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachine.publicKey,
        })[0],
      },
    },
    freezeDelegate: {
      authority: {
        type: 'Address',
        address: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachine.publicKey,
        })[0],
      },
      frozen: true,
    },
  });

  // Seller history state is correct
  const sellerHistoryAccount = await fetchSellerHistoryFromSeeds(umi, {
    gumballMachine: gumballMachine.publicKey,
    seller: sellerUmi.identity.publicKey,
  });

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: sellerUmi.identity.publicKey,
    itemCount: 1n,
  });
});
