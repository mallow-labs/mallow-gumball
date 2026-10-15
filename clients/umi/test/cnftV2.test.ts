import { withRequestCancellationMachine } from '../src';
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import {
  burnV2,
  freezeV2,
  getMerkleProof,
  getMerkleRoot,
  hashMetadataCreators,
  hashMetadataV2,
  transferV2,
  updateAssetDataV2,
} from '@metaplex-foundation/mpl-bubblegum';
import { createCollection, ruleSet } from '@metaplex-foundation/mpl-core';
import {
  fetchToken,
  findAssociatedTokenPda,
  getSplTokenProgramId,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  addAmounts,
  defaultPublicKey,
  generateSigner,
  isEqualToAmount,
  publicKeyBytes,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  addCnft as addCnftV1,
  addCnftV2,
  approveAddItem,
  cancelAddCnftRequest as cancelAddCnftRequestV1,
  cancelAddCnftRequestV2,
  claimCnft as claimCnftV1,
  claimCnftV2,
  closeGumballMachine,
  draw,
  endSale,
  fetchAddItemRequestFromSeeds,
  fetchGumballMachine,
  findAddItemRequestPda,
  findGumballGuardPda,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  GumballMachine,
  removeCnft as removeCnftV1,
  removeCnftV2,
  requestAddCnft as requestAddCnftV1,
  requestAddCnftV2,
  safeFetchAddItemRequestFromSeeds,
  safeFetchSellerHistory,
  settleCnftSale as settleCnftSaleV1,
  settleCnftSaleV2,
  startSale,
  TokenStandard,
} from '../src';
import { mintCnft as mintCnftV1 } from './_cnftSetup';
import {
  addCollectionExternalAdapters,
  addLargeCollectionAttributes,
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
  settleRemainingAccounts,
} from './_cnftV2Setup';
import { measureInstruction } from './_round13Token';
import {
  assertItemBought as assertItemDrawn,
  create,
  createMintWithHolders,
  createUmi,
} from './_setup';

// Gumball validation uses the specific generated Anchor error numbers.
// Compression validation matches its InvalidRoot/LeafContentsModified diagnostics.
// Both fields default to `none` via the generated struct defaults.
const addItemArgs = {};

