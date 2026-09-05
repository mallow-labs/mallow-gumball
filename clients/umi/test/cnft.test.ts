/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  addAmounts,
  defaultPublicKey,
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
  endSale,
  fetchAddItemRequestFromSeeds,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  GumballMachine,
  removeCnft,
  requestAddCnft,
  safeFetchAddItemRequestFromSeeds,
  safeFetchSellerHistory,
  settleCnftSale,
  startSale,
  TokenStandard,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
  settleRemainingAccounts,
} from './_cnftSetup';
import {
  assertItemBought as assertItemDrawn,
  create,
  createUmi,
} from './_setup';

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
  // Creators/sfbp args are bound to the asset via a VerifyLeaf CPI on the
  // CURRENT leaf, so root/proof must be post-claim and the buyer is the owner.
  const { proof: settleProof } = getCnftProof(umi, item);
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
test('it cannot settle an already-claimed cnft sale with forged creators', async (t) => {
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

  // Forged settle: attacker as sole creator. Root/proof/owner are all CURRENT
  // and honest — only creators (folded into creator_hash) lie, so the
  // reconstructed leaf doesn't match the tree and VerifyLeaf fails.
  const attacker = generateSigner(umi);
  const forged = [{ address: attacker.publicKey, verified: false, share: 100 }];
  const { proof: settleProof } = getCnftProof(umi, item);
  const promise = transactionBuilder()
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
        args: cnftArgs(umi, item, { creators: forged }),
        currentLeafOwner: buyerUmi.identity.publicKey,
        currentLeafDelegate: buyerUmi.identity.publicKey,
      }).addRemainingAccounts(settleRemainingAccounts(forged, settleProof))
    )
    .sendAndConfirm(umi);

  // spl-account-compression rejects the leaf verification.
  await t.throwsAsync(promise);

  // The sale stayed unsettled — the attacker took nothing.
  const account = await fetchGumballMachine(umi, gumballMachine);
  t.like(account, <Partial<GumballMachine>>{
    items: [{ index: 0, isClaimed: true, isSettled: false }],
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
      cancelAddCnftRequest(sellerUmi, {
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

// The settle remaining-accounts layout is `[creator payouts..., proof nodes...]`,
// split by `creators.len()`. With a single creator (the other settle tests) a
// mis-count is invisible: the whole tail is proof either way. Two creators with
// unequal shares proves the split point AND the per-creator distribution: each
// wallet must receive its share of the royalty and the proof must still verify.
test('it settles a cnft sale splitting royalties across multiple creators', async (t) => {
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
      settleCnftSale(umi, {
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
      settleCnftSale(umi, {
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
test('it settles a cnft sale paying a marketplace fee', async (t) => {
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
      settleCnftSale(umi, {
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
test('it can settle a cnft sale as an unrelated third party', async (t) => {
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
      settleCnftSale(thirdPartyUmi, {
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
test('it settles a cnft sale where the buyer is the seller', async (t) => {
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
      settleCnftSale(umi, {
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
      claimCnft(umi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
      }).addRemainingAccounts(proofAccounts(proof))
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /InvalidBuyer/ });
});
