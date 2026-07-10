/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  addAmounts,
  generateSigner,
  isEqualToAmount,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  addCnft,
  approveAddItem,
  cancelAddCnftRequest,
  claimCnft,
  draw,
  fetchAddItemRequestFromSeeds,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  GumballMachine,
  removeCnft,
  requestAddCnft,
  safeFetchAddItemRequestFromSeeds,
  settleCnftSale,
  startSale,
  TokenStandard,
} from '../src';
import {
  cnftArgs,
  createBubblegumTree,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
  settleRemainingAccounts,
} from './_cnftSetup';
import { assertItemBought as assertItemDrawn, create, createUmi } from './_setup';

// Both fields default to `none` via the generated struct defaults.
const addItemArgs = {};

// Add a freshly-minted cNFT (owned by umi.identity, the authority) to a machine.
// Escrows the leaf to the authority PDA and flips `item.owner` to the PDA.
const addCnftItem = async (umi: any, gumballMachine: any, item: any) => {
  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      addCnft(umi, {
        gumballMachine,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        addItemArgs,
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(umi);

  // Leaf now lives in escrow.
  item.owner = findGumballMachineAuthorityPda(umi, { gumballMachine })[0];
};

test('it escrows a compressed nft when added to a gumball machine', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  await addCnftItem(umi, gumballMachine, item);

  // The config line records the asset id (in the mint field) as Compressed.
  const account = await fetchGumballMachine(umi, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    mint: item.assetId,
    seller: umi.identity.publicKey,
    tokenStandard: TokenStandard.Compressed,
  });
});

test('it can remove a compressed nft, returning the leaf to the seller', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  await addCnftItem(umi, gumballMachine, item);

  // Escrow-out PDA -> seller. Only succeeds if the PDA actually holds the leaf.
  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      removeCnft(umi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(umi);
  item.owner = umi.identity.publicKey;

  const account = await fetchGumballMachine(umi, gumballMachine);
  t.is(account.itemsLoaded, 0);

  // Proof of return: the seller owns the leaf again, so it can be re-added.
  await addCnftItem(umi, gumballMachine, item);
  const reAdded = await fetchGumballMachine(umi, gumballMachine);
  t.is(reAdded.itemsLoaded, 1);
});

test('it can claim a compressed nft for the buyer after a draw', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  await addCnftItem(umi, gumballMachine, item);
  await transactionBuilder()
    .add(startSale(umi, { gumballMachine }))
    .sendAndConfirm(umi);

  // Buyer draws the item (draw does not move the leaf).
  const buyerUmi = await createCnftUmi(createUmi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(draw(buyerUmi, { gumballMachine }))
    .sendAndConfirm(buyerUmi);
  await assertItemDrawn(t, umi, {
    gumballMachine,
    buyer: buyerUmi.identity.publicKey,
  });

  // Claim escrow-out PDA -> buyer.
  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      claimCnft(buyerUmi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(buyerUmi);
  item.owner = buyerUmi.identity.publicKey;

  const account = await fetchGumballMachine(umi, gumballMachine);
  t.like(account, <Partial<GumballMachine>>{
    itemsRedeemed: 1n,
    items: [{ index: 0, isDrawn: true, isClaimed: true, isSettled: false }],
  });

  // Settling a claimed item just distributes proceeds (no second transfer).
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSale(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(umi);

  const settled = await fetchGumballMachine(umi, gumballMachine);
  t.like(settled, <Partial<GumballMachine>>{
    itemsSettled: 1n,
    items: [{ index: 0, isClaimed: true, isSettled: true }],
  });
});

test('it settles an unclaimed compressed nft sale, transferring the leaf and paying royalties', async (t) => {
  const umi = await createCnftUmi(createUmi);

  // Distinct creator wallet so royalties are observable in isolation.
  const creator = generateSigner(umi);
  const item = await mintCnft(umi, {
    sellerFeeBasisPoints: 500,
    creators: [{ address: creator.publicKey, verified: false, share: 100 }],
  });

  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(1) },
    },
    disablePrimarySplit: true,
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  await addCnftItem(umi, gumballMachine, item);
  await transactionBuilder()
    .add(startSale(umi, { gumballMachine }))
    .sendAndConfirm(umi);

  const buyerUmi = await createCnftUmi(createUmi);
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer: buyerUmi.identity,
        mintArgs: { solPayment: some(true) },
      })
    )
    .sendAndConfirm(umi);

  const creatorPre = await umi.rpc.getBalance(creator.publicKey);

  // Settle without a prior claim: transfers the leaf PDA -> buyer AND pays out.
  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSale(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(umi);
  item.owner = buyerUmi.identity.publicKey;

  // Royalty (5% of 1 SOL) landed with the creator — trustless, since a lie about
  // sfbp/creators would have failed the Bubblegum proof on the leaf transfer.
  const creatorPost = await umi.rpc.getBalance(creator.publicKey);
  t.true(
    isEqualToAmount(
      creatorPost,
      addAmounts(creatorPre, sol(0.05)),
      sol(0.005)
    ),
    `creator royalty: ${creatorPost.basisPoints} vs pre ${creatorPre.basisPoints}`
  );

  const settled = await fetchGumballMachine(umi, gumballMachine);
  t.like(settled, <Partial<GumballMachine>>{
    itemsSettled: 1n,
    items: [{ index: 0, isSettled: true }],
  });
});