// Add a freshly-minted cNFT (owned by umi.identity, the authority) to a machine.
// Escrows the leaf to the authority PDA and flips `item.owner` to the PDA.
const addCnftItem = async (umi: any, gumballMachine: any, item: any) => {
  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      addCnftV2(umi, {
        leafDelegate: item.delegate ?? item.owner,
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

test('it escrows a v2 compressed nft when added to a gumball machine', async (t) => {
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

test('it can remove a v2 compressed nft, returning the leaf to the seller', async (t) => {
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
      removeCnftV2(umi, {
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

test('it can claim a v2 compressed nft for the buyer after a draw', async (t) => {
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
      claimCnftV2(buyerUmi, {
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
  // Creators/sfbp args are bound to the asset via a VerifyLeaf CPI on the
  // CURRENT leaf, so root/proof must be post-claim and the buyer is the owner.
  const { proof: settleProof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSaleV2(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        currentLeafOwner: buyerUmi.identity.publicKey,
        currentLeafDelegate: buyerUmi.identity.publicKey,
      }).addRemainingAccounts(
        settleRemainingAccounts(item.creators, settleProof)
      )
    )
    .sendAndConfirm(umi);

  const settled = await fetchGumballMachine(umi, gumballMachine);
  t.like(settled, <Partial<GumballMachine>>{
    itemsSettled: 1n,
    items: [{ index: 0, isClaimed: true, isSettled: true }],
  });
});

// SECURITY: once a leaf is claimed, settle no longer runs the Transfer CPI that
// proves creators/sfbp are honest. Without the VerifyLeaf guard a settler could
// pass forged creators (themselves at sfbp 10000) and skim the seller's
// proceeds. The guard must reject args that don't hash to the real leaf.
test('it cannot settle an already-claimed v2 cnft sale with forged creators', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const creator = generateSigner(umi);
  const item = await mintCnft(umi, {
    sellerFeeBasisPoints: 500,
    creators: [{ address: creator.publicKey, verified: false, share: 100 }],
  });
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: { lamports: sol(1) } },
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

  // Honest claim moves the leaf to the buyer (proof-verified).
  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      claimCnftV2(buyerUmi, {
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

  // Forged settle: attacker as sole creator. Root/proof/owner are all CURRENT
  // and honest — only creators (folded into creator_hash) lie, so the
  // reconstructed leaf doesn't match the tree and VerifyLeaf fails.
  const attacker = generateSigner(umi);
  const forged = [{ address: attacker.publicKey, verified: false, share: 100 }];
  const { proof: settleProof } = getCnftProof(umi, item);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSaleV2(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item, { creators: forged }),
        currentLeafOwner: buyerUmi.identity.publicKey,
        currentLeafDelegate: buyerUmi.identity.publicKey,
      }).addRemainingAccounts(settleRemainingAccounts(forged, settleProof))
    )
    .sendAndConfirm(umi);

  // mpl-account-compression rejects the leaf verification.
  await t.throwsAsync(promise, {
    message: /Invalid root recomputed from proof/,
  });

  // The sale stayed unsettled — the attacker took nothing.
  const account = await fetchGumballMachine(umi, gumballMachine);
  t.like(account, <Partial<GumballMachine>>{
    items: [{ index: 0, isClaimed: true, isSettled: false }],
  });
});

test('it settles an unclaimed v2 compressed nft sale, transferring the leaf and paying royalties', async (t) => {
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
      settleCnftSaleV2(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        // Unclaimed path: the Transfer CPI does the binding, so these are unused
        // — pass the current DAS owner/delegate (the escrow PDA) for parity.
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.owner,
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(umi);
  item.owner = buyerUmi.identity.publicKey;

  // Royalty (5% of 1 SOL) landed with the creator — trustless, since a lie about
  // sfbp/creators would have failed the Bubblegum proof on the leaf transfer.
  const creatorPost = await umi.rpc.getBalance(creator.publicKey);
  t.true(
    isEqualToAmount(creatorPost, addAmounts(creatorPre, sol(0.05)), sol(0.005)),
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
      claimCnftV2(buyerUmi, {
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

  await t.throwsAsync(promise, { message: /Error Number: 6039/ });
});

test('it rejects a v1 argument for a v2 compressed nft with UnsupportedCnftVersion', async (t) => {
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
      addCnftV2(umi, {
        leafDelegate: item.delegate ?? item.owner,
        gumballMachine,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item, { version: 1 }),
        addItemArgs,
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /Error Number: 6069/ });
});

test('it can request, then cancel, adding a v2 compressed nft (collab flow)', async (t) => {
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
      requestAddCnftV2(sellerUmi, {
        leafDelegate: item.delegate ?? item.owner,
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
  const request = await fetchAddItemRequestFromSeeds(umi, {
    asset: item.assetId,
  });
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
      withRequestCancellationMachine(
        cancelAddCnftRequestV2(sellerUmi, {
          asset: item.assetId,
          sellerHistory: findSellerHistoryPda(umi, {
            gumballMachine,
            seller: sellerUmi.identity.publicKey,
          })[0],
          authorityPda: findGumballMachineAuthorityPda(umi, {
            gumballMachine,
          })[0],
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          args: cnftArgs(umi, item),
        }).addRemainingAccounts(proofAccounts(cancelProof)),
        gumballMachine
      )
    )
    .sendAndConfirm(sellerUmi);

  const closed = await safeFetchAddItemRequestFromSeeds(umi, {
    asset: item.assetId,
  });
  t.is(closed, null);
});

test('it can request then approve adding a v2 compressed nft (collab flow)', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot: some(new Uint8Array(32)) },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  const sellerUmi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi, { owner: sellerUmi.identity.publicKey });

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(sellerUmi, { units: 800_000 }))
    .add(
      requestAddCnftV2(sellerUmi, {
        leafDelegate: item.delegate ?? item.owner,
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

// The settle remaining-accounts layout is `[creator payouts..., proof nodes...]`,
// split by `creators.len()`. With a single creator (the other settle tests) a
// mis-count is invisible: the whole tail is proof either way. Two creators with
// unequal shares proves the split point AND the per-creator distribution: each
// wallet must receive its share of the royalty and the proof must still verify.
test('it settles a v2 cnft sale splitting royalties across multiple creators', async (t) => {
  const umi = await createCnftUmi(createUmi);

  const creatorA = generateSigner(umi);
  const creatorB = generateSigner(umi);
  const item = await mintCnft(umi, {
    sellerFeeBasisPoints: 1000, // 10% royalty on a 1 SOL sale = 0.1 SOL.
    creators: [
      { address: creatorA.publicKey, verified: false, share: 60 },
      { address: creatorB.publicKey, verified: false, share: 40 },
    ],
  });

  const gumballMachineSigner = await create(umi, {
    // curatorFeeBps 0 so the whole 1 SOL is the royalty base — isolates the split.
    settings: { itemCapacity: 5, curatorFeeBps: 0 },
    guards: { solPayment: { lamports: sol(1) } },
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

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSaleV2(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.owner,
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(umi);
  item.owner = buyerUmi.identity.publicKey;

  // 60/40 of the 0.1 SOL royalty pool.
  const creatorABalance = await umi.rpc.getBalance(creatorA.publicKey);
  const creatorBBalance = await umi.rpc.getBalance(creatorB.publicKey);
  t.true(
    isEqualToAmount(creatorABalance, sol(0.06), sol(0.005)),
    `creatorA: ${creatorABalance.basisPoints}`
  );
  t.true(
    isEqualToAmount(creatorBBalance, sol(0.04), sol(0.005)),
    `creatorB: ${creatorBBalance.basisPoints}`
  );

  const settled = await fetchGumballMachine(umi, gumballMachine);
  t.like(settled, <Partial<GumballMachine>>{
    itemsSettled: 1n,
    items: [{ index: 0, isSettled: true }],
  });
});

// Unsold path: an item that ended the sale without a draw has `buyer == default`.
// Settle must route the escrowed leaf BACK to the seller (not to the zero
// address). Verified by re-adding the returned leaf to a fresh machine, which
// only succeeds if the seller genuinely owns it again.
test('it settles an unsold cnft, returning the leaf to the seller', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);

  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: { lamports: sol(1) } },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  await addCnftItem(umi, gumballMachine, item);
  await transactionBuilder()
    .add(startSale(umi, { gumballMachine }))
    .sendAndConfirm(umi);
  await endSale(umi, { gumballMachine }).sendAndConfirm(umi);

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSaleV2(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: defaultPublicKey(),
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.owner,
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(umi);
  // The leaf should be back with the seller.
  item.owner = umi.identity.publicKey;

  const settled = await fetchGumballMachine(umi, gumballMachine);
  t.like(settled, <Partial<GumballMachine>>{
    itemsRedeemed: 0n,
    itemsSettled: 1n,
    items: [{ index: 0, isSettled: true }],
  });

  // Proof the leaf returned: re-adding to a new machine needs seller ownership,
  // and the escrow-in Transfer CPI would fail otherwise.
  const otherMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
  });
  await addCnftItem(umi, otherMachineSigner.publicKey, item);
  const reAdded = await fetchGumballMachine(umi, otherMachineSigner.publicKey);
  t.is(reAdded.itemsLoaded, 1);
});

// Marketplace fee config: the cNFT settle account struct wires its own
// `fee_account` into the shared `claim_proceeds`. Assert the configured fee
// account actually receives its 5% cut of the 1 SOL sale.
test('it settles a v2 cnft sale paying a marketplace fee', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const feeAccount = generateSigner(umi).publicKey;

  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5, curatorFeeBps: 0 },
    feeConfig: { feeAccount, feeBps: 500 },
    guards: { solPayment: { lamports: sol(1) } },
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
        mintArgs: { solPayment: some({ feeAccounts: [feeAccount] }) },
      })
    )
    .sendAndConfirm(umi);

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSaleV2(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        feeAccount,
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.owner,
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(umi);
  item.owner = buyerUmi.identity.publicKey;

  const feeAccountBalance = await umi.rpc.getBalance(feeAccount);
  t.true(
    isEqualToAmount(feeAccountBalance, sol(0.05), sol(0.005)),
    `fee account: ${feeAccountBalance.basisPoints}`
  );
});

// Authorization: the settle account struct only requires `payer` to sign — the
// authority/seller/buyer are all unchecked. A wallet that is none of those must
// still be able to settle on the seller's behalf.
test('it can settle a v2 cnft sale as an unrelated third party', async (t) => {
  const umi = await createCnftUmi(createUmi);

  const creator = generateSigner(umi);
  const item = await mintCnft(umi, {
    sellerFeeBasisPoints: 500,
    creators: [{ address: creator.publicKey, verified: false, share: 100 }],
  });

  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5, curatorFeeBps: 0 },
    guards: { solPayment: { lamports: sol(1) } },
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

  // A settler with no relationship to the sale (not authority/seller/buyer).
  const thirdPartyUmi = await createCnftUmi(createUmi);
  const creatorPre = await umi.rpc.getBalance(creator.publicKey);

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(thirdPartyUmi, { units: 800_000 }))
    .add(
      settleCnftSaleV2(thirdPartyUmi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.owner,
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(thirdPartyUmi);
  item.owner = buyerUmi.identity.publicKey;

  // Proceeds still routed to the real creator, not the settler.
  const creatorPost = await umi.rpc.getBalance(creator.publicKey);
  t.true(
    isEqualToAmount(creatorPost, addAmounts(creatorPre, sol(0.05)), sol(0.005))
  );

  const settled = await fetchGumballMachine(umi, gumballMachine);
  t.like(settled, <Partial<GumballMachine>>{
    itemsSettled: 1n,
    items: [{ index: 0, isSettled: true }],
  });
});

// Edge case: the authority/seller draws their own item, so buyer == seller.
// Settle must transfer the leaf to that buyer and close cleanly.
test('it settles a v2 cnft sale where the buyer is the seller', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);

  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: { lamports: sol(1) } },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  await addCnftItem(umi, gumballMachine, item);
  await transactionBuilder()
    .add(startSale(umi, { gumballMachine }))
    .sendAndConfirm(umi);

  // Seller draws their own item (buyer defaults to umi.identity).
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(draw(umi, { gumballMachine, mintArgs: { solPayment: some(true) } }))
    .sendAndConfirm(umi);

  const { proof } = getCnftProof(umi, item);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      settleCnftSaleV2(umi, {
        index: 0,
        gumballMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        buyer: umi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.owner,
      }).addRemainingAccounts(settleRemainingAccounts(item.creators, proof))
    )
    .sendAndConfirm(umi);
  item.owner = umi.identity.publicKey;

  const settled = await fetchGumballMachine(umi, gumballMachine);
  t.like(settled, <Partial<GumballMachine>>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
    items: [{ index: 0, isSettled: true }],
  });

  // Seller history is closed once the seller's only item is settled.
  const sellerHistory = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine,
      seller: umi.identity.publicKey,
    })
  );
  t.falsy(sellerHistory);
});

// Claim records the buyer from the config line. Anyone MAY submit the claim, but
// only for the recorded buyer — a mismatched buyer must be rejected before any
// leaf moves.
test('it cannot claim a cnft as the wrong buyer', async (t) => {
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

  // The real buyer draws the item.
  const buyerUmi = await createCnftUmi(createUmi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(draw(buyerUmi, { gumballMachine }))
    .sendAndConfirm(buyerUmi);

  // A different wallet claims for itself: buyer defaults to umi.identity, which
  // is not the recorded buyer -> the config-line buyer check fails.
  const { proof } = getCnftProof(umi, item);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      claimCnftV2(umi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /Error Number: 6042/ });
});

const makeCollection = async (umi: any, plugins: any[] = []) => {
  const collection = generateSigner(umi);
  await createCollection(umi, {
    collection,
    name: 'cNFT v2 collection',
    uri: 'https://example.com/collection.json',
    plugins: [{ type: 'BubblegumV2' }, ...plugins],
  }).sendAndConfirm(umi);
  return collection.publicKey;
};

