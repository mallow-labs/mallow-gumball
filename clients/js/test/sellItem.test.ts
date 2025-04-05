/* eslint-disable no-await-in-loop */
import { AssetV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import {
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  getDefaultBuyBackConfig,
  GumballMachine,
  manageBuyBackFunds,
  sellItem,
  TokenStandard,
} from '../src';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createNft,
  createProgrammableNft,
  createUmi,
} from './_setup';

test('it can sell an nft item', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const nft = await createNft(umi);
  // Oracle signer (authorized to sell on behalf of sellers)
  const oracleSigner = generateSigner(umi);

  // Create gumball machine with buyback enabled
  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
    buyBackConfig: {
      ...getDefaultBuyBackConfig(),
      oracleSigner: oracleSigner.publicKey,
      enabled: true,
    },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // Deposit buy back funds
  const depositAmount = 500;
  await transactionBuilder()
    .add(
      manageBuyBackFunds(umi, {
        gumballMachine,
        amount: depositAmount,
        isWithdraw: false,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  const preBuyerTokenAccount = await umi.rpc.getBalance(
    buyerUmi.identity.publicKey
  );

  // Buyer can sell back to the seller
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      sellItem(buyerUmi, {
        gumballMachine,
        index: 0,
        amount: 1,
        buyPrice: 100,
        oracleSigner,
        payer: buyerUmi.identity,
        seller: buyerUmi.identity.publicKey,
        buyer: umi.identity.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(buyerUmi);

  const postBuyerTokenAccount = await umi.rpc.getBalance(
    buyerUmi.identity.publicKey
  );

  t.is(postBuyerTokenAccount, preBuyerTokenAccount + 100);

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        isSettled: false,
        mint: nft.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.NonFungible,
        amount: 1,
      },
    ],
  });

  // Check that the NFT is now owned by the authority
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nft.publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );

  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: umi.identity.publicKey,
    delegate: none(),
    amount: 1n,
  });

  // Check that the drawer got tokens from the buy back fund
  const buyerTokenAccount = await umi.rpc.getBalance(
    buyerUmi.identity.publicKey
  );
});

test('it can sell a pnft item', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const nft = await createProgrammableNft(umi);

  // Create gumball machine with buyback enabled
  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.ProgrammableNonFungible,
      },
    ],
    startSale: true,
    guards: {},
    buyBackConfig: {
      ...getDefaultBuyBackConfig(),
      enabled: true,
    },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // Deposit buy back funds
  const depositAmount = 500;
  await transactionBuilder()
    .add(
      manageBuyBackFunds(umi, {
        gumballMachine,
        amount: depositAmount,
        isWithdraw: false,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  // Seller (original seller, in this case the creator)
  const sellerUmi = umi;
  // Oracle signer (authorized to sell on behalf of sellers)
  const oracleSigner = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      sellItem(sellerUmi, {
        gumballMachine,
        index: 0,
        amount: 1,
        buyPrice: 100,
        oracleSigner,
        seller: sellerUmi.identity.publicKey,
        buyer: sellerUmi.identity.publicKey, // The authority is buying back
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(sellerUmi);

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        isSettled: false,
        mint: nft.publicKey,
        seller: sellerUmi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.ProgrammableNonFungible,
        amount: 1,
      },
    ],
  });
});