test('it cannot claim using the proof and args of a different leaf', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  // A different leaf on a different tree the attacker controls.
  const decoy = await mintCnft(umi);

  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  await addCnftItem(umi, gumballMachine, item);
  await transactionBuilder()
    .add(startSale(umi, { gumballMachine }))
    .sendAndConfirm(umi);

  const buyerUmi = await createCnftUmi(createUmi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(draw(buyerUmi, { gumballMachine }))
    .sendAndConfirm(buyerUmi);

  // Substitute the decoy's tree/nonce/proof. The derived asset id no longer
  // matches the stored config line -> rejected before any transfer.
  const { proof: decoyProof } = getCnftProof(umi, decoy);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      claimCnft(buyerUmi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: decoy.treeConfig,
        merkleTree: decoy.merkleTree,
        args: cnftArgs(umi, decoy),
      }).addRemainingAccounts(proofAccounts(decoyProof))
    )
    .sendAndConfirm(buyerUmi);

  await t.throwsAsync(promise, { message: /InvalidMint|InvalidMerkleTree/ });
});

test('it rejects a v2 compressed nft with UnsupportedCnftVersion', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  const { proof } = getCnftProof(umi, item);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      addCnft(umi, {
        gumballMachine,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item, { version: 2 }),
        addItemArgs,
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /UnsupportedCnftVersion/ });
});

test('it can request, then cancel, adding a compressed nft (collab flow)', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // A separate seller owns the leaf.
  const sellerUmi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi, { owner: sellerUmi.identity.publicKey });

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(sellerUmi, { units: 800_000 }))
    .add(
      requestAddCnft(sellerUmi, {
        gumballMachine,
        asset: item.assetId,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(sellerUmi);
  item.owner = findGumballMachineAuthorityPda(umi, { gumballMachine })[0];

  // The request account exists, keyed by the asset id.
  const request = await fetchAddItemRequestFromSeeds(umi, { asset: item.assetId });
  t.like(request, {
    asset: item.assetId,
    seller: sellerUmi.identity.publicKey,
    gumballMachine,
    tokenStandard: TokenStandard.Compressed,
  });

  // Cancel returns the leaf to the seller and closes the request.
  const { proof: cancelProof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(sellerUmi, { units: 800_000 }))
    .add(
      cancelAddCnftRequest(sellerUmi, {
        asset: item.assetId,
        sellerHistory: findSellerHistoryPda(umi, {
          gumballMachine,
          seller: sellerUmi.identity.publicKey,
        })[0],
        authorityPda: findGumballMachineAuthorityPda(umi, { gumballMachine })[0],
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(proofAccounts(cancelProof))
    )
    .sendAndConfirm(sellerUmi);

  const closed = await safeFetchAddItemRequestFromSeeds(umi, {
    asset: item.assetId,
  });
  t.is(closed, null);
});

test('it can request then approve adding a compressed nft (collab flow)', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  const sellerUmi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi, { owner: sellerUmi.identity.publicKey });

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(sellerUmi, { units: 800_000 }))
    .add(
      requestAddCnft(sellerUmi, {
        gumballMachine,
        asset: item.assetId,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(sellerUmi);

  // Authority approves: the escrowed leaf becomes a real config line.
  await transactionBuilder()
    .add(
      approveAddItem(umi, {
        gumballMachine,
        asset: item.assetId,
        seller: sellerUmi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  const account = await fetchGumballMachine(umi, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    mint: item.assetId,
    seller: sellerUmi.identity.publicKey,
    tokenStandard: TokenStandard.Compressed,
  });
});