const entry = (umi: any, machine: any, item: any, overrides: any = {}) =>
  addCnftV2(umi, {
    gumballMachine: machine,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    leafDelegate: item.delegate ?? item.owner,
    coreCollection: item.collection,
    args: cnftArgs(umi, item),
    addItemArgs,
    ...overrides,
  }).addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof));

const beginDraw = async (umi: any, machine: any) => {
  await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
  const buyerUmi = await createCnftUmi(createUmi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      draw(umi, {
        gumballMachine: machine,
        buyer: buyerUmi.identity,
        mintArgs: { solPayment: some(true) },
      })
    )
    .sendAndConfirm(umi);
  return buyerUmi;
};

const settlement = (
  umi: any,
  machine: any,
  item: any,
  buyer: any,
  payouts: any[],
  overrides: any = {}
) =>
  settleCnftSaleV2(umi, {
    gumballMachine: machine,
    index: 0,
    authority: umi.identity.publicKey,
    seller: umi.identity.publicKey,
    buyer,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    coreCollection: item.collection,
    args: cnftArgs(umi, item),
    currentLeafOwner: item.owner,
    currentLeafDelegate: item.delegate ?? item.owner,
    ...overrides,
  }).addRemainingAccounts(
    settleRemainingAccounts(payouts, getCnftProof(umi, item).proof)
  );

