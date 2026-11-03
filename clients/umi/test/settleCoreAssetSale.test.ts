/* eslint-disable no-await-in-loop */
import {
  AssetV1,
  burn,
  fetchAssetV1,
  fetchCollection,
  ruleSet,
} from '@metaplex-foundation/mpl-core';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  addAmounts,
  defaultPublicKey,
  generateSigner,
  isEqualToAmount,
  publicKey,
  PublicKey,
  Signer,
  sol,
  some,
  subtractAmounts,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  claimCoreAsset,
  draw,
  endSale,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  GumballMachine,
  safeFetchSellerHistory,
  settleCoreAssetSale,
  TokenStandard,
} from '../src';
import {
  create,
  createCoreAsset,
  createCoreCollection,
  createUmi,
} from './_setup';

test('it can settle a core asset sale', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
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
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
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
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
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

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        isSettled: true,
        mint: asset.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.Core,
        amount: 1,
      },
    ],
  });

  // Seller history should be closed
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine,
      seller: umi.identity.publicKey,
    })
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

test('it splits proceeds for a primary asset sale with multiple creators after claim', async (t) => {
  const umi = await createUmi();
  const secondCreator = generateSigner(umi).publicKey;

  // Given a gumball machine with some guards.
  const asset = await createCoreAsset(umi, {
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 1000,
        creators: [
          {
            address: umi.identity.publicKey,
            percentage: 50,
          },
          {
            address: secondCreator,
            percentage: 50,
          },
        ],
        ruleSet: ruleSet('None'),
      },
    ],
  });

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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
    settings: {
      curatorFeeBps: 0,
    },
  });

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      claimCoreAsset(buyerUmi, {
        gumballMachine,
        index: 0,
        payer,
        buyer: buyerUmi.identity.publicKey,
        asset: asset.publicKey,
        seller: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(buyerUmi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const secondCreatorPreBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
        creators: [umi.identity.publicKey, secondCreator],
      })
    )
    .sendAndConfirm(buyerUmi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const secondCreatorPostBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  t.true(
    isEqualToAmount(
      sellerPostBalance,
      addAmounts(sellerPreBalance, sol(0.5)),
      sol(0.01)
    )
  );

  t.true(
    isEqualToAmount(
      secondCreatorPostBalance,
      addAmounts(secondCreatorPreBalance, sol(0.5)),
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
});

test('it splits proceeds for a primary asset sale with multiple creators before claim', async (t) => {
  const umi = await createUmi();
  const secondCreator = generateSigner(umi).publicKey;

  // Given a gumball machine with some guards.
  const asset = await createCoreAsset(umi, {
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 1000,
        creators: [
          {
            address: umi.identity.publicKey,
            percentage: 50,
          },
          {
            address: secondCreator,
            percentage: 50,
          },
        ],
        ruleSet: ruleSet('None'),
      },
    ],
  });

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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
    settings: {
      curatorFeeBps: 0,
    },
  });

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const secondCreatorPreBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
        creators: [umi.identity.publicKey, secondCreator],
      })
    )
    .sendAndConfirm(buyerUmi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const secondCreatorPostBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  t.true(
    isEqualToAmount(
      sellerPostBalance,
      addAmounts(sellerPreBalance, sol(0.5)),
      sol(0.01)
    )
  );

  t.true(
    isEqualToAmount(
      secondCreatorPostBalance,
      addAmounts(secondCreatorPreBalance, sol(0.5)),
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
});

test('it splits proceeds for a secondary asset sale with multiple creators after claim', async (t) => {
  const umi = await createUmi();
  const creatorUmi = await createUmi();
  const secondCreator = generateSigner(umi).publicKey;

  const asset = await createCoreAsset(creatorUmi, {
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 1000,
        creators: [
          {
            address: creatorUmi.identity.publicKey,
            percentage: 50,
          },
          {
            address: secondCreator,
            percentage: 50,
          },
        ],
        ruleSet: ruleSet('None'),
      },
    ],
    owner: umi.identity.publicKey,
  });

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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
    settings: {
      curatorFeeBps: 0,
    },
  });

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      claimCoreAsset(buyerUmi, {
        gumballMachine,
        index: 0,
        payer,
        buyer: buyerUmi.identity.publicKey,
        asset: asset.publicKey,
        seller: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(buyerUmi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const firstCreatorPreBalance = await umi.rpc.getBalance(
    creatorUmi.identity.publicKey
  );
  const secondCreatorPreBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  const sellerHistoryAccount = findSellerHistoryPda(umi, {
    gumballMachine,
    seller: umi.identity.publicKey,
  })[0];

  const sellerHistoryAccountRent =
    await umi.rpc.getBalance(sellerHistoryAccount);

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
        creators: [creatorUmi.identity.publicKey, secondCreator],
      })
    )
    .sendAndConfirm(buyerUmi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const firstCreatorPostBalance = await umi.rpc.getBalance(
    creatorUmi.identity.publicKey
  );
  const secondCreatorPostBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  t.true(
    isEqualToAmount(
      sellerPostBalance,
      addAmounts(
        addAmounts(sellerPreBalance, sol(0.9)),
        sellerHistoryAccountRent
      )
    )
  );

  t.true(
    isEqualToAmount(
      firstCreatorPostBalance,
      addAmounts(firstCreatorPreBalance, sol(0.05))
    )
  );

  t.true(
    isEqualToAmount(
      secondCreatorPostBalance,
      addAmounts(secondCreatorPreBalance, sol(0.05))
    )
  );

  t.true(
    isEqualToAmount(
      authorityPdaPostBalance,
      subtractAmounts(authorityPdaPreBalance, sol(1)),
      sol(0.01)
    )
  );
});