test('it can sell a tokens item', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const gumballMachineSigner = generateSigner(umi);

  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [
      { owner: umi.identity, amount: 100 },
      {
        owner: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachineSigner.publicKey,
        }),
        amount: 0,
      },
    ],
  });

  // Create gumball machine with buyback enabled
  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: tokenMint.publicKey,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
    ],
    startSale: true,
    guards: {},
    buyBackConfig: {
      ...getDefaultBuyBackConfig(),
      enabled: true,
    },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // Deposit buy back funds
  const depositAmount = 500;
  await transactionBuilder()
    .add(
      manageBuyBackFunds(umi, {
        gumballMachine,
        amount: depositAmount,
        isWithdraw: false,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  // Seller (original seller, in this case the creator)
  const sellerUmi = umi;
  // Oracle signer (authorized to sell on behalf of sellers)
  const oracleSigner = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      sellItem(sellerUmi, {
        gumballMachine,
        index: 0,
        amount: 100,
        buyPrice: 100,
        oracleSigner,
        seller: sellerUmi.identity.publicKey,
        buyer: sellerUmi.identity.publicKey, // The authority is buying back
        mint: tokenMint.publicKey,
      })
    )
    .sendAndConfirm(sellerUmi);

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        isSettled: false,
        mint: tokenMint.publicKey,
        seller: sellerUmi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.Fungible,
        amount: 100,
      },
    ],
  });
});

test('it can sell a core asset item', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  // Create gumball machine with buyback enabled
  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: asset.publicKey,
        tokenStandard: TokenStandard.Core,
      },
    ],
    startSale: true,
    guards: {},
    buyBackConfig: {
      ...getDefaultBuyBackConfig(),
      enabled: true,
    },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // Deposit buy back funds
  const depositAmount = 500;
  await transactionBuilder()
    .add(
      manageBuyBackFunds(umi, {
        gumballMachine,
        amount: depositAmount,
        isWithdraw: false,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  // Seller (original seller, in this case the creator)
  const sellerUmi = umi;
  // Oracle signer (authorized to sell on behalf of sellers)
  const oracleSigner = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      sellItem(sellerUmi, {
        gumballMachine,
        index: 0,
        amount: 1,
        buyPrice: 100,
        oracleSigner,
        seller: sellerUmi.identity.publicKey,
        buyer: sellerUmi.identity.publicKey, // The authority is buying back
        mint: asset.publicKey,
      })
    )
    .sendAndConfirm(sellerUmi);

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        isSettled: false,
        mint: asset.publicKey,
        seller: sellerUmi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.Core,
        amount: 1,
      },
    ],
  });

  // Check that the core asset is now owned by the authority
  const coreAsset = await fetchAssetV1(umi, asset.publicKey);
  t.like(coreAsset, <AssetV1>{
    owner: sellerUmi.identity.publicKey,
  });
});

test('it cannot sell an item with invalid oracle signer', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const nft = await createNft(umi);

  // Create gumball machine with buyback enabled and a specific oracle signer
  const oracleSigner = umi.identity.publicKey;
  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
    buyBackConfig: {
      ...getDefaultBuyBackConfig(),
      enabled: true,
      oracleSigner,
    },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // Deposit buy back funds
  const depositAmount = 500;
  await transactionBuilder()
    .add(
      manageBuyBackFunds(umi, {
        gumballMachine,
        amount: depositAmount,
        isWithdraw: false,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  // Try to sell with a different oracle signer
  const invalidOracleSigner = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      sellItem(umi, {
        gumballMachine,
        index: 0,
        amount: 1,
        buyPrice: 100,
        oracleSigner: invalidOracleSigner,
        seller: umi.identity.publicKey,
        buyer: umi.identity.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /InvalidOracleSigner/ });
});

test('it cannot sell an item with insufficient buy back funds', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const nft = await createNft(umi);

  // Create gumball machine with buyback enabled but limited funds
  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
    buyBackConfig: {
      ...getDefaultBuyBackConfig(),
      enabled: true,
    },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // Deposit limited buy back funds
  const depositAmount = 50;
  await transactionBuilder()
    .add(
      manageBuyBackFunds(umi, {
        gumballMachine,
        amount: depositAmount,
        isWithdraw: false,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  // Try to sell with a price higher than available funds
  const oracleSigner = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      sellItem(umi, {
        gumballMachine,
        index: 0,
        amount: 1,
        buyPrice: 100, // Trying to sell for 100 when only 50 is available
        oracleSigner,
        seller: umi.identity.publicKey,
        buyer: umi.identity.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /InsufficientFunds/ });
});