for (const alreadyClaimed of [false, true]) {
  test(`collection Attributes permit inherited settlement; claimed=${alreadyClaimed}, bytes=${alreadyClaimed ? 40_000 : 4_000}`, async (t) => {
    const umi = await createCnftUmi(createUmi);
    const creator = await generateSignerWithSol(umi, sol(1));
    const collection = await makeCollection(umi, [
      {
        type: 'Royalties',
        basisPoints: 500,
        creators: [{ address: creator.publicKey, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
    ]);
    const item = await mintCnft(umi, {
      collection,
      sellerFeeBasisPoints: 65535,
      creators: [],
    });
    const machine = (
      await create(umi, {
        settings: { itemCapacity: 1, curatorFeeBps: 0 },
        guards: { solPayment: { lamports: sol(1) } },
        disablePrimarySplit: true,
      })
    ).publicKey;
    // Bubblegum itself fully loads the collection on transfers. Test 4 KB
    // there, and growth to 40 KB after claim on our VerifyLeaf-only path.
    if (!alreadyClaimed) addLargeCollectionAttributes(collection, 4_000);
    await entry(umi, machine, item).sendAndConfirm(umi);
    item.owner = findGumballMachineAuthorityPda(umi, {
      gumballMachine: machine,
    })[0];
    const buyer = await beginDraw(umi, machine);
    if (alreadyClaimed) {
      await claimCnftV2(umi, {
        gumballMachine: machine,
        index: 0,
        seller: umi.identity.publicKey,
        buyer: buyer.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        coreCollection: collection,
        args: cnftArgs(umi, item),
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
        .sendAndConfirm(umi);
      item.owner = buyer.identity.publicKey;
      addLargeCollectionAttributes(collection);
    }
    const before = (await umi.rpc.getBalance(creator.publicKey)).basisPoints;
    await settlement(umi, machine, item, buyer.identity.publicKey, [
      { address: creator.publicKey, verified: false, share: 100 },
    ]).sendAndConfirm(umi);
    t.is(
      (await umi.rpc.getBalance(creator.publicKey)).basisPoints - before,
      50_000_000n
    );
    t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
  });
}

for (const alreadyClaimed of [false, true]) {
  for (const leafRate of [65535, 0]) {
    test(`collection royalties with ${leafRate} leaf rate, claimed=${alreadyClaimed}`, async (t) => {
      const umi = await createCnftUmi(createUmi);
      const creatorA = await generateSignerWithSol(umi, sol(1));
      const creatorB = await generateSignerWithSol(umi, sol(1));
      const collection = await makeCollection(umi, [
        {
          type: 'Royalties',
          basisPoints: 750,
          creators: [
            { address: creatorA.publicKey, percentage: 60 },
            { address: creatorB.publicKey, percentage: 40 },
          ],
          ruleSet: ruleSet('None'),
        },
      ]);
      const item = await mintCnft(umi, {
        collection,
        sellerFeeBasisPoints: leafRate,
        creators: [],
      });
      const machine = (
        await create(umi, {
          settings: { itemCapacity: 1, curatorFeeBps: 0 },
          guards: { solPayment: { lamports: sol(1) } },
          disablePrimarySplit: true,
        })
      ).publicKey;
      await entry(umi, machine, item).sendAndConfirm(umi);
      item.owner = findGumballMachineAuthorityPda(umi, {
        gumballMachine: machine,
      })[0];
      const buyer = await beginDraw(umi, machine);
      if (alreadyClaimed) {
        await claimCnftV2(umi, {
          gumballMachine: machine,
          index: 0,
          seller: umi.identity.publicKey,
          buyer: buyer.identity.publicKey,
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          coreCollection: collection,
          args: cnftArgs(umi, item),
        })
          .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
          .sendAndConfirm(umi);
        item.owner = buyer.identity.publicKey;
      }
      const payouts = [
        { address: creatorA.publicKey, verified: false, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ];
      const preA = await umi.rpc.getBalance(creatorA.publicKey);
      const preB = await umi.rpc.getBalance(creatorB.publicKey);
      await settlement(
        umi,
        machine,
        item,
        buyer.identity.publicKey,
        payouts
      ).sendAndConfirm(umi);
      t.is(
        (await umi.rpc.getBalance(creatorA.publicKey)).basisPoints -
          preA.basisPoints,
        45_000_000n
      );
      t.is(
        (await umi.rpc.getBalance(creatorB.publicKey)).basisPoints -
          preB.basisPoints,
        30_000_000n
      );
      t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
    });
  }
}

test('v2 entry uses the actual non-signing delegate and resets it on transfer', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const delegate = generateSigner(umi).publicKey;
  const item = await mintCnft(umi, { delegate });
  const machine = (await create(umi, { settings: { itemCapacity: 1 } }))
    .publicKey;
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  item.delegate = undefined;
  await removeCnftV2(umi, {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(umi);
  t.is((await fetchGumballMachine(umi, machine)).itemsLoaded, 0);
});

for (const plugin of [
  { type: 'PermanentFreezeDelegate', frozen: false },
  { type: 'PermanentFreezeDelegate', frozen: true },
  { type: 'PermanentTransferDelegate' },
  { type: 'PermanentBurnDelegate' },
]) {
  test(`v2 entry refuses ${plugin.type} ${'frozen' in plugin ? plugin.frozen : ''}`, async (t) => {
    const umi = await createCnftUmi(createUmi);
    const collection = await makeCollection(umi, [plugin]);
    const item = await mintCnft(umi, { collection });
    const machine = (await create(umi, { settings: { itemCapacity: 1 } }))
      .publicKey;
    await t.throwsAsync(entry(umi, machine, item).sendAndConfirm(umi), {
      message: /Error Number: 6053/,
    });
    t.is((await fetchGumballMachine(umi, machine)).itemsLoaded, 0);
  });
}

for (const flags of [1, 2, 4, 8]) {
  test(`v2 entry refuses flags=${flags}`, async (t) => {
    const umi = await createCnftUmi(createUmi);
    const item = await mintCnft(umi);
    const machine = (await create(umi, { settings: { itemCapacity: 1 } }))
      .publicKey;
    await t.throwsAsync(
      entry(umi, machine, item, {
        args: cnftArgs(umi, item, { flags }),
      }).sendAndConfirm(umi),
      { message: /Error Number: 6072/ }
    );
    t.is((await fetchGumballMachine(umi, machine)).itemsLoaded, 0);
  });
}

test('v2 entry refuses a frozen leaf even when supplied flags are zero', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  await freezeV2(umi, {
    merkleTree: item.merkleTree,
    leafOwner: item.owner,
    leafDelegate: item.owner,
    root: publicKeyBytes(getCnftProof(umi, item).root),
    dataHash: hashMetadataV2(item.metadata),
    creatorHash: hashMetadataCreators(item.creators),
    nonce: 0,
    index: 0,
    proof: getCnftProof(umi, item).proof,
  }).sendAndConfirm(umi);
  item.flags = 1;
  const machine = (await create(umi, { settings: { itemCapacity: 1 } }))
    .publicKey;
  await t.throwsAsync(entry(umi, machine, item).sendAndConfirm(umi), {
    message: /Error Number: 6072/,
  });
  await t.throwsAsync(
    entry(umi, machine, item, {
      args: cnftArgs(umi, item, { flags: 0 }),
    }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  t.is((await fetchGumballMachine(umi, machine)).itemsLoaded, 0);
});

test('v2 collected leaf requires its real Core collection', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const collection = await makeCollection(umi);
  const otherCollection = await makeCollection(umi);
  const item = await mintCnft(umi, { collection });
  const machine = (await create(umi, { settings: { itemCapacity: 1 } }))
    .publicKey;
  await t.throwsAsync(
    entry(umi, machine, item, { coreCollection: null }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  await t.throwsAsync(
    entry(umi, machine, item, {
      coreCollection: otherCollection,
    }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  t.is((await fetchGumballMachine(umi, machine)).itemsLoaded, 0);
  await entry(umi, machine, item).sendAndConfirm(umi);
  t.is((await fetchGumballMachine(umi, machine)).itemsLoaded, 1);
});

test('v2 instructions reject SPL-compression trees and v1 rejects MPL trees', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const machine = (await create(umi, { settings: { itemCapacity: 1 } }))
    .publicKey;
  const mintedV1 = await mintCnftV1(umi);
  const v1 = { ...mintedV1, depth: 5, canopyDepth: 0, flags: 0 };
  await t.throwsAsync(entry(umi, machine, v1).sendAndConfirm(umi), {
    message: /Error Number: 6069/,
  });
  const v2 = await mintCnft(umi);
  await t.throwsAsync(
    addCnftV1(umi, {
      gumballMachine: machine,
      treeConfig: v2.treeConfig,
      merkleTree: v2.merkleTree,
      args: { ...cnftArgs(umi, v2), version: 1 },
      addItemArgs,
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(umi, v2).proof))
      .sendAndConfirm(umi),
    { message: /Error Number: 6069/ }
  );
});

test('v2 already-claimed settlement proves the collection as well as royalties', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const creator = await generateSignerWithSol(umi, sol(1));
  const collection = await makeCollection(umi, [
    {
      type: 'Royalties',
      basisPoints: 500,
      creators: [{ address: creator.publicKey, percentage: 100 }],
      ruleSet: ruleSet('None'),
    },
  ]);
  const substitute = await makeCollection(umi);
  const item = await mintCnft(umi, {
    collection,
    sellerFeeBasisPoints: 65535,
    creators: [],
  });
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1, curatorFeeBps: 0 },
      guards: { solPayment: { lamports: sol(1) } },
    })
  ).publicKey;
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const buyer = await beginDraw(umi, machine);
  await claimCnftV2(umi, {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    buyer: buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    coreCollection: collection,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(umi);
  item.owner = buyer.identity.publicKey;
  // Bind to the current holder after another legitimate transfer.
  const nextOwner = generateSigner(umi).publicKey;
  await transferV2(buyer, {
    leafOwner: item.owner,
    merkleTree: item.merkleTree,
    coreCollection: collection,
    newLeafOwner: nextOwner,
    root: publicKeyBytes(getCnftProof(umi, item).root),
    dataHash: hashMetadataV2(item.metadata),
    creatorHash: hashMetadataCreators(item.creators),
    nonce: 0,
    index: 0,
    proof: getCnftProof(umi, item).proof,
  }).sendAndConfirm(buyer);
  item.owner = nextOwner;
  const payouts = [{ address: creator.publicKey, share: 100, verified: false }];
  for (const overrides of [
    { currentLeafOwner: buyer.identity.publicKey },
    { currentLeafDelegate: buyer.identity.publicKey },
    {
      currentLeafOwner: findGumballMachineAuthorityPda(umi, {
        gumballMachine: machine,
      })[0],
    },
  ]) {
    await t.throwsAsync(
      settlement(
        umi,
        machine,
        item,
        buyer.identity.publicKey,
        payouts,
        overrides
      ).sendAndConfirm(umi),
      { message: /Invalid root recomputed from proof/ }
    );
  }
  await t.throwsAsync(
    settlement(umi, machine, item, buyer.identity.publicKey, [], {
      coreCollection: null,
    }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  await t.throwsAsync(
    settlement(umi, machine, item, buyer.identity.publicKey, [], {
      coreCollection: substitute,
    }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  await t.throwsAsync(
    settlement(umi, machine, item, buyer.identity.publicKey, payouts, {
      args: cnftArgs(umi, item, { sellerFeeBasisPoints: 0 }),
    }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 0n);
  await settlement(
    umi,
    machine,
    item,
    buyer.identity.publicKey,
    payouts
  ).sendAndConfirm(umi);
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
});

test('R7-22: pinned Bubblegum rejects non-default asset-data updates with 6050', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  await t.throwsAsync(
    updateAssetDataV2(umi, {
      merkleTree: item.merkleTree,
      leafOwner: item.owner,
      root: publicKeyBytes(getCnftProof(umi, item).root),
      dataHash: hashMetadataV2(item.metadata),
      creatorHash: hashMetadataCreators(item.creators),
      nonce: 0,
      index: 0,
      proof: getCnftProof(umi, item).proof,
      newAssetData: some(new Uint8Array([1, 3, 5, 7, 9])),
    }).sendAndConfirm(umi),
    { message: /Error Number: 6050/ }
  );
});

// The loaded Bubblegum binary disables updateAssetDataV2 with error 6050.
// Keep this lifecycle explicitly skipped until an upstream fixture can be minted.
test.skip('v2 non-default asset data stays authenticated through claim and settle', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const assetData = new Uint8Array([1, 3, 5, 7, 9]);
  await updateAssetDataV2(umi, {
    merkleTree: item.merkleTree,
    leafOwner: item.owner,
    root: publicKeyBytes(getCnftProof(umi, item).root),
    dataHash: hashMetadataV2(item.metadata),
    creatorHash: hashMetadataCreators(item.creators),
    nonce: 0,
    index: 0,
    proof: getCnftProof(umi, item).proof,
    newAssetData: some(assetData),
  }).sendAndConfirm(umi);
  item.assetData = assetData;
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1, curatorFeeBps: 0 },
      guards: { solPayment: { lamports: sol(1) } },
    })
  ).publicKey;
  await t.throwsAsync(
    entry(umi, machine, item, {
      args: cnftArgs(umi, item, { assetDataHash: null }),
    }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const buyer = await beginDraw(umi, machine);
  await claimCnftV2(umi, {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    buyer: buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(umi);
  item.owner = buyer.identity.publicKey;
  await t.throwsAsync(
    settlement(umi, machine, item, buyer.identity.publicKey, item.creators, {
      args: cnftArgs(umi, item, { assetDataHash: null }),
    }).sendAndConfirm(umi),
    { message: /Invalid root recomputed from proof/ }
  );
  await settlement(
    umi,
    machine,
    item,
    buyer.identity.publicKey,
    item.creators
  ).sendAndConfirm(umi);
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
});

test('v2 protocol fee is charged to the wallet payer while PDA custody funds stay intact', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1, curatorFeeBps: 0 },
      guards: {},
    })
  ).publicKey;
  const treeBefore = (await umi.rpc.getAccount(item.treeConfig)).lamports
    .basisPoints;
  await entry(umi, machine, item).sendAndConfirm(umi);
  const entryFee =
    (await umi.rpc.getAccount(item.treeConfig)).lamports.basisPoints -
    treeBefore;
  t.true(entryFee > 0n);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
  const buyer = await createCnftUmi(createUmi);
  await draw(buyer, { gumballMachine: machine }).sendAndConfirm(buyer);
  const payer = await createCnftUmi(createUmi);
  const custodyBefore = (await umi.rpc.getBalance(item.owner)).basisPoints;
  const payerBefore = (await umi.rpc.getBalance(payer.identity.publicKey))
    .basisPoints;
  const treePreClaim = (await umi.rpc.getAccount(item.treeConfig)).lamports
    .basisPoints;
  await claimCnftV2(payer, {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    buyer: buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(payer);
  const exitFee =
    (await umi.rpc.getAccount(item.treeConfig)).lamports.basisPoints -
    treePreClaim;
  t.is(exitFee, entryFee);
  t.is((await umi.rpc.getBalance(item.owner)).basisPoints, custodyBefore);
  t.true(
    payerBefore -
      (await umi.rpc.getBalance(payer.identity.publicKey)).basisPoints >=
      exitFee
  );
  t.log(`Observed Bubblegum transfer fee: ${entryFee} lamports`);
});

for (const collectionPresent of [false, true]) {
  test(`v2 empty leaf creators without a collection Royalties plugin pay zero; collection=${collectionPresent}`, async (t) => {
    const umi = await createCnftUmi(createUmi);
    const collection = collectionPresent
      ? await makeCollection(umi)
      : undefined;
    const item = await mintCnft(umi, {
      collection,
      sellerFeeBasisPoints: 0,
      creators: [],
    });
    const machine = (
      await create(umi, {
        settings: { itemCapacity: 1, curatorFeeBps: 0 },
        guards: { solPayment: { lamports: sol(1) } },
        disablePrimarySplit: true,
      })
    ).publicKey;
    await entry(umi, machine, item).sendAndConfirm(umi);
    item.owner = findGumballMachineAuthorityPda(umi, {
      gumballMachine: machine,
    })[0];
    const buyer = await beginDraw(umi, machine);
    await settlement(
      umi,
      machine,
      item,
      buyer.identity.publicKey,
      []
    ).sendAndConfirm(umi);
    t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
  });
}

test('v2 leaf royalties take precedence over collection royalties', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const leafCreator = await generateSignerWithSol(umi, sol(1));
  const collectionCreator = await generateSignerWithSol(umi, sol(1));
  const collection = await makeCollection(umi, [
    {
      type: 'Royalties',
      basisPoints: 900,
      creators: [{ address: collectionCreator.publicKey, percentage: 100 }],
      ruleSet: ruleSet('None'),
    },
  ]);
  const item = await mintCnft(umi, {
    collection,
    sellerFeeBasisPoints: 500,
    creators: [{ address: leafCreator.publicKey, verified: false, share: 100 }],
  });
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1, curatorFeeBps: 0 },
      guards: { solPayment: { lamports: sol(1) } },
      disablePrimarySplit: true,
    })
  ).publicKey;
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const buyer = await beginDraw(umi, machine);
  const preLeaf = (await umi.rpc.getBalance(leafCreator.publicKey)).basisPoints;
  const preCollection = (await umi.rpc.getBalance(collectionCreator.publicKey))
    .basisPoints;
  await settlement(
    umi,
    machine,
    item,
    buyer.identity.publicKey,
    item.creators
  ).sendAndConfirm(umi);
  t.is(
    (await umi.rpc.getBalance(leafCreator.publicKey)).basisPoints - preLeaf,
    50_000_000n
  );
  t.is(
    (await umi.rpc.getBalance(collectionCreator.publicKey)).basisPoints,
    preCollection
  );
});

for (const token2022 of [false, true]) {
  test(`v2 inherited payouts split wallet/ATA accounts from proofs; Token2022=${token2022}`, async (t) => {
    const umi = await createCnftUmi(createUmi);
    const programs = umi.programs.clone();
    if (token2022) programs.bind('splToken', 'splToken2022');
    const tokenUmi = { ...umi, programs };
    const machineSigner = generateSigner(umi);
    const machine = machineSigner.publicKey;
    const escrow = findGumballMachineAuthorityPda(umi, {
      gumballMachine: machine,
    })[0];
    const creatorA = generateSigner(umi).publicKey;
    const creatorB = generateSigner(umi).publicKey;
    const [mint, _buyerAta, treasury, creatorAtaA, creatorAtaB] =
      await createMintWithHolders(tokenUmi, {
        decimals: 0,
        holders: [
          { owner: umi.identity, amount: 10_000 },
          { owner: escrow, amount: 0 },
          { owner: creatorA, amount: 0 },
          { owner: creatorB, amount: 0 },
        ],
      });
    const collection = await makeCollection(umi, [
      {
        type: 'Royalties',
        basisPoints: 700,
        creators: [
          { address: creatorA, percentage: 70 },
          { address: creatorB, percentage: 30 },
        ],
        ruleSet: ruleSet('None'),
      },
    ]);
    const item = await mintCnft(umi, {
      collection,
      sellerFeeBasisPoints: 65535,
      creators: [],
    });
    const guard = {
      mint: mint.publicKey,
      destinationAta: treasury,
      amount: 10_000,
    };
    await create(umi, {
      gumballMachine: machineSigner,
      settings: {
        itemCapacity: 1,
        paymentMint: mint.publicKey,
        curatorFeeBps: 0,
      },
      guards: token2022
        ? { token2022Payment: some(guard) }
        : { tokenPayment: some(guard) },
      disablePrimarySplit: true,
    });
    await entry(umi, machine, item).sendAndConfirm(umi);
    item.owner = escrow;
    await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
    const mintArgs = token2022
      ? {
          token2022Payment: some({
            mint: mint.publicKey,
            destinationAta: treasury,
          }),
        }
      : {
          tokenPayment: some({
            mint: mint.publicKey,
            destinationAta: treasury,
          }),
        };
    await draw(umi, { gumballMachine: machine, mintArgs }).sendAndConfirm(umi);
    const readonly = (pubkey: any) => ({
      pubkey,
      isWritable: false,
      isSigner: false,
    });
    const writable = (pubkey: any) => ({
      pubkey,
      isWritable: true,
      isSigner: false,
    });
    const accounts = [
      ...(token2022 ? [readonly(getSplTokenProgramId(tokenUmi))] : []),
      writable(creatorA),
      writable(creatorAtaA),
      writable(creatorB),
      writable(creatorAtaB),
      ...proofAccounts(getCnftProof(umi, item).proof),
    ];
    await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 800_000 }))
      .add(
        settleCnftSaleV2(umi, {
          gumballMachine: machine,
          index: 0,
          authority: umi.identity.publicKey,
          seller: umi.identity.publicKey,
          buyer: umi.identity.publicKey,
          paymentMint: mint.publicKey,
          authorityPdaPaymentAccount: treasury,
          authorityPaymentAccount: findAssociatedTokenPda(tokenUmi, {
            mint: mint.publicKey,
            owner: umi.identity.publicKey,
          })[0],
          sellerPaymentAccount: findAssociatedTokenPda(tokenUmi, {
            mint: mint.publicKey,
            owner: umi.identity.publicKey,
          })[0],
          coreCollection: collection,
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          args: cnftArgs(umi, item),
          currentLeafOwner: item.owner,
          currentLeafDelegate: item.owner,
        }).addRemainingAccounts(accounts)
      )
      .sendAndConfirm(umi);
    t.is((await fetchToken(tokenUmi, creatorAtaA)).amount, 490n);
    t.is((await fetchToken(tokenUmi, creatorAtaB)).amount, 210n);
    t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
  });
}