test('it splits proceeds for a secondary asset sale with multiple creators before claim', async (t) => {
  const umi = await createUmi();
  const creatorUmi = await createUmi();
  const secondCreator = generateSigner(umi).publicKey;

  const asset = await createCoreAsset(creatorUmi, {
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 1000,
        creators: [
          {
            address: creatorUmi.identity.publicKey,
            percentage: 50,
          },
          {
            address: secondCreator,
            percentage: 50,
          },
        ],
        ruleSet: ruleSet('None'),
      },
    ],
    owner: umi.identity.publicKey,
  });

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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
    settings: {
      curatorFeeBps: 0,
    },
  });

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const firstCreatorPreBalance = await umi.rpc.getBalance(
    creatorUmi.identity.publicKey
  );
  const secondCreatorPreBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  const sellerHistoryAccount = findSellerHistoryPda(umi, {
    gumballMachine,
    seller: umi.identity.publicKey,
  })[0];

  const sellerHistoryAccountRent =
    await umi.rpc.getBalance(sellerHistoryAccount);

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
        creators: [creatorUmi.identity.publicKey, secondCreator],
      })
    )
    .sendAndConfirm(buyerUmi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const firstCreatorPostBalance = await umi.rpc.getBalance(
    creatorUmi.identity.publicKey
  );
  const secondCreatorPostBalance = await umi.rpc.getBalance(secondCreator);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  t.true(
    isEqualToAmount(
      sellerPostBalance,
      addAmounts(
        addAmounts(sellerPreBalance, sol(0.9)),
        sellerHistoryAccountRent
      ),
      sol(0.1)
    )
  );

  t.true(
    isEqualToAmount(
      firstCreatorPostBalance,
      addAmounts(firstCreatorPreBalance, sol(0.05))
    )
  );

  t.true(
    isEqualToAmount(
      secondCreatorPostBalance,
      addAmounts(secondCreatorPreBalance, sol(0.05))
    )
  );

  t.true(
    isEqualToAmount(
      authorityPdaPostBalance,
      subtractAmounts(authorityPdaPreBalance, sol(1)),
      sol(0.01)
    )
  );
});

test('it can settle a core asset that was not sold', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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

  await endSale(umi, { gumballMachine }).sendAndConfirm(umi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: defaultPublicKey(),
        asset: asset.publicKey,
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(umi);

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  t.true(isEqualToAmount(sellerPostBalance, sellerPreBalance, sol(0.01)));
  t.true(isEqualToAmount(authorityPdaPostBalance, authorityPdaPreBalance));

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{
    itemsRedeemed: 0n,
    itemsSettled: 1n,
  });

  // Seller history should be closed
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine,
      seller: umi.identity.publicKey,
    })
  );
  t.falsy(sellerHistoryAccount);

  // Buyer should be the owner
  const coreAsset = await fetchAssetV1(umi, asset.publicKey);
  t.like(coreAsset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: umi.identity.publicKey,
  });
});

