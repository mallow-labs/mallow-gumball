/* eslint-disable no-await-in-loop */
import { AssetV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  addAmounts,
  generateSigner,
  isEqualToAmount,
  sol,
  some,
  subtractAmounts,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  CandyMachine,
  draw,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  findSellerHistoryPda,
  safeFetchSellerHistory,
  settleCoreAssetSale,
  TokenStandard,
} from '../src';
import { create, createCoreAsset, createUmi } from './_setup';

test('it can settle a core asset sale', async (t) => {
  // Given a candy machine with some guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const candyMachineSigner = generateSigner(umi);
  const candyMachine = candyMachineSigner.publicKey;

  await create(umi, {
    candyMachine: candyMachineSigner,
    items: [
      {
        id: asset.publicKey,
        tokenStandard: TokenStandard.Core,
      },
    ],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(1) },
    },
  });

  // When we mint from the candy guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findCandyMachineAuthorityPda(umi, { candyMachine })[0]
  );

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        candyMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(buyerUmi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findCandyMachineAuthorityPda(umi, { candyMachine })[0]
  );

  t.true(
    isEqualToAmount(
      sellerPostBalance,
      addAmounts(sellerPreBalance, sol(1)),
      sol(0.01)
    )
  );

  t.true(
    isEqualToAmount(
      authorityPdaPostBalance,
      subtractAmounts(authorityPdaPreBalance, sol(1)),
      sol(0.01)
    )
  );

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
  });

  // Seller history should be closed
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, { candyMachine, seller: umi.identity.publicKey })
  );
  t.falsy(sellerHistoryAccount);

  // Buyer should be the owner
  const coreAsset = await fetchAssetV1(umi, asset.publicKey);
  t.like(coreAsset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: buyer.publicKey,
  });
});