for (const inherited of [false, true]) {
  test(`unclaimed v2 settlement authenticates royalties and collection; inherited=${inherited}`, async (t) => {
    const umi = await createCnftUmi(createUmi);
    const creator = await generateSignerWithSol(umi, sol(1));
    const collection = await makeCollection(umi, [
      {
        type: 'Royalties',
        basisPoints: 500,
        creators: [{ address: creator.publicKey, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
    ]);
    const substitute = await makeCollection(umi);
    const creators = [
      { address: creator.publicKey, share: 100, verified: false },
    ];
    const item = await mintCnft(umi, {
      collection,
      sellerFeeBasisPoints: inherited ? 65535 : 500,
      creators: inherited ? [] : creators,
    });
    const machine = (
      await create(umi, {
        settings: { itemCapacity: 1, curatorFeeBps: 0 },
        guards: { solPayment: { lamports: sol(1) } },
        disablePrimarySplit: true,
      })
    ).publicKey;
    await entry(umi, machine, item).sendAndConfirm(umi);
    item.owner = findGumballMachineAuthorityPda(umi, {
      gumballMachine: machine,
    })[0];
    const buyer = await beginDraw(umi, machine);
    if (inherited) {
      for (const coreCollection of [null, substitute]) {
        await t.throwsAsync(
          settlement(umi, machine, item, buyer.identity.publicKey, [], {
            coreCollection,
          }).sendAndConfirm(umi),
          { message: /Invalid root recomputed from proof/ }
        );
      }
    } else {
      for (const tampering of [
        { creators: [{ ...creators[0], address: umi.identity.publicKey }] },
        { creators: [] },
        { sellerFeeBasisPoints: 0 },
        { sellerFeeBasisPoints: 65535 },
      ]) {
        await t.throwsAsync(
          settlement(umi, machine, item, buyer.identity.publicKey, creators, {
            args: cnftArgs(umi, item, tampering),
          }).sendAndConfirm(umi),
          { message: /Invalid root recomputed from proof/ }
        );
      }
    }
    const before = (await umi.rpc.getBalance(creator.publicKey)).basisPoints;
    await settlement(
      umi,
      machine,
      item,
      buyer.identity.publicKey,
      creators
    ).sendAndConfirm(umi);
    t.is(
      (await umi.rpc.getBalance(creator.publicKey)).basisPoints - before,
      50_000_000n
    );
    t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
  });
}

test('every v2 escrow exit and request rejects a v1 tree', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const v1 = await mintCnftV1(umi);
  const machine = (
    await create(umi, { settings: { itemCapacity: 2 }, guards: {} })
  ).publicKey;
  const escrow = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const seller = await createCnftUmi(createUmi);
  const requested = await mintCnft(umi, { owner: seller.identity.publicKey });
  const request = (tree: any) =>
    requestAddCnftV2(seller, {
      gumballMachine: machine,
      asset: requested.assetId,
      treeConfig: requested.treeConfig,
      merkleTree: tree,
      leafDelegate: requested.owner,
      args: cnftArgs(umi, requested),
    }).addRemainingAccounts(proofAccounts(getCnftProof(umi, requested).proof));
  await t.throwsAsync(request(v1.merkleTree).sendAndConfirm(seller), {
    message: /Error Number: 6069/,
  });
  await request(requested.merkleTree).sendAndConfirm(seller);
  requested.owner = escrow;
  const cancel = (tree: any) =>
    withRequestCancellationMachine(
      cancelAddCnftRequestV2(seller, {
        asset: requested.assetId,
        authorityPda: escrow,
        treeConfig: requested.treeConfig,
        merkleTree: tree,
        sellerHistory: findSellerHistoryPda(umi, {
          gumballMachine: machine,
          seller: seller.identity.publicKey,
        })[0],
        args: cnftArgs(umi, requested),
      }).addRemainingAccounts(
        proofAccounts(getCnftProof(umi, requested).proof)
      ),
      machine
    );
  await t.throwsAsync(cancel(v1.merkleTree).sendAndConfirm(seller), {
    message: /Error Number: 6069/,
  });
  await cancel(requested.merkleTree).sendAndConfirm(seller);
  const item = await mintCnft(umi);
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = escrow;
  await t.throwsAsync(
    removeCnftV2(umi, {
      gumballMachine: machine,
      index: 0,
      seller: umi.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: v1.merkleTree,
      args: cnftArgs(umi, item),
    }).sendAndConfirm(umi),
    { message: /Error Number: 6069/ }
  );
  await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
  const buyer = await createCnftUmi(createUmi);
  await draw(buyer, { gumballMachine: machine }).sendAndConfirm(buyer);
  const claim = (tree: any) =>
    claimCnftV2(umi, {
      gumballMachine: machine,
      index: 0,
      seller: umi.identity.publicKey,
      buyer: buyer.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: tree,
      args: cnftArgs(umi, item),
    }).addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof));
  await t.throwsAsync(claim(v1.merkleTree).sendAndConfirm(umi), {
    message: /Error Number: 6069/,
  });
  await t.throwsAsync(
    settlement(umi, machine, item, buyer.identity.publicKey, item.creators, {
      merkleTree: v1.merkleTree,
    }).sendAndConfirm(umi),
    { message: /Error Number: 6069/ }
  );
  await claim(item.merkleTree).sendAndConfirm(umi);
  item.owner = buyer.identity.publicKey;
  await t.throwsAsync(
    settlement(umi, machine, item, buyer.identity.publicKey, item.creators, {
      merkleTree: v1.merkleTree,
    }).sendAndConfirm(umi),
    { message: /Error Number: 6069/ }
  );
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 0n);
});