test('it can settle a core asset that was not sold with proceeds from another sale', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const assets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: assets[0].publicKey,
        tokenStandard: TokenStandard.Core,
      },
      {
        id: assets[1].publicKey,
        tokenStandard: TokenStandard.Core,
      },
    ],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(1) },
    },
  });

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  await endSale(umi, { gumballMachine }).sendAndConfirm(umi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  let gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  const unsoldItem = gumballMachineAccount.items.find((i) => i.buyer == null)!;

  // Then settle the sale for the unbought nft
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(umi, {
        index: unsoldItem.index,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: publicKey(unsoldItem.seller),
        buyer: defaultPublicKey(),
        asset: publicKey(unsoldItem.mint),
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(umi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  t.true(
    isEqualToAmount(
      sellerPostBalance,
      addAmounts(sellerPreBalance, sol(0.5)),
      sol(0.01)
    )
  );

  t.true(
    isEqualToAmount(
      authorityPdaPostBalance,
      subtractAmounts(authorityPdaPreBalance, sol(0.5)),
      sol(0.01)
    )
  );

  // And the gumball machine was updated.
  gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
    itemsLoaded: 2,
  });

  // Seller history should not be closed
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine,
      seller: umi.identity.publicKey,
    })
  );
  t.truthy(sellerHistoryAccount);

  // Seller should be the owner
  // Then nft is unfrozen and revoked
  const coreAsset = await fetchAssetV1(umi, publicKey(unsoldItem.mint));
  t.like(coreAsset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: umi.identity.publicKey,
  });
});

test('it cannot settle a core asset to the wrong buyer', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then settle the sale for the unbought nft
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: umi.identity.publicKey,
        asset: asset.publicKey,
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /InvalidBuyer/ });
});

test('it cannot settle a core asset sale twice', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const assets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: assets[0].publicKey,
        tokenStandard: TokenStandard.Core,
      },
      {
        id: assets[1].publicKey,
        tokenStandard: TokenStandard.Core,
      },
    ],
    startSale: true,
    guards: {
      solPayment: { lamports: sol(1) },
    },
  });

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: assets[0].publicKey,
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(buyerUmi);

  // Then settle the sale again
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: assets[0].publicKey,
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(buyerUmi);

  await t.throwsAsync(promise, { message: /ItemAlreadySettled/ });
});

test('it can settle a core asset sale where buyer is the seller', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  await umi.rpc.airdrop(umi.identity.publicKey, sol(10));
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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

  // When we mint from the gumball guard.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  const sellerPreBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPreBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(umi);

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
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

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
  });

  // Seller history should be closed
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine,
      seller: umi.identity.publicKey,
    })
  );
  t.falsy(sellerHistoryAccount);

  // Seller should be the owner
  // Then nft is unfrozen and revoked
  const coreAsset = await fetchAssetV1(umi, asset.publicKey);
  t.like(coreAsset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: umi.identity.publicKey,
  });
});

test('it can settle a core asset sale for claimed core asset', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
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
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  await claimCoreAsset(buyerUmi, {
    gumballMachine,
    index: 0,
    asset: asset.publicKey,
    seller: umi.identity.publicKey,
  }).sendAndConfirm(buyerUmi);

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyer.publicKey,
        asset: asset.publicKey,
        creators: [umi.identity.publicKey],
      })
    )
    .sendAndConfirm(umi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  const sellerPostBalance = await umi.rpc.getBalance(umi.identity.publicKey);
  const authorityPdaPostBalance = await umi.rpc.getBalance(
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
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

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        isSettled: true,
        mint: asset.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.Core,
        amount: 1,
      },
    ],
  });

  // Seller history should be closed
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine,
      seller: umi.identity.publicKey,
    })
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

test('it can settle a core asset sale after asset has been claimed and burnt', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;

  await create(umi, {
    gumballMachine: gumballMachineSigner,
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

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
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
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
  );

  const assetAccount = await fetchAssetV1(buyerUmi, asset.publicKey);
  // Then claim and burn the asset
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      claimCoreAsset(buyerUmi, {
        gumballMachine,
        asset: asset.publicKey,
        seller: umi.identity.publicKey,
        index: 0,
      })
    )
    .add(
      burn(buyerUmi, {
        asset: assetAccount,
      })
    )
    .sendAndConfirm(buyerUmi);

  // Then settle the sale
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(buyerUmi, {
        index: 0,
        gumballMachine,
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
    findGumballMachineAuthorityPda(umi, { gumballMachine: gumballMachine })[0]
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

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        isSettled: true,
        mint: asset.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.Core,
        amount: 1,
      },
    ],
  });

  // Seller history should be closed
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine,
      seller: umi.identity.publicKey,
    })
  );
  t.falsy(sellerHistoryAccount);
});

/** Sell `asset` for 1 SOL with no curator fee; claim it first unless told not to. */
const sellCoreAsset = async (
  umi: Umi,
  asset: PublicKey,
  collection?: PublicKey,
  claim = true
) => {
  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;
  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [{ id: asset, tokenStandard: TokenStandard.Core, collection }],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(1) },
    },
    settings: { curatorFeeBps: 0 },
  });

  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: { solPayment: some(true) },
      })
    )
    .sendAndConfirm(umi);

  if (claim) {
    await claimCoreAsset(buyerUmi, {
      gumballMachine,
      index: 0,
      asset,
      seller: umi.identity.publicKey,
      collection,
    }).sendAndConfirm(buyerUmi);
  }

  return { gumballMachine, buyer: buyer.publicKey };
};

/** A collection whose royalties all go to `creator`. */
const createRoyaltyCollection = async (
  authorityUmi: Umi,
  creator: PublicKey,
  basisPoints: number
): Promise<Signer> =>
  createCoreCollection(authorityUmi, {
    plugins: [
      {
        type: 'Royalties',
        basisPoints,
        creators: [{ address: creator, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
    ],
  });

const settle = (
  settlerUmi: Umi,
  sale: { gumballMachine: PublicKey; buyer: PublicKey },
  seller: PublicKey,
  asset: PublicKey,
  collection: PublicKey | undefined,
  creators: PublicKey[]
) =>
  transactionBuilder()
    .add(setComputeUnitLimit(settlerUmi, { units: 600_000 }))
    .add(
      settleCoreAssetSale(settlerUmi, {
        index: 0,
        gumballMachine: sale.gumballMachine,
        authority: seller,
        seller,
        buyer: sale.buyer,
        asset,
        collection,
        creators,
      })
    )
    .sendAndConfirm(settlerUmi);

test('a third party cannot take a claimed sale with a collection the asset is not in', async (t) => {
  // Given a claimed asset with an address update authority and no royalties of
  // its own, on a secondary sale and on a primary sale.
  const umi = await createUmi();
  const creatorUmi = await createUmi();
  const seller = umi.identity.publicKey;
  const secondary = await createCoreAsset(creatorUmi, {
    plugins: [],
    owner: seller,
  });
  const primary = await createCoreAsset(umi, { plugins: [] });

  for (const [asset, basisPoints] of [
    [secondary, 10000],
    [primary, 100],
  ] as const) {
    const sale = await sellCoreAsset(umi, asset.publicKey);

    // When an unrelated settler passes its own collection and names itself.
    const attackerUmi = await createUmi();
    const attacker = attackerUmi.identity.publicKey;
    const attackerCollection = await createRoyaltyCollection(
      attackerUmi,
      attacker,
      basisPoints
    );
    const attackerPreBalance = await umi.rpc.getBalance(attacker);
    const sellerPreBalance = await umi.rpc.getBalance(seller);
    await settle(
      attackerUmi,
      sale,
      seller,
      asset.publicKey,
      attackerCollection.publicKey,
      [attacker]
    );

    // Then the seller gets the sale, and the settler only pays its fee.
    t.true(
      isEqualToAmount(
        await umi.rpc.getBalance(seller),
        addAmounts(sellerPreBalance, sol(1)),
        sol(0.01)
      )
    );
    t.true(
      (await umi.rpc.getBalance(attacker)).basisPoints <=
        attackerPreBalance.basisPoints
    );
  }
});

test('a supplied collection does not displace the royalties of an asset outside it', async (t) => {
  // Given a claimed asset with its own royalties and an address update authority.
  const umi = await createUmi();
  const creatorUmi = await createUmi();
  const seller = umi.identity.publicKey;
  const creator = creatorUmi.identity.publicKey;
  const asset = await createCoreAsset(creatorUmi, { owner: seller });
  const sale = await sellCoreAsset(umi, asset.publicKey);
  const otherCollection = await createRoyaltyCollection(umi, seller, 10000);

  // When it is settled with a stale collection.
  const sellerPreBalance = await umi.rpc.getBalance(seller);
  const creatorPreBalance = await umi.rpc.getBalance(creator);
  const settlerUmi = await createUmi();
  await settle(
    settlerUmi,
    sale,
    seller,
    asset.publicKey,
    otherCollection.publicKey,
    [creator]
  );

  // Then the asset's own 10% is what gets paid.
  t.true(
    isEqualToAmount(
      await umi.rpc.getBalance(creator),
      addAmounts(creatorPreBalance, sol(0.1))
    )
  );
  t.true(
    isEqualToAmount(
      await umi.rpc.getBalance(seller),
      addAmounts(sellerPreBalance, sol(0.9)),
      sol(0.01)
    )
  );
});

test('a claimed asset in a collection cannot skip its royalties', async (t) => {
  // Given a claimed asset that takes its royalties from its collection.
  const umi = await createUmi();
  const creatorUmi = await createUmi();
  const seller = umi.identity.publicKey;
  const creator = creatorUmi.identity.publicKey;
  const collection = await createRoyaltyCollection(creatorUmi, creator, 1000);
  const asset = await createCoreAsset(creatorUmi, {
    plugins: [],
    owner: seller,
    collection: await fetchCollection(creatorUmi, collection.publicKey),
  });
  const sale = await sellCoreAsset(umi, asset.publicKey, collection.publicKey);

  // When it is settled without the collection, or with another one.
  const sellerPreBalance = await umi.rpc.getBalance(seller);
  const creatorPreBalance = await umi.rpc.getBalance(creator);
  const otherCollection = await createRoyaltyCollection(umi, seller, 1);
  await t.throwsAsync(
    settle(umi, sale, seller, asset.publicKey, undefined, []),
    { message: /CollectionNotSet/ }
  );
  await t.throwsAsync(
    settle(umi, sale, seller, asset.publicKey, otherCollection.publicKey, [
      seller,
    ]),
    { message: /PublicKeyMismatch/ }
  );

  // Then only its own collection settles it, and the creator is paid.
  const settlerUmi = await createUmi();
  await settle(
    settlerUmi,
    sale,
    seller,
    asset.publicKey,
    collection.publicKey,
    [creator]
  );
  t.true(
    isEqualToAmount(
      await umi.rpc.getBalance(creator),
      addAmounts(creatorPreBalance, sol(0.1))
    )
  );
  t.true(
    isEqualToAmount(
      await umi.rpc.getBalance(seller),
      addAmounts(sellerPreBalance, sol(0.9)),
      sol(0.02)
    )
  );
});

test('an unclaimed asset in a collection settles with that collection', async (t) => {
  // Given a sold asset in a collection that has not been claimed.
  const umi = await createUmi();
  const creatorUmi = await createUmi();
  const seller = umi.identity.publicKey;
  const creator = creatorUmi.identity.publicKey;
  const collection = await createRoyaltyCollection(creatorUmi, creator, 1000);
  const asset = await createCoreAsset(creatorUmi, {
    plugins: [],
    owner: seller,
    collection: await fetchCollection(creatorUmi, collection.publicKey),
  });
  const sale = await sellCoreAsset(
    umi,
    asset.publicKey,
    collection.publicKey,
    false
  );

  // When it is settled.
  const creatorPreBalance = await umi.rpc.getBalance(creator);
  const settlerUmi = await createUmi();
  await settle(
    settlerUmi,
    sale,
    seller,
    asset.publicKey,
    collection.publicKey,
    [creator]
  );

  // Then the creator is paid and the buyer holds the asset.
  t.true(
    isEqualToAmount(
      await umi.rpc.getBalance(creator),
      addAmounts(creatorPreBalance, sol(0.1))
    )
  );
  const coreAsset = await fetchAssetV1(umi, asset.publicKey);
  t.is(coreAsset.owner, sale.buyer);
});

test("a primary sale of an asset in a collection pays that collection's creators", async (t) => {
  // Given a claimed asset whose seller is its collection's update authority.
  const umi = await createUmi();
  const creatorUmi = await createUmi();
  const seller = umi.identity.publicKey;
  const creator = creatorUmi.identity.publicKey;
  const collection = await createRoyaltyCollection(umi, creator, 500);
  const asset = await createCoreAsset(umi, {
    plugins: [],
    collection: await fetchCollection(umi, collection.publicKey),
  });
  const sale = await sellCoreAsset(umi, asset.publicKey, collection.publicKey);

  // When it is settled with its collection.
  const creatorPreBalance = await umi.rpc.getBalance(creator);
  const settlerUmi = await createUmi();
  await settle(
    settlerUmi,
    sale,
    seller,
    asset.publicKey,
    collection.publicKey,
    [creator]
  );

  // Then the creators receive the whole sale.
  t.true(
    isEqualToAmount(
      await umi.rpc.getBalance(creator),
      addAmounts(creatorPreBalance, sol(1))
    )
  );
});