for (const inherited of [false, true]) {
  test(`R18-01: default-owned live v2 leaf settles with royalties; inherited=${inherited}`, async (t) => {
    const umi = await createCnftUmi(createUmi as any);
    const creator = await generateSignerWithSol(umi, sol(1));
    const collection = inherited
      ? await makeCollection(umi, [
          {
            type: 'Royalties',
            basisPoints: 500,
            creators: [{ address: creator.publicKey, percentage: 100 }],
            ruleSet: ruleSet('None'),
          },
        ])
      : undefined;
    const payouts = [
      { address: creator.publicKey, verified: false, share: 100 },
    ];
    const item = await mintCnft(umi, {
      collection,
      sellerFeeBasisPoints: inherited ? 65535 : 500,
      creators: inherited ? [] : payouts,
    });
    const machine = (
      await create(umi, {
        settings: { itemCapacity: 1, curatorFeeBps: 0 },
        guards: { solPayment: { lamports: sol(1) } },
        disablePrimarySplit: true,
      })
    ).publicKey;
    await entry(umi, machine, item).sendAndConfirm(umi);
    item.owner = findGumballMachineAuthorityPda(umi, {
      gumballMachine: machine,
    })[0];
    const buyer = await beginDraw(umi, machine);
    await claimCnftV2(umi, {
      gumballMachine: machine,
      index: 0,
      seller: umi.identity.publicKey,
      buyer: buyer.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      coreCollection: collection,
      args: cnftArgs(umi, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
      .sendAndConfirm(umi);
    item.owner = buyer.identity.publicKey;
    await transferV2(buyer, {
      leafOwner: item.owner,
      merkleTree: item.merkleTree,
      coreCollection: collection,
      newLeafOwner: defaultPublicKey(),
      root: publicKeyBytes(getCnftProof(umi, item).root),
      dataHash: hashMetadataV2(item.metadata),
      creatorHash: hashMetadataCreators(item.creators),
      nonce: item.leafIndex,
      index: item.leafIndex,
      proof: getCnftProof(umi, item).proof,
    }).sendAndConfirm(buyer);
    item.owner = defaultPublicKey();
    item.delegate = defaultPublicKey();
    // Default keys do not prove a burn; an empty-slot signal cannot waive royalties.
    await t.throwsAsync(
      settleCnftSaleV2(umi, {
        gumballMachine: machine,
        index: 0,
        seller: umi.identity.publicKey,
        authority: umi.identity.publicKey,
        buyer: buyer.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item, { flags: 255 }),
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.delegate,
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
        .sendAndConfirm(umi)
    );
    const before = (await umi.rpc.getBalance(creator.publicKey)).basisPoints;
    const sellerBefore = (await umi.rpc.getBalance(umi.identity.publicKey))
      .basisPoints;
    await measureInstruction(
      umi,
      settlement(umi, machine, item, buyer.identity.publicKey, payouts),
      t,
      'settle_cnft_sale_v2'
    );
    t.is(
      (await umi.rpc.getBalance(creator.publicKey)).basisPoints - before,
      50_000_000n
    );
    t.true(
      (await umi.rpc.getBalance(umi.identity.publicKey)).basisPoints -
        sellerBefore >=
        950_000_000n
    );
    t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
    await closeGumballMachine(umi, {
      machine,
      gumballGuard: findGumballGuardPda(umi, { base: machine })[0],
    }).sendAndConfirm(umi);
    t.false((await umi.rpc.getAccount(machine)).exists);
  });

  test(`claimed burnt v2 leaf settles without royalties; inherited=${inherited}`, async (t) => {
    const umi = await createCnftUmi(createUmi);
    const creator = await generateSignerWithSol(umi, sol(1));
    const collection = await makeCollection(umi, [
      {
        type: 'Royalties',
        basisPoints: 500,
        creators: [{ address: creator.publicKey, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
    ]);
    const item = await mintCnft(umi, {
      collection,
      sellerFeeBasisPoints: inherited ? 65535 : 500,
      creators: inherited
        ? []
        : [{ address: creator.publicKey, verified: false, share: 100 }],
    });
    const machine = (
      await create(umi, {
        settings: { itemCapacity: 1, curatorFeeBps: 0 },
        guards: { solPayment: { lamports: sol(1) } },
        disablePrimarySplit: true,
      })
    ).publicKey;
    await entry(umi, machine, item).sendAndConfirm(umi);
    item.owner = findGumballMachineAuthorityPda(umi, {
      gumballMachine: machine,
    })[0];
    const buyer = await beginDraw(umi, machine);
    const empty = defaultPublicKey();
    const emptyProof = getMerkleProof([empty], item.depth, empty, 0);
    const emptyRoot = publicKeyBytes(getMerkleRoot([empty], item.depth));
    const burnSettlement = (overrides: any = {}) =>
      settleCnftSaleV2(umi, {
        gumballMachine: machine,
        index: 0,
        seller: umi.identity.publicKey,
        authority: umi.identity.publicKey,
        buyer: buyer.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        currentLeafOwner: empty,
        currentLeafDelegate: empty,
        coreCollection: null,
        args: cnftArgs(umi, item, { root: emptyRoot, flags: 255 }),
        ...overrides,
      }).addRemainingAccounts(proofAccounts(emptyProof));
    await t.throwsAsync(burnSettlement().sendAndConfirm(umi), {
      message: /Error Number: 6045/,
    });
    await claimCnftV2(umi, {
      gumballMachine: machine,
      index: 0,
      seller: umi.identity.publicKey,
      buyer: buyer.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      coreCollection: collection,
      args: cnftArgs(umi, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
      .sendAndConfirm(umi);
    item.owner = buyer.identity.publicKey;
    // A pre-mint empty root cannot waive royalties on a live leaf.
    await t.throwsAsync(burnSettlement().sendAndConfirm(umi), {
      message:
        /current leaf value does not match the supplied proof's leaf value/,
    });
    await t.throwsAsync(
      burnSettlement({
        args: cnftArgs(umi, item, { index: 1, root: emptyRoot, flags: 255 }),
      }).sendAndConfirm(umi),
      { message: /Error Number: 6070/ }
    );
    await burnV2(buyer, {
      merkleTree: item.merkleTree,
      leafOwner: item.owner,
      coreCollection: collection,
      root: publicKeyBytes(getCnftProof(umi, item).root),
      dataHash: hashMetadataV2(item.metadata),
      creatorHash: hashMetadataCreators(item.creators),
      nonce: 0,
      index: 0,
      proof: getCnftProof(umi, item).proof,
    }).sendAndConfirm(buyer);
    const before = (await umi.rpc.getBalance(creator.publicKey)).basisPoints;
    await t.throwsAsync(
      burnSettlement({
        args: cnftArgs(umi, item, { root: emptyRoot, flags: 0 }),
      }).sendAndConfirm(umi)
    );
    await burnSettlement().sendAndConfirm(umi);
    t.is((await umi.rpc.getBalance(creator.publicKey)).basisPoints, before);
    t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
  });
}

test('all v2 transfers charge their instruction wallet and preserve custody proceeds', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const sponsor = await createCnftUmi(createUmi);
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1, curatorFeeBps: 0 },
      guards: { solPayment: { lamports: sol(1) } },
      disablePrimarySplit: true,
    })
  ).publicKey;
  const escrow = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const sellerHistory = findSellerHistoryPda(umi, {
    gumballMachine: machine,
    seller: umi.identity.publicKey,
  })[0];
  const balance = async (key: any) =>
    (await umi.rpc.getBalance(key)).basisPoints;
  const sum = async (keys: any[]) =>
    (await Promise.all(keys.map(balance))).reduce((a, b) => a + b, 0n);
  let observedFee: bigint | undefined;
  const check = async (
    wallet: any,
    item: any,
    builder: any,
    stateAccounts: any[] = [],
    custodyUnchanged = true
  ) => {
    const keys = [wallet.identity.publicKey, ...stateAccounts];
    const before = await sum(keys);
    const custody = await balance(escrow);
    const treeBefore = await balance(item.treeConfig);
    // A distinct sponsor pays transaction fees, isolating Bubblegum's fee from
    // network fees and accounting for rents in created/closed state accounts.
    await builder.setFeePayer(sponsor.identity).sendAndConfirm(wallet);
    const protocolFee = (await balance(item.treeConfig)) - treeBefore;
    t.true(protocolFee > 0n);
    if (observedFee === undefined) observedFee = protocolFee;
    t.is(protocolFee, observedFee);
    t.is(before - (await sum(keys)), protocolFee);
    if (custodyUnchanged) t.is(await balance(escrow), custody);
  };
  const item = await mintCnft(umi);
  await check(umi, item, entry(umi, machine, item), [sellerHistory]);
  item.owner = escrow;
  await check(
    umi,
    item,
    removeCnftV2(umi, {
      gumballMachine: machine,
      index: 0,
      seller: umi.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      args: cnftArgs(umi, item),
    }).addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof)),
    [sellerHistory]
  );
  item.owner = umi.identity.publicKey;
  const seller = await createCnftUmi(createUmi);
  const requested = await mintCnft(umi, { owner: seller.identity.publicKey });
  const history = findSellerHistoryPda(umi, {
    gumballMachine: machine,
    seller: seller.identity.publicKey,
  })[0];
  const request = findAddItemRequestPda(umi, { asset: requested.assetId })[0];
  await check(
    seller,
    requested,
    requestAddCnftV2(seller, {
      gumballMachine: machine,
      asset: requested.assetId,
      leafDelegate: requested.owner,
      treeConfig: requested.treeConfig,
      merkleTree: requested.merkleTree,
      args: cnftArgs(umi, requested),
    }).addRemainingAccounts(proofAccounts(getCnftProof(umi, requested).proof)),
    [history, request]
  );
  requested.owner = escrow;
  await check(
    seller,
    requested,
    withRequestCancellationMachine(
      cancelAddCnftRequestV2(seller, {
        asset: requested.assetId,
        authorityPda: escrow,
        sellerHistory: history,
        treeConfig: requested.treeConfig,
        merkleTree: requested.merkleTree,
        args: cnftArgs(umi, requested),
      }).addRemainingAccounts(
        proofAccounts(getCnftProof(umi, requested).proof)
      ),
      machine
    ),
    [history, request]
  );
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = escrow;
  await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
  const buyer = await createCnftUmi(createUmi);
  await draw(buyer, {
    gumballMachine: machine,
    mintArgs: { solPayment: some(true) },
  }).sendAndConfirm(buyer);
  const proceedsBefore = await sum([
    umi.identity.publicKey,
    sellerHistory,
    escrow,
  ]);
  const payer = await createCnftUmi(createUmi);
  await check(
    payer,
    item,
    settlement(payer, machine, item, buyer.identity.publicKey, item.creators, {
      authority: umi.identity.publicKey,
      seller: umi.identity.publicKey,
    }),
    [],
    false
  );
  t.is(
    await sum([umi.identity.publicKey, sellerHistory, escrow]),
    proceedsBefore
  );
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
  t.log(
    `Measured fee for add/request/cancel/remove/settle: ${observedFee} lamports`
  );
});

test('v2 entry and request inspect permanent delegates without loading 40 KB Attributes or 256 adapters', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const seller = await createCnftUmi(createUmi);
  const collection = await makeCollection(umi, [
    { type: 'PermanentTransferDelegate' },
  ]);
  const item = await mintCnft(umi, { collection });
  const requested = await mintCnft(umi, {
    collection,
    owner: seller.identity.publicKey,
  });
  const machine = (await create(umi, { settings: { itemCapacity: 1 } }))
    .publicKey;
  addLargeCollectionAttributes(collection);
  addCollectionExternalAdapters(umi, collection, 256);
  await t.throwsAsync(entry(umi, machine, item).sendAndConfirm(umi), {
    message: /Error Number: 6053/,
  });
  await t.throwsAsync(
    requestAddCnftV2(seller, {
      gumballMachine: machine,
      asset: requested.assetId,
      leafDelegate: requested.owner,
      treeConfig: requested.treeConfig,
      merkleTree: requested.merkleTree,
      coreCollection: collection,
      args: cnftArgs(umi, requested),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(umi, requested).proof))
      .sendAndConfirm(seller),
    { message: /Error Number: 6053/ }
  );
  t.is((await fetchGumballMachine(umi, machine)).itemsLoaded, 0);
  t.falsy(
    await safeFetchAddItemRequestFromSeeds(umi, { asset: requested.assetId })
  );
});

test('claimed inherited settlement ignores 256 external adapters with constant CU', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const collection = await makeCollection(umi, [
    {
      type: 'Royalties',
      basisPoints: 700,
      creators: [{ address: umi.identity.publicKey, percentage: 100 }],
      ruleSet: ruleSet('None'),
    },
  ]);
  const item = await mintCnft(umi, {
    collection,
    sellerFeeBasisPoints: 65535,
    creators: [],
  });
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1 },
      guards: { solPayment: { lamports: sol(1) } },
    })
  ).publicKey;
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const buyer = await beginDraw(umi, machine);
  await claimCnftV2(umi, {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    buyer: buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    coreCollection: collection,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(umi);
  item.owner = buyer.identity.publicKey;
  const settle = () =>
    settlement(umi, machine, item, buyer.identity.publicKey, [
      { address: umi.identity.publicKey, verified: false, share: 100 },
    ]);
  const before = await umi.rpc.simulateTransaction(
    await settle().buildAndSign(umi)
  );
  t.is(before.err, null);
  addCollectionExternalAdapters(umi, collection, 256);
  const after = await umi.rpc.simulateTransaction(
    await settle().buildAndSign(umi)
  );
  t.is(after.err, null);
  t.is(after.unitsConsumed, before.unitsConsumed);
  await settle().sendAndConfirm(umi);
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
});

test('v2 entry and claimed settle reject a non-Core collection with error 6073', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1 },
      guards: { solPayment: { lamports: sol(1) } },
    })
  ).publicKey;
  await t.throwsAsync(
    entry(umi, machine, item, {
      coreCollection: umi.identity.publicKey,
    }).sendAndConfirm(umi),
    { message: /Error Number: 6073/ }
  );
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const buyer = await beginDraw(umi, machine);
  await claimCnftV2(umi, {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    buyer: buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(umi);
  item.owner = buyer.identity.publicKey;
  await t.throwsAsync(
    settlement(umi, machine, item, buyer.identity.publicKey, item.creators, {
      coreCollection: umi.identity.publicKey,
    }).sendAndConfirm(umi),
    { message: /Error Number: 6073/ }
  );
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 0n);
});

test('claimed v2 leaf frozen by its buyer still settles with authenticated flags', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const machine = (
    await create(umi, {
      settings: { itemCapacity: 1 },
      guards: { solPayment: { lamports: sol(1) } },
    })
  ).publicKey;
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const buyer = await beginDraw(umi, machine);
  await claimCnftV2(umi, {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    buyer: buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(umi);
  item.owner = buyer.identity.publicKey;
  await freezeV2(buyer, {
    merkleTree: item.merkleTree,
    leafOwner: item.owner,
    leafDelegate: item.owner,
    root: publicKeyBytes(getCnftProof(umi, item).root),
    dataHash: hashMetadataV2(item.metadata),
    creatorHash: hashMetadataCreators(item.creators),
    nonce: 0,
    index: 0,
    proof: getCnftProof(umi, item).proof,
  }).sendAndConfirm(buyer);
  item.flags = 1;
  await t.throwsAsync(
    settlement(umi, machine, item, item.owner, item.creators, {
      args: cnftArgs(umi, item, { flags: 0 }),
    }).sendAndConfirm(umi),
    {
      message: /Invalid root recomputed from proof/,
    }
  );
  await settlement(
    umi,
    machine,
    item,
    item.owner,
    item.creators
  ).sendAndConfirm(umi);
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 1n);
});

test('all v1 requests and exits reject an MPL-compression tree with error 6069', async (t) => {
  const umi = await createCnftUmi(createUmi);
  const item = await mintCnft(umi);
  const machine = (
    await create(umi, { settings: { itemCapacity: 2 }, guards: {} })
  ).publicKey;
  const escrow = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const seller = await createCnftUmi(createUmi);
  const requested = await mintCnft(umi, { owner: seller.identity.publicKey });
  const requestInput = {
    gumballMachine: machine,
    asset: requested.assetId,
    treeConfig: requested.treeConfig,
    merkleTree: requested.merkleTree,
    args: cnftArgs(umi, requested, { version: 1 }),
  };
  // Use the v1 defaults so tree ownership rejects before the transfer CPI.
  await t.throwsAsync(
    requestAddCnftV1(seller, requestInput).sendAndConfirm(seller),
    { message: /Error Number: 6069/ }
  );
  await requestAddCnftV2(seller, {
    ...requestInput,
    leafDelegate: requested.owner,
    args: cnftArgs(umi, requested),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, requested).proof))
    .sendAndConfirm(seller);
  requested.owner = escrow;
  await t.throwsAsync(
    withRequestCancellationMachine(
      cancelAddCnftRequestV1(seller, {
        ...requestInput,
        authorityPda: escrow,
        sellerHistory: findSellerHistoryPda(umi, {
          gumballMachine: machine,
          seller: seller.identity.publicKey,
        })[0],
        args: cnftArgs(umi, requested, { version: 1 }),
      }),
      machine
    ).sendAndConfirm(seller),
    { message: /Error Number: 6069/ }
  );
  await withRequestCancellationMachine(
    cancelAddCnftRequestV2(seller, {
      ...requestInput,
      authorityPda: escrow,
      sellerHistory: findSellerHistoryPda(umi, {
        gumballMachine: machine,
        seller: seller.identity.publicKey,
      })[0],
      args: cnftArgs(umi, requested),
    }).addRemainingAccounts(proofAccounts(getCnftProof(umi, requested).proof)),
    machine
  ).sendAndConfirm(seller);
  await entry(umi, machine, item).sendAndConfirm(umi);
  item.owner = escrow;
  const base = {
    gumballMachine: machine,
    index: 0,
    seller: umi.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: cnftArgs(umi, item, { version: 1 }),
  };
  await t.throwsAsync(removeCnftV1(umi, base).sendAndConfirm(umi), {
    message: /Error Number: 6069/,
  });
  await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
  const buyer = await createCnftUmi(createUmi);
  await draw(buyer, { gumballMachine: machine }).sendAndConfirm(buyer);
  await t.throwsAsync(
    claimCnftV1(umi, {
      ...base,
      buyer: buyer.identity.publicKey,
    }).sendAndConfirm(umi),
    { message: /Error Number: 6069/ }
  );
  const settle = () =>
    settleCnftSaleV1(umi, {
      ...base,
      buyer: buyer.identity.publicKey,
      authority: umi.identity.publicKey,
      currentLeafOwner: item.owner,
      currentLeafDelegate: item.owner,
    });
  await t.throwsAsync(settle().sendAndConfirm(umi), {
    message: /Error Number: 6069/,
  });
  await claimCnftV2(umi, {
    ...base,
    buyer: buyer.identity.publicKey,
    args: cnftArgs(umi, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
    .sendAndConfirm(umi);
  item.owner = buyer.identity.publicKey;
  await t.throwsAsync(settle().sendAndConfirm(umi), {
    message: /Error Number: 6069/,
  });
  t.is((await fetchGumballMachine(umi, machine)).itemsSettled, 0n);
});
