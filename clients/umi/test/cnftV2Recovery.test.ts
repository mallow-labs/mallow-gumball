import { withRequestCancellationMachine } from '../src';
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import {
  burnV2,
  closeTreeV2,
  createTree,
  createTreeV2,
  freezeV2,
  getMerkleProof,
  getMerkleRoot,
  getMetadataArgsV2Serializer,
  hash,
  hashAssetData,
  hashCollection,
  hashMetadataCreators,
  hashMetadataV2,
  setCollectionV2,
  thawV2,
  transferV2,
} from '@metaplex-foundation/mpl-bubblegum';
import { createCollection } from '@metaplex-foundation/mpl-core';
import {
  createAccount,
  createEmptyLut,
  createLutForTransactionBuilder,
  extendLut,
  fetchToken,
  findAssociatedTokenPda,
  getSplTokenProgramId,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  defaultPublicKey,
  generateSigner,
  PublicKey,
  publicKey,
  publicKeyBytes,
  signerIdentity,
  sol,
  some,
} from '@metaplex-foundation/umi';
import { toWeb3JsTransaction } from '@metaplex-foundation/umi-web3js-adapters';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import {
  addCnft,
  addCnftV2,
  addTokens,
  adminRefundCnftSaleV2,
  approveAddItem,
  cancelAddCnftRequestV2,
  claimCnft,
  claimCnftV2,
  claimTokens,
  closeGumballMachine,
  closeMissingCnftRecoveryV2,
  draw,
  drawFromGumballMachine,
  endSale,
  fetchCnftRecovery,
  fetchGumballMachine,
  findCnftRecoveryPda,
  findGlobalConfigPda,
  findGumballGuardPda,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getGumballMachineSizeForItemCount,
  getMerkleProof as getSellerMerkleProof,
  getMerkleRoot as getSellerMerkleRoot,
  GumballState,
  incrementTotalRevenue,
  prepareAdminCloseMissingCnftRecoveryV2,
  prepareAdminRefundCnftSaleV2,
  prepareAdminSettleMissingCnftSaleV2,
  reclaimCnftV2,
  refundCnftSaleV2,
  removeCnftV2,
  requestAddCnftV2,
  setGumballMachineAuthority,
  setMintAuthority,
  settleCnftSaleV2,
  settleTokensSaleClaimed,
  startSale,
  unwrap,
  updateSettings,
  withdrawPayout,
} from '../src';
import {
  cnftArgs as cnftV1Args,
  getCnftProof as getCnftV1Proof,
  mintCnft as mintCnftV1,
} from './_cnftSetup';
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
import {
  disableMemo,
  measureInstruction,
  reassignTokenOwner,
  requireMemo,
} from './_round13Token';
import {
  create,
  createMintWithHolders,
  createUmi,
  getTestAuthority,
  setupGlobalConfig,
} from './_setup';
import { getSvm } from './litesvm/svm';

const evidence = (item: any) => ({
  owner: item.owner,
  delegate: item.delegate ?? item.owner,
  dataHash: hashMetadataV2(item.metadata),
  creatorHash: hashMetadataCreators(item.creators),
  collectionHash: hashCollection(item.collection ?? defaultPublicKey()),
  assetDataHash: hashAssetData(item.assetData),
  flags: item.flags,
});
const mutationArgs = (umi: any, item: any) => ({
  merkleTree: item.merkleTree,
  leafOwner: item.owner,
  leafDelegate: item.delegate ?? item.owner,
  coreCollection: item.collection,
  root: publicKeyBytes(getCnftProof(umi, item).root),
  dataHash: hashMetadataV2(item.metadata),
  creatorHash: hashMetadataCreators(item.creators),
  flags: some(item.flags),
  nonce: item.leafIndex,
  index: item.leafIndex,
  proof: getCnftProof(umi, item).proof,
});
const emptyProof = (item: any) => {
  const empty = defaultPublicKey();
  return {
    root: publicKeyBytes(getMerkleRoot([empty], item.depth)),
    proof: getMerkleProof([empty], item.depth, empty, item.leafIndex).slice(
      0,
      item.depth - item.canopyDepth
    ),
  };
};
const setPermanentCollection = async (
  umi: any,
  item: any,
  type: string,
  frozen = false
) => {
  const collection = generateSigner(umi);
  await createCollection(umi, {
    collection,
    name: 'Recovery fixture',
    uri: '',
    plugins: [
      { type: 'BubblegumV2' },
      {
        type,
        ...(type === 'PermanentFreezeDelegate' ? { frozen } : {}),
      } as any,
    ],
  }).sendAndConfirm(umi);
  await setCollectionV2(umi, {
    ...mutationArgs(umi, item),
    metadata: item.metadata,
    newCoreCollection: collection.publicKey,
  }).sendAndConfirm(umi);
  item.collection = collection.publicKey;
  item.metadata = { ...item.metadata, collection: some(collection.publicKey) };
  item.metaHash = hash(getMetadataArgsV2Serializer().serialize(item.metadata));
};
let marketplaceSetup: Promise<void> | undefined;
const fixture = async (
  payment = 'sol',
  sold = true,
  capacity = 1,
  depth = 5,
  options: {
    feeBps?: number;
    curatorFeeBps?: number;
    version?: number;
    skipAdd?: boolean;
    leafIndex?: number;
    canopyDepth?: number;
    maxBufferSize?: number;
    groups?: any[];
  } = {}
) => {
  const umi = await createCnftUmi(createUmi);
  const marketplace = await createCnftUmi(createUmi);
  marketplace.use(signerIdentity(getTestAuthority(umi)));
  marketplaceSetup ??= setupGlobalConfig(umi, marketplace.identity);
  await marketplaceSetup;
  const globalConfig = findGlobalConfigPda(umi)[0];
  const buyer = await createCnftUmi(createUmi);
  const caller = await createCnftUmi(createUmi);
  const machineSigner = generateSigner(umi);
  const machine = machineSigner.publicKey;
  const escrow = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const programs = umi.programs.clone();
  if (payment === 'token2022') programs.bind('splToken', 'splToken2022');
  const tokenUmi = { ...umi, programs };
  const price = payment === 'sol' ? 1_000_000_000n : 10_000n;
  let mint: any;
  let treasury: any;
  let buyerAta: any;
  let feeAta: any;
  const feeAccount = generateSigner(umi).publicKey;
  if (payment !== 'sol') {
    [mint, buyerAta, treasury, feeAta] = await createMintWithHolders(tokenUmi, {
      decimals: 0,
      holders: [
        { owner: buyer.identity, amount: Number(price) * capacity },
        { owner: escrow, amount: 0 },
        { owner: feeAccount, amount: 0 },
      ],
    });
  }
  const guard = mint
    ? { mint: mint.publicKey, destinationAta: treasury, amount: Number(price) }
    : undefined;
  await create(umi, {
    gumballMachine: machineSigner,
    settings: {
      itemCapacity: capacity,
      curatorFeeBps: options.curatorFeeBps ?? 0,
      ...(mint ? { paymentMint: mint.publicKey } : {}),
    },
    guards:
      payment === 'sol'
        ? { solPayment: { lamports: sol(1) } }
        : payment === 'spl'
          ? { tokenPayment: some(guard!) }
          : { token2022Payment: some(guard!) },
    ...(options.feeBps
      ? { feeConfig: { feeAccount, feeBps: options.feeBps } }
      : {}),
    ...(options.groups ? { groups: options.groups } : {}),
    disablePrimarySplit: true,
  });
  if (options.version !== undefined) {
    const key = publicKeyBytes(machine);
    const account = getSvm().getAccount(key)!;
    const data = account.data();
    data[8] = options.version;
    getSvm().setAccount(
      key,
      new Account(account.lamports(), data, account.owner(), false, 0n)
    );
  }
  let item = await mintCnft(umi, {
    depth,
    canopyDepth: options.canopyDepth,
    maxBufferSize: options.maxBufferSize,
  });
  for (
    let leafIndex = 1;
    leafIndex <= (options.leafIndex ?? 0);
    leafIndex += 1
  ) {
    await burnV2(umi, mutationArgs(umi, item)).sendAndConfirm(umi);
    item = await mintCnft(umi, {
      depth,
      canopyDepth: options.canopyDepth,
      merkleTree: item.merkleTreeSigner,
      leafIndex,
    });
  }
  const add = async (asset: any) => {
    await addCnftV2(umi, {
      gumballMachine: machine,
      treeConfig: asset.treeConfig,
      merkleTree: asset.merkleTree,
      coreCollection: asset.collection,
      leafDelegate: asset.owner,
      args: cnftArgs(umi, asset),
      addItemArgs: {},
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(umi, asset).proof))
      .sendAndConfirm(umi);
    asset.owner = escrow;
  };
  if (!options.skipAdd) await add(item);
  const drawItem = (group?: string) =>
    draw(buyer, {
      gumballMachine: machine,
      ...(group ? { group } : {}),
      mintArgs:
        payment === 'sol'
          ? {
              solPayment: some({
                feeAccounts: options.feeBps ? [feeAccount] : [],
              }),
            }
          : payment === 'spl'
            ? {
                tokenPayment: some({
                  mint: mint.publicKey,
                  destinationAta: treasury,
                  feeAccounts: options.feeBps ? [feeAccount] : [],
                  feeAccount: options.feeBps ? feeAccount : undefined,
                }),
              }
            : {
                token2022Payment: some({
                  mint: mint.publicKey,
                  destinationAta: treasury,
                  feeAccounts: options.feeBps ? [feeAccount] : [],
                  feeAccount: options.feeBps ? feeAccount : undefined,
                }),
              },
    }).sendAndConfirm(buyer);
  if (capacity === 1 && !options.skipAdd) {
    await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
    if (sold) await drawItem();
    else await endSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
  }
  const recovery = findCnftRecoveryPda(umi, {
    gumballMachine: machine,
    merkleTree: item.merkleTree,
    nonce: item.leafIndex,
  })[0];
  const refund = (
    leaf: any = evidence(item),
    root = publicKeyBytes(getCnftProof(umi, item).root),
    proof = getCnftProof(umi, item).proof,
    overrides: any = {}
  ) =>
    refundCnftSaleV2(caller, {
      gumballMachine: machine,
      index: 0,
      nonce: item.leafIndex,
      root,
      leaf,
      seller: umi.identity.publicKey,
      buyer: sold ? buyer.identity.publicKey : null,
      merkleTree: item.merkleTree,
      ...(mint
        ? {
            paymentMint: mint.publicKey,
            authorityPdaPaymentAccount: treasury,
            buyerPaymentAccount: buyerAta,
            tokenProgram: getSplTokenProgramId(tokenUmi),
          }
        : {}),
      ...overrides,
    }).addRemainingAccounts(proofAccounts(proof));
  const adminRefund = (
    leaf: any = evidence(item),
    root = publicKeyBytes(getCnftProof(umi, item).root),
    proof = getCnftProof(umi, item).proof,
    overrides: any = {},
    authority = marketplace.identity
  ) =>
    adminRefundCnftSaleV2(caller, {
      gumballMachine: machine,
      index: 0,
      nonce: item.leafIndex,
      root,
      leaf,
      seller: umi.identity.publicKey,
      buyer: sold ? buyer.identity.publicKey : null,
      merkleTree: item.merkleTree,
      ...(mint
        ? {
            paymentMint: mint.publicKey,
            authorityPdaPaymentAccount: treasury,
            buyerPaymentAccount: buyerAta,
            tokenProgram: getSplTokenProgramId(tokenUmi),
          }
        : {}),
      ...overrides,
    }).addRemainingAccounts([
      { signer: authority, isWritable: false },
      { pubkey: globalConfig, isSigner: false, isWritable: false },
      ...proofAccounts(proof),
    ]);
  const close = () =>
    closeGumballMachine(umi, {
      machine,
      gumballGuard: findGumballGuardPda(umi, { base: machine })[0],
      ...(mint
        ? {
            paymentMint: mint.publicKey,
            paymentTokenProgram: getSplTokenProgramId(tokenUmi),
            authorityPdaPaymentAccount: treasury,
          }
        : {}),
    }).sendAndConfirm(umi);
  const balance = async () =>
    mint
      ? (await fetchToken(tokenUmi, buyerAta)).amount
      : (await buyer.rpc.getBalance(buyer.identity.publicKey)).basisPoints;
  const reclaim = (admin = marketplace, overrides: any = {}) =>
    reclaimCnftV2(admin, {
      recovery,
      gumballMachine: machine,
      authorityPda: escrow,
      seller: umi.identity.publicKey,
      rentPayer: caller.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      coreCollection: item.collection,
      args: cnftArgs(umi, item),
      ...overrides,
    }).addRemainingAccounts([
      { pubkey: globalConfig, isSigner: false, isWritable: false },
      ...proofAccounts(getCnftProof(umi, item).proof),
    ]);
  return {
    marketplace,
    globalConfig,
    umi,
    buyer,
    caller,
    machine,
    machineSigner,
    escrow,
    item,
    recovery,
    refund,
    adminRefund,
    reclaim,
    close,
    balance,
    price,
    add,
    drawItem,
    mint,
    treasury,
    tokenUmi,
    feeAccount,
    feeAta,
    buyerAta,
  };
};

const settle = (
  f: any,
  item: any,
  index: number,
  buyer: PublicKey = defaultPublicKey(),
  authority = f.umi.identity.publicKey,
  seller = f.umi.identity.publicKey
) =>
  settleCnftSaleV2(f.caller, {
    gumballMachine: f.machine,
    index,
    seller,
    authority,
    buyer,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    coreCollection: item.collection,
    args: cnftArgs(f.umi, item),
    currentLeafOwner: item.owner,
    currentLeafDelegate: item.delegate ?? item.owner,
    feeAccount: f.feeAccount,
    ...(f.mint
      ? {
          paymentMint: f.mint.publicKey,
          authorityPdaPaymentAccount: f.treasury,
          sellerPaymentAccount: findAssociatedTokenPda(f.tokenUmi, {
            mint: f.mint.publicKey,
            owner: seller,
            tokenProgramId: getSplTokenProgramId(f.tokenUmi),
          })[0],
          authorityPaymentAccount: findAssociatedTokenPda(f.tokenUmi, {
            mint: f.mint.publicKey,
            owner: authority,
            tokenProgramId: getSplTokenProgramId(f.tokenUmi),
          })[0],
          feePaymentAccount: f.feeAta,
        }
      : {}),
  }).addRemainingAccounts([
    ...(f.mint &&
    getSplTokenProgramId(f.tokenUmi) !== getSplTokenProgramId(f.umi)
      ? [
          {
            pubkey: getSplTokenProgramId(f.tokenUmi),
            isSigner: false,
            isWritable: false,
          },
        ]
      : []),
    ...item.creators.flatMap((creator: any) => [
      { pubkey: creator.address, isSigner: false, isWritable: true },
      ...(f.mint
        ? [
            {
              pubkey: findAssociatedTokenPda(f.tokenUmi, {
                mint: f.mint.publicKey,
                owner: creator.address,
                tokenProgramId: getSplTokenProgramId(f.tokenUmi),
              })[0],
              isSigner: false,
              isWritable: true,
            },
          ]
        : []),
    ]),
    ...proofAccounts(getCnftProof(f.umi, item).proof),
  ]);
const settleRecovered = (
  f: any,
  item: any,
  index: number,
  burnt = false,
  seller = f.umi.identity.publicKey,
  buyer = defaultPublicKey(),
  closed = false,
  overrides: any = {}
) => {
  const proof = burnt
    ? closed
      ? { root: new Uint8Array(32), proof: [] }
      : emptyProof(item)
    : getCnftProof(f.umi, item);
  return settleCnftSaleV2(f.caller, {
    gumballMachine: f.machine,
    index,
    seller,
    authority: f.umi.identity.publicKey,
    buyer,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    coreCollection: item.collection,
    args: {
      ...cnftArgs(f.umi, item),
      root: burnt ? proof.root : publicKeyBytes(proof.root),
      flags: burnt ? 255 : item.flags,
      ...overrides,
    },
    currentLeafOwner: burnt ? defaultPublicKey() : item.owner,
    currentLeafDelegate: burnt
      ? defaultPublicKey()
      : (item.delegate ?? item.owner),
    feeAccount: f.feeAccount,
  }).addRemainingAccounts(
    settleRemainingAccounts(burnt ? [] : item.creators, proof.proof)
  );
};
const historyRent = (f: any) =>
  getSvm()
    .getAccount(
      publicKeyBytes(
        findSellerHistoryPda(f.umi, {
          gumballMachine: f.machine,
          seller: f.umi.identity.publicKey,
        })[0]
      )
    )!
    .lamports();
const lamports = async (
  umi: any,
  wallet = umi.identity.publicKey
): Promise<bigint> => (await umi.rpc.getBalance(wallet)).basisPoints;

for (const kind of ['burnt', 'moved', 'flagged']) {
  test(`permissionless refund of a drawn ${kind} v2 item releases the machine`, async (t) => {
    const f = await fixture();
    await t.throwsAsync(f.close(), { message: /Error Number: 6047/ });
    await setPermanentCollection(
      f.umi,
      f.item,
      kind === 'burnt'
        ? 'PermanentBurnDelegate'
        : kind === 'moved'
          ? 'PermanentTransferDelegate'
          : 'PermanentFreezeDelegate'
    );
    let leaf: any;
    let root: Uint8Array;
    let proof: any[];
    if (kind === 'burnt') {
      await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
      ({ root, proof } = emptyProof(f.item));
      leaf = null;
    } else {
      if (kind === 'moved') {
        await transferV2(f.umi, {
          ...mutationArgs(f.umi, f.item),
          newLeafOwner: f.caller.identity.publicKey,
        }).sendAndConfirm(f.umi);
        f.item.owner = f.caller.identity.publicKey;
      } else {
        await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(
          f.umi
        );
        f.item.flags = 2;
      }
      root = publicKeyBytes(getCnftProof(f.umi, f.item).root);
      proof = getCnftProof(f.umi, f.item).proof;
      leaf = evidence(f.item);
    }
    const before = await f.balance();
    const builder = f.refund(leaf, root, proof);
    const tx = await builder.buildAndSign(f.caller);
    const sim = await f.caller.rpc.simulateTransaction(tx);
    t.is(sim.err, null);
    t.true(sim.unitsConsumed! < 100_000);
    t.true(toWeb3JsTransaction(tx).serialize().length <= 1232);
    t.log(
      `${kind} refund: ${sim.unitsConsumed} CU, ${toWeb3JsTransaction(tx).serialize().length} bytes`
    );
    await builder.sendAndConfirm(f.caller);
    t.is((await f.balance()) - before, f.price);
    const machine = await fetchGumballMachine(f.umi, f.machine);
    t.is(machine.itemsSettled, 1n);
    t.true(machine.items[0].isClaimed);
    t.true(machine.items[0].isSettled);
    t.false(
      await f.umi.rpc.accountExists(
        findSellerHistoryPda(f.umi, {
          gumballMachine: f.machine,
          seller: f.umi.identity.publicKey,
        })[0]
      )
    );
    t.is(await f.umi.rpc.accountExists(f.recovery), kind === 'flagged');
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
    if (kind === 'flagged') {
      const receipt = await fetchCnftRecovery(f.umi, f.recovery);
      t.is(receipt.seller, f.umi.identity.publicKey);
      await t.throwsAsync(f.reclaim(f.caller).sendAndConfirm(f.caller), {
        message: /Error Number: 6037/,
      });
      await t.throwsAsync(
        f
          .reclaim(f.marketplace, { seller: f.buyer.identity.publicKey })
          .sendAndConfirm(f.umi),
        { message: /Error Number: 2001/ }
      );
      await t.throwsAsync(
        f
          .reclaim(f.marketplace, { merkleTree: f.buyer.identity.publicKey })
          .sendAndConfirm(f.umi),
        {
          message: /Error Number: 2001/,
        }
      );
      await t.throwsAsync(
        f
          .reclaim(f.marketplace, {
            args: { ...cnftArgs(f.umi, f.item), nonce: 1 },
          })
          .sendAndConfirm(f.umi),
        {
          message: /Error Number: 6070/,
        }
      );
      await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
      f.item.flags = 0;
      const reclaim = f.reclaim();
      const reclaimTx = await reclaim.buildAndSign(f.umi);
      const reclaimSim = await f.umi.rpc.simulateTransaction(reclaimTx);
      t.is(reclaimSim.err, null);
      t.true(reclaimSim.unitsConsumed! < 150_000);
      t.log(
        `reclaim: ${reclaimSim.unitsConsumed} CU, ${toWeb3JsTransaction(reclaimTx).serialize().length} bytes`
      );
      await reclaim.sendAndConfirm(f.umi);
      f.item.owner = f.umi.identity.publicKey;
      t.false(await f.umi.rpc.accountExists(f.recovery));
      // The seller's own signature can now transfer the recovered leaf.
      await transferV2(f.umi, {
        ...mutationArgs(f.umi, f.item),
        newLeafOwner: f.buyer.identity.publicKey,
      }).sendAndConfirm(f.umi);
    }
  });
}

for (const payment of ['spl', 'token2022']) {
  test(`undeliverable v2 item refunds ${payment} proceeds to the recorded buyer`, async (t) => {
    const f = await fixture(payment);
    await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    const empty = emptyProof(f.item);
    const before = await f.balance();
    await f.refund(null, empty.root, empty.proof).sendAndConfirm(f.caller);
    t.is((await f.balance()) - before, f.price);
    t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
  });
}

for (const kind of ['burnt', 'flagged']) {
  test(`unsold ${kind} v2 item settles without a buyer refund`, async (t) => {
    const f = await fixture('sol', false);
    await setPermanentCollection(
      f.umi,
      f.item,
      kind === 'burnt' ? 'PermanentBurnDelegate' : 'PermanentFreezeDelegate'
    );
    const before = await f.balance();
    if (kind === 'burnt') {
      await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
      const empty = emptyProof(f.item);
      await f
        .refund(null, empty.root, empty.proof, { payer: f.umi.identity })
        .sendAndConfirm(f.caller);
    } else {
      await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
      f.item.flags = 2;
      await f
        .refund(undefined, undefined, undefined, { payer: f.umi.identity })
        .sendAndConfirm(f.caller);
    }
    t.is(await f.balance(), before);
    t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
    await settleRecovered(f, f.item, 0, kind === 'burnt').sendAndConfirm(
      f.caller
    );
    t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
  });
}

test('refund rejects deliverable, fabricated, stale and substituted evidence, and cannot repeat', async (t) => {
  const f = await fixture();
  await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
    message: /Error Number: 6074/,
  });
  await t.throwsAsync(
    f.refund({ ...evidence(f.item), flags: 2 }).sendAndConfirm(f.caller),
    { message: /Invalid root recomputed from proof/ }
  );
  const empty = emptyProof(f.item);
  await t.throwsAsync(
    f.refund(null, empty.root, empty.proof).sendAndConfirm(f.caller),
    { message: /Error Number: 6075/ }
  );
  await t.throwsAsync(
    f
      .refund(
        null,
        publicKeyBytes(getCnftProof(f.umi, f.item).root),
        empty.proof
      )
      .sendAndConfirm(f.caller),
    { message: /Invalid root recomputed from proof/ }
  );
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  const oldLeaf = evidence(f.item);
  const oldRoot = publicKeyBytes(getCnftProof(f.umi, f.item).root);
  const oldProof = getCnftProof(f.umi, f.item).proof;
  await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 0;
  await t.throwsAsync(
    f.refund(oldLeaf, oldRoot, oldProof).sendAndConfirm(f.caller),
    { message: /Error Number: 6075/ }
  );
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  await t.throwsAsync(
    f
      .refund(undefined, undefined, undefined, {
        buyer: f.caller.identity.publicKey,
      })
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6042/ }
  );
  await t.throwsAsync(
    f
      .refund(undefined, undefined, undefined, {
        seller: f.caller.identity.publicKey,
        sellerHistory: findSellerHistoryPda(f.umi, {
          gumballMachine: f.machine,
          seller: f.umi.identity.publicKey,
        })[0],
      })
      .sendAndConfirm(f.caller),
    { message: /Error Number: 2006/ }
  );
  await t.throwsAsync(
    f
      .refund(undefined, undefined, undefined, { nonce: 1 })
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6039/ }
  );
  await t.throwsAsync(
    f
      .refund(undefined, undefined, undefined, { buyer: null })
      .sendAndConfirm(f.caller),
    {
      message: /Error Number: 6042/,
    }
  );
  await f.refund().sendAndConfirm(f.caller);
  const after = await f.balance();
  await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
    message: /Error Number: 3012/,
  });
  t.is(await f.balance(), after);
});

test('delivered v2 item cannot be refunded if the buyer later freezes it', async (t) => {
  const f = await fixture();
  await claimCnftV2(f.umi, {
    gumballMachine: f.machine,
    index: 0,
    seller: f.umi.identity.publicKey,
    buyer: f.buyer.identity.publicKey,
    treeConfig: f.item.treeConfig,
    merkleTree: f.item.merkleTree,
    args: cnftArgs(f.umi, f.item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(f.umi, f.item).proof))
    .sendAndConfirm(f.umi);
  f.item.owner = f.buyer.identity.publicKey;
  await freezeV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(
    f.buyer
  );
  f.item.flags = 1;
  const before = await f.balance();
  await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
    message: /Error Number: 6049/,
  });
  t.is(await f.balance(), before);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
});

test('a refunded receipt can only close with current proof that the asset left escrow', async (t) => {
  const f = await fixture();
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  await f.refund().sendAndConfirm(f.caller);
  const closeReceipt = (
    leaf: any = evidence(f.item),
    root = publicKeyBytes(getCnftProof(f.umi, f.item).root),
    proof = getCnftProof(f.umi, f.item).proof
  ) =>
    closeMissingCnftRecoveryV2(f.caller, {
      recovery: f.recovery,
      rentPayer: f.caller.identity.publicKey,
      merkleTree: f.item.merkleTree,
      root,
      leaf,
    }).addRemainingAccounts(proofAccounts(proof));
  await t.throwsAsync(closeReceipt().sendAndConfirm(f.caller), {
    message: /Error Number: 6074/,
  });
  const empty = emptyProof(f.item);
  await t.throwsAsync(
    closeReceipt(null, empty.root, empty.proof).sendAndConfirm(f.caller),
    { message: /Error Number: 6075/ }
  );
  await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 0;
  // The collection authority can also remove the leaf after refund.
  await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  const close = closeReceipt(null, empty.root, empty.proof);
  const closeTx = await close.buildAndSign(f.caller);
  const sim = await f.caller.rpc.simulateTransaction(closeTx);
  t.is(sim.err, null);
  t.true(sim.unitsConsumed! < 50_000);
  const bytes = toWeb3JsTransaction(closeTx).serialize().length;
  t.true(bytes <= 1232);
  t.log(`close missing receipt: ${sim.unitsConsumed} CU, ${bytes} bytes`);
  await close.sendAndConfirm(f.caller);
  t.false(await f.umi.rpc.accountExists(f.recovery));
});

test('full refund consumes gross revenue and leaves the remaining item settleable', async (t) => {
  const f = await fixture('sol', true, 2);
  const other = await mintCnft(f.umi);
  await f.add(other);
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  await f.drawItem();
  await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  const empty = emptyProof(f.item);
  const before = await f.balance();
  await f.refund(null, empty.root, empty.proof).sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, f.price);
  t.true(
    await f.umi.rpc.accountExists(
      findSellerHistoryPda(f.umi, {
        gumballMachine: f.machine,
        seller: f.umi.identity.publicKey,
      })[0]
    )
  );
  const sellerBefore = (await f.umi.rpc.getBalance(f.umi.identity.publicKey))
    .basisPoints;
  await settleCnftSaleV2(f.caller, {
    gumballMachine: f.machine,
    index: 1,
    seller: f.umi.identity.publicKey,
    authority: f.umi.identity.publicKey,
    buyer: f.buyer.identity.publicKey,
    treeConfig: other.treeConfig,
    merkleTree: other.merkleTree,
    args: cnftArgs(f.umi, other),
    currentLeafOwner: other.owner,
    currentLeafDelegate: other.owner,
  })
    .addRemainingAccounts(
      settleRemainingAccounts(other.creators, getCnftProof(f.umi, other).proof)
    )
    .sendAndConfirm(f.caller);
  t.true(
    (await f.umi.rpc.getBalance(f.umi.identity.publicKey)).basisPoints -
      sellerBefore >=
      f.price
  );
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 2n);
  await f.close();
  t.false(await f.umi.rpc.accountExists(f.machine));
});

test('a depth-14 flagged refund fits and executes with a lookup table', async (t) => {
  const f = await fixture('sol', true, 1, 14);
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  const bare = f.refund().useV0();
  const withoutLut = await bare.buildAndSign(f.caller);
  const withoutLutBytes = f.caller.transactions.serialize(withoutLut).length;
  t.true(withoutLutBytes > 1232);
  const recentSlot = (await f.caller.rpc.getSlot()) - 1;
  const [, tables] = createLutForTransactionBuilder(f.caller, bare, recentSlot);
  for (const [index, table] of tables.entries()) {
    await createEmptyLut(f.caller, {
      recentSlot: recentSlot - index,
    }).sendAndConfirm(f.caller);
    for (let offset = 0; offset < table.addresses.length; offset += 20)
      await extendLut(f.caller, {
        address: table.publicKey,
        addresses: table.addresses.slice(offset, offset + 20),
      }).sendAndConfirm(f.caller);
  }
  getSvm().warpToSlot(BigInt(await f.caller.rpc.getSlot()) + 1n);
  const builder = bare.setAddressLookupTables(tables);
  const withLut = await builder.buildAndSign(f.caller);
  const sim = await f.caller.rpc.simulateTransaction(withLut);
  t.is(sim.err, null);
  t.true(sim.unitsConsumed! < 100_000);
  const withLutBytes = toWeb3JsTransaction(withLut).serialize().length;
  t.true(withLutBytes <= 1232);
  t.log(
    `depth-14 flagged refund: ${sim.unitsConsumed} CU; ${withoutLutBytes} bytes without LUT, ${withLutBytes} bytes with LUT`
  );
  const before = await f.balance();
  await builder.sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, f.price);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
});

test('R6-02: depth-14 admin refund fits and executes with a lookup table', async (t) => {
  const f = await fixture('sol', true, 1, 14);
  const collection = await attachRecoveryCollection(f);
  addLargeCollectionAttributes(collection, 1, 180);
  await t.throwsAsync(claimRecoveryItem(f).sendAndConfirm(f.caller), {
    message: /memory allocation failed/,
  });
  const bare = f.adminRefund().useV0();
  const withoutLut = await bare.buildAndSign(f.caller);
  const withoutLutBytes = f.caller.transactions.serialize(withoutLut).length;
  t.true(withoutLutBytes > 1232);
  const recentSlot = (await f.caller.rpc.getSlot()) - 1;
  const [, tables] = createLutForTransactionBuilder(f.caller, bare, recentSlot);
  for (const [index, table] of tables.entries()) {
    await createEmptyLut(f.caller, {
      recentSlot: recentSlot - index,
    }).sendAndConfirm(f.caller);
    for (let offset = 0; offset < table.addresses.length; offset += 20)
      await extendLut(f.caller, {
        address: table.publicKey,
        addresses: table.addresses.slice(offset, offset + 20),
      }).sendAndConfirm(f.caller);
  }
  getSvm().warpToSlot(BigInt(await f.caller.rpc.getSlot()) + 1n);
  const builder = bare.setAddressLookupTables(tables);
  const withLut = await builder.buildAndSign(f.caller);
  const sim = await f.caller.rpc.simulateTransaction(withLut);
  t.is(sim.err, null);
  t.true(sim.unitsConsumed! < 100_000);
  const withLutBytes = toWeb3JsTransaction(withLut).serialize().length;
  t.true(withLutBytes <= 1232);
  t.log(
    `depth-14 admin refund: ${sim.unitsConsumed} CU; ${withoutLutBytes} bytes without LUT, ${withLutBytes} bytes with LUT`
  );
  const before = await f.balance();
  await builder.sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, f.price);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
});

test('R3-01: a single draw in a four-item live machine refunds the full payment', async (t) => {
  const f = await fixture('sol', true, 4);
  const items = [f.item];
  for (let i = 1; i < 4; i += 1) {
    const item = await mintCnft(f.umi);
    await f.add(item);
    items.push(item);
  }
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  const drawn = (await fetchGumballMachine(f.umi, f.machine)).items.find(
    (i) => i.isDrawn
  )!;
  const item = items[drawn.index];
  await setPermanentCollection(f.umi, item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, item)).sendAndConfirm(f.umi);
  item.flags = 2;
  const before = await f.balance();
  await f
    .refund(
      evidence(item),
      publicKeyBytes(getCnftProof(f.umi, item).root),
      getCnftProof(f.umi, item).proof,
      { index: drawn.index, merkleTree: item.merkleTree }
    )
    .sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, 1_000_000_000n);
  t.is((await fetchGumballMachine(f.umi, f.machine)).state, 2);
  const recovery = findCnftRecoveryPda(f.umi, {
    gumballMachine: f.machine,
    merkleTree: item.merkleTree,
    nonce: 0,
  })[0];
  await thawV2(f.umi, mutationArgs(f.umi, item)).sendAndConfirm(f.umi);
  item.flags = 0;
  await reclaimCnftV2(f.marketplace, {
    gumballMachine: f.machine,
    recovery,
    authorityPda: f.escrow,
    seller: f.umi.identity.publicKey,
    rentPayer: f.caller.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    coreCollection: item.collection,
    args: cnftArgs(f.umi, item),
  })
    .addRemainingAccounts([
      { pubkey: f.globalConfig, isSigner: false, isWritable: false },
      ...proofAccounts(getCnftProof(f.umi, item).proof),
    ])
    .sendAndConfirm(f.umi);
  item.owner = f.umi.identity.publicKey;
  await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  const rent = historyRent(f);
  const sellerBefore = await lamports(f.umi);
  for (let i = 0; i < items.length; i += 1) {
    if (i !== drawn.index)
      await settle(f, items[i], i).sendAndConfirm(f.caller);
  }
  t.is((await lamports(f.umi)) - sellerBefore, rent);
  t.is((await fetchGumballMachine(f.umi, f.machine)).totalRevenue, 0n);
  await f.close();
  t.false(await f.umi.rpc.accountExists(f.machine));
});

for (const payment of ['spl', 'token2022']) {
  test(`R3-10: flagged ${payment} recovery refunds gross payment including marketplace fees`, async (t) => {
    const f = await fixture(payment, true, 1, 5, {
      feeBps: 500,
      curatorFeeBps: 1000,
    });
    t.is((await fetchToken(f.tokenUmi, f.feeAta)).amount, 0n);
    t.is((await fetchToken(f.tokenUmi, f.treasury)).amount, f.price);
    await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
    await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    f.item.flags = 2;
    const before = await f.balance();
    await f.refund().sendAndConfirm(f.caller);
    t.is((await f.balance()) - before, f.price);
    t.true(await f.umi.rpc.accountExists(f.recovery));
    t.is((await fetchToken(f.tokenUmi, f.treasury)).amount, 0n);
    await f.close();
    await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    f.item.flags = 0;
    await f.reclaim().sendAndConfirm(f.umi);
    t.false(await f.umi.rpc.accountExists(f.recovery));
  });
}

for (const kind of ['frozen-collection', 'oversized-collection']) {
  test(`R6-02: admin-authorized ${kind} evidence refunds an unflagged escrow leaf`, async (t) => {
    const f = await fixture();
    if (kind === 'frozen-collection') {
      await setPermanentCollection(
        f.umi,
        f.item,
        'PermanentFreezeDelegate',
        true
      );
    } else {
      const collection = generateSigner(f.umi);
      await createCollection(f.umi, {
        collection,
        name: 'Growing collection',
        uri: '',
        plugins: [{ type: 'BubblegumV2' }],
      }).sendAndConfirm(f.umi);
      await setCollectionV2(f.umi, {
        ...mutationArgs(f.umi, f.item),
        metadata: f.item.metadata,
        newCoreCollection: collection.publicKey,
      }).sendAndConfirm(f.umi);
      f.item.collection = collection.publicKey;
      f.item.metadata = {
        ...f.item.metadata,
        collection: some(collection.publicKey),
      };
      f.item.metaHash = hash(
        getMetadataArgsV2Serializer().serialize(f.item.metadata)
      );
      addLargeCollectionAttributes(collection.publicKey);
    }
    t.is(f.item.flags, 0);
    await t.throwsAsync(
      claimCnftV2(f.caller, {
        gumballMachine: f.machine,
        index: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        coreCollection: f.item.collection,
        args: cnftArgs(f.umi, f.item),
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(f.umi, f.item).proof))
        .sendAndConfirm(f.caller),
      {
        message:
          kind === 'frozen-collection'
            ? /CollectionIsFrozen/
            : /memory allocation failed/,
      }
    );
    await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
      message: /Error Number: 6074/,
    });
    const substitute = generateSigner(f.umi);
    await createCollection(f.umi, {
      collection: substitute,
      name: 'Wrong',
      uri: '',
      plugins: [{ type: 'PermanentFreezeDelegate', frozen: true }],
    }).sendAndConfirm(f.umi);
    await t.throwsAsync(
      f
        .refund(undefined, undefined, undefined, {
          coreCollection: substitute.publicKey,
        })
        .sendAndConfirm(f.caller),
      { message: /Error Number: 6076/ }
    );
    const before = await f.balance();
    const refund = f.adminRefund(undefined, undefined, undefined, {
      coreCollection: f.item.collection,
    });
    const tx = await refund.buildAndSign(f.caller);
    const sim = await f.caller.rpc.simulateTransaction(tx);
    t.is(sim.err, null);
    t.log(
      `${kind} refund: ${sim.unitsConsumed} CU, ${toWeb3JsTransaction(tx).serialize().length} bytes`
    );
    await refund.sendAndConfirm(f.caller);
    t.is((await f.balance()) - before, f.price);
    t.true(await f.umi.rpc.accountExists(f.recovery));
    await f.close();
  });
}

for (const version of [0, 1, 3, 4]) {
  test(`R3-04: v${version} machines reject both v2 escrow entries`, async (t) => {
    const f = await fixture('sol', false, 1, 5, { version, skipAdd: true });
    await t.throwsAsync(f.add(f.item), { message: /Error Number: 6060/ });
    await t.throwsAsync(
      requestAddCnftV2(f.umi, {
        gumballMachine: f.machine,
        asset: f.item.assetId,
        merkleTree: f.item.merkleTree,
        treeConfig: f.item.treeConfig,
        leafDelegate: f.item.owner,
        args: cnftArgs(f.umi, f.item),
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(f.umi, f.item).proof))
        .sendAndConfirm(f.umi),
      { message: /Error Number: 6060/ }
    );
    t.is((await fetchGumballMachine(f.umi, f.machine)).itemsLoaded, 0);
  });
}

test('R7-01: only the marketplace can reclaim, even after machine authority rotation', async (t) => {
  const f = await fixture();
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  await f.refund().sendAndConfirm(f.caller);
  await setGumballMachineAuthority(f.umi, {
    gumballMachine: f.machine,
    newAuthority: f.caller.identity.publicKey,
    newAuthoritySigner: f.caller.identity,
  }).sendAndConfirm(f.umi);
  await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 0;
  for (const untrusted of [f.umi, f.caller]) {
    await t.throwsAsync(f.reclaim(untrusted).sendAndConfirm(untrusted), {
      message: /Error Number: 6037/,
    });
  }
  await t.throwsAsync(
    f
      .reclaim(f.marketplace, { gumballMachine: f.buyer.identity.publicKey })
      .sendAndConfirm(f.caller),
    { message: /Error Number: 2012/ }
  );
  await f.reclaim().sendAndConfirm(f.caller);
  t.false(await f.umi.rpc.accountExists(f.recovery));
});

test('R3-10: missing-receipt cleanup rejects a substituted rent payer', async (t) => {
  const f = await fixture();
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  await f.refund().sendAndConfirm(f.caller);
  await t.throwsAsync(
    closeMissingCnftRecoveryV2(f.caller, {
      recovery: f.recovery,
      rentPayer: f.buyer.identity.publicKey,
      merkleTree: f.item.merkleTree,
      root: publicKeyBytes(getCnftProof(f.umi, f.item).root),
      leaf: evidence(f.item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(f.umi, f.item).proof))
      .sendAndConfirm(f.caller),
    { message: /Error Number: 2001/ }
  );
});

test('R3-01/R6-01: partial settlements preserve full refunds and exact marketplace/curator accounting', async (t) => {
  const f = await fixture('sol', true, 3, 5, {
    feeBps: 500,
    curatorFeeBps: 1000,
  });
  const items = [f.item];
  for (let i = 1; i < 3; i += 1) {
    const item = await mintCnft(f.umi);
    await f.add(item);
    items.push(item);
  }
  const curator = await createCnftUmi(createUmi);
  await setGumballMachineAuthority(f.umi, {
    gumballMachine: f.machine,
    newAuthority: curator.identity.publicKey,
    newAuthoritySigner: curator.identity,
  }).sendAndConfirm(f.umi);
  await startSale(curator, { gumballMachine: f.machine }).sendAndConfirm(
    curator
  );
  await f.drawItem();
  await f.drawItem();
  const machine = await fetchGumballMachine(f.umi, f.machine);
  t.is(machine.refundReserve, 2_000_000_000n);
  const drawn = machine.items.filter((i) => i.isDrawn);
  const first = drawn[0];
  const target = drawn[1];
  const sellerBefore = await lamports(f.umi);
  const curatorBefore = await lamports(curator);
  await settle(
    f,
    items[first.index],
    first.index,
    f.buyer.identity.publicKey,
    curator.identity.publicKey
  ).sendAndConfirm(f.caller);
  items[first.index].owner = f.buyer.identity.publicKey;
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
  t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, f.price);
  const partialSeller = (await lamports(f.umi)) - sellerBefore;
  const partialCurator = (await lamports(curator)) - curatorBefore;
  const partialMachine = await fetchGumballMachine(f.umi, f.machine);
  await t.throwsAsync(
    updateSettings(curator, {
      gumballMachine: f.machine,
      settings: { ...partialMachine.settings, curatorFeeBps: 0 },
    }).sendAndConfirm(f.caller),
    { message: /Error Number: 6045/ }
  );
  const item = items[target.index];
  await setPermanentCollection(f.umi, item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, item)).sendAndConfirm(f.umi);
  const empty = emptyProof(item);
  const before = await f.balance();
  await f
    .refund(null, empty.root, empty.proof, {
      index: target.index,
      merkleTree: item.merkleTree,
    })
    .sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, 1_000_000_000n);
  await endSale(curator, { gumballMachine: f.machine }).sendAndConfirm(curator);
  const sellerAfterRefund = await lamports(f.umi);
  const curatorAfterRefund = await lamports(curator);
  await settle(
    f,
    items[first.index],
    first.index,
    f.buyer.identity.publicKey,
    curator.identity.publicKey
  ).sendAndConfirm(f.caller);
  t.is(
    (await lamports(f.umi)) - sellerAfterRefund + partialSeller,
    427_500_000n
  );
  t.is(
    (await lamports(curator)) - curatorAfterRefund + partialCurator,
    47_500_000n
  );
  t.is(await lamports(f.umi, f.feeAccount), 25_000_000n);
  const unsold = machine.items.find((i) => !i.isDrawn)!;
  const rent = historyRent(f);
  const sellerBeforeLast = await lamports(f.umi);
  const curatorBeforeLast = await lamports(curator);
  await settle(
    f,
    items[unsold.index],
    unsold.index,
    defaultPublicKey(),
    curator.identity.publicKey
  ).sendAndConfirm(f.caller);
  t.is((await lamports(f.umi)) - sellerBeforeLast - rent, 427_500_000n);
  t.is((await lamports(curator)) - curatorBeforeLast, 47_500_000n);
  t.is(await lamports(f.umi, f.feeAccount), 50_000_000n);
  const final = await fetchGumballMachine(f.umi, f.machine);
  t.is(final.totalRevenue, 1_000_000_000n);
  t.is(final.totalProceedsSettled, 1_000_000_000n);
  t.is(final.refundReserve, 0n);
  t.is(final.itemsSettled, 3n);
});

test('R16-01: collab proof refund pays fully during SaleLive and remaining inventory settles exactly', async (t) => {
  const f = await fixture('sol', true, 2);
  const other = await mintCnft(f.umi);
  await f.add(other);
  const account = await fetchGumballMachine(f.umi, f.machine);
  await updateSettings(f.umi, {
    gumballMachine: f.machine,
    settings: {
      ...account.settings,
      sellersMerkleRoot: some(new Uint8Array(32)),
    },
  }).sendAndConfirm(f.umi);
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  const drawn = (await fetchGumballMachine(f.umi, f.machine)).items.find(
    (i) => i.isDrawn
  )!;
  const items = [f.item, other];
  const item = items[drawn.index];
  await setPermanentCollection(f.umi, item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, item)).sendAndConfirm(f.umi);
  const empty = emptyProof(item);
  const refund = () =>
    f.refund(null, empty.root, empty.proof, {
      index: drawn.index,
      merkleTree: item.merkleTree,
    });
  const before = await f.balance();
  await refund().sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, f.price);
  const refunded = await fetchGumballMachine(f.umi, f.machine);
  t.is(refunded.state, GumballState.SaleLive);
  t.is(refunded.totalRevenue, 0n);
  t.is(refunded.refundReserve, 0n);
  t.is(refunded.outstandingDraws, 0n);
  t.is(refunded.itemsSettled, 1n);
  await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  const unsold = 1 - drawn.index;
  await settle(f, items[unsold], unsold).sendAndConfirm(f.caller);
  await f.close();
  t.false(await f.umi.rpc.accountExists(f.machine));
});

for (const payment of ['sol', 'spl', 'token2022']) {
  for (const admin of [false, true]) {
    test(`R16-01: live collab ${payment} ${admin ? 'admin' : 'proof'} refund preserves later draws, fees and seller shares`, async (t) => {
      const f = await fixture(payment, true, 4, 5, {
        feeBps: 500,
        curatorFeeBps: 1000,
      });
      const invited = await createCnftUmi(createUmi);
      const curator = await createCnftUmi(createUmi);
      const sellers = [f.umi.identity.publicKey, invited.identity.publicKey];
      const account = await fetchGumballMachine(f.umi, f.machine);
      await updateSettings(f.umi, {
        gumballMachine: f.machine,
        settings: {
          ...account.settings,
          sellersMerkleRoot: some(getSellerMerkleRoot(sellers)),
        },
      }).sendAndConfirm(f.umi);
      const items = [f.item, await mintCnft(f.umi)];
      await f.add(items[1]);
      for (let i = 2; i < 4; i += 1) {
        const item = await mintCnft(invited);
        await addCnftV2(invited, {
          gumballMachine: f.machine,
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          leafDelegate: item.owner,
          args: cnftArgs(invited, item),
          addItemArgs: {
            sellerProofPath: some(getSellerMerkleProof(sellers, sellers[1])),
          },
        })
          .addRemainingAccounts(
            proofAccounts(getCnftProof(invited, item).proof)
          )
          .sendAndConfirm(invited);
        item.owner = f.escrow;
        items.push(item);
      }
      await setGumballMachineAuthority(f.umi, {
        gumballMachine: f.machine,
        newAuthority: curator.identity.publicKey,
        newAuthoritySigner: curator.identity,
      }).sendAndConfirm(f.umi);
      await startSale(curator, { gumballMachine: f.machine }).sendAndConfirm(
        curator
      );
      await f.drawItem();
      const target = (await fetchGumballMachine(f.umi, f.machine)).items.find(
        (i) => i.isDrawn
      )!;
      await f.drawItem();
      const seller = target.index < 2 ? f.umi : invited;
      const item = items[target.index];
      await setPermanentCollection(seller, item, 'PermanentBurnDelegate');
      await burnV2(seller, mutationArgs(seller, item)).sendAndConfirm(seller);
      const empty = emptyProof(item);
      const before = await f.balance();
      await measureInstruction(
        f.caller,
        (admin ? f.adminRefund : f.refund)(null, empty.root, empty.proof, {
          index: target.index,
          merkleTree: item.merkleTree,
          seller: seller.identity.publicKey,
        }),
        t,
        admin ? 'admin_refund_cnft_sale_v2' : 'refund_cnft_sale_v2'
      );
      t.is((await f.balance()) - before, f.price);
      const refunded = await fetchGumballMachine(f.umi, f.machine);
      t.is(refunded.state, GumballState.SaleLive);
      t.is(refunded.totalRevenue, f.price);
      t.is(refunded.refundReserve, f.price);
      t.is(refunded.outstandingDraws, 1n);
      t.is(refunded.itemsSettled, 1n);
      t.is(refunded.itemsRedeemed, 2n);
      t.is(refunded.itemsRefunded, 1n);
      t.is(refunded.totalProceedsSettled, 0n);
      t.is(refunded.items[target.index].drawPayment, f.price);
      await f.drawItem();
      const live = await fetchGumballMachine(f.umi, f.machine);
      t.is(live.state, GumballState.SaleLive);
      t.is(live.totalRevenue, 2n * f.price);
      t.is(live.refundReserve, 2n * f.price);
      t.is(live.itemsRedeemed, 3n);
      await endSale(curator, { gumballMachine: f.machine }).sendAndConfirm(
        curator
      );
      const sellerFor = (index: number) => sellers[index < 2 ? 0 : 1];
      const recipients = [...sellers, curator.identity.publicKey, f.feeAccount];
      const balance = async (recipient: PublicKey) => {
        if (!f.mint) return lamports(f.caller, recipient);
        const ata = findAssociatedTokenPda(f.tokenUmi, {
          owner: recipient,
          mint: f.mint.publicKey,
          tokenProgramId: getSplTokenProgramId(f.tokenUmi),
        })[0];
        return (await f.caller.rpc.accountExists(ata))
          ? (await fetchToken(f.caller, ata)).amount
          : 0n;
      };
      const balances = await Promise.all(recipients.map(balance));
      const rents = sellers.map((key) =>
        getSvm()
          .getAccount(
            publicKeyBytes(
              findSellerHistoryPda(f.umi, {
                gumballMachine: f.machine,
                seller: key,
              })[0]
            )
          )!
          .lamports()
      );
      const remaining = live.items.filter((i) => i.index !== target.index);
      const unsold = remaining.find((i) => !i.isDrawn)!;
      const sold = remaining.filter((i) => i.isDrawn);
      // Unsold-first and then one resolved draw pay only the unreserved pool.
      for (const entry of [unsold, ...sold]) {
        let settlement = settle(
          f,
          items[entry.index],
          entry.index,
          entry.isDrawn ? f.buyer.identity.publicKey : defaultPublicKey(),
          curator.identity.publicKey,
          sellerFor(entry.index)
        ).prepend(setComputeUnitLimit(f.caller, { units: 300_000 }));
        if (
          f.caller.transactions.serialize(
            await settlement.buildAndSign(f.caller)
          ).length > 1232
        ) {
          settlement = settlement.useV0();
          const recentSlot = (await f.caller.rpc.getSlot()) - 1;
          const [, tables] = createLutForTransactionBuilder(
            f.caller,
            settlement,
            recentSlot
          );
          for (const [tableIndex, table] of tables.entries()) {
            await createEmptyLut(f.caller, {
              recentSlot: recentSlot - tableIndex,
            }).sendAndConfirm(f.caller);
            for (
              let offset = 0;
              offset < table.addresses.length;
              offset += 20
            ) {
              await extendLut(f.caller, {
                address: table.publicKey,
                addresses: table.addresses.slice(offset, offset + 20),
              }).sendAndConfirm(f.caller);
            }
          }
          getSvm().warpToSlot(BigInt(await f.caller.rpc.getSlot()) + 1n);
          settlement = settlement.setAddressLookupTables(tables);
        }
        const packet = await settlement.buildAndSign(f.caller);
        const simulation = await f.caller.rpc.simulateTransaction(packet);
        t.falsy(simulation.err);
        t.true(simulation.unitsConsumed <= 300_000);
        const serializedBytes = f.caller.transactions.serialize(packet).length;
        t.true(serializedBytes <= 1232);
        t.log(
          `M20_METRIC ${JSON.stringify({ scenario: t.title, computeUnits: simulation.unitsConsumed, serializedBytes })}`
        );
        await settlement.sendAndConfirm(f.caller);
        items[entry.index].owner = entry.isDrawn
          ? f.buyer.identity.publicKey
          : sellerFor(entry.index);
        const partial = await fetchGumballMachine(f.umi, f.machine);
        t.true(
          partial.totalProceedsSettled <=
            partial.totalRevenue - partial.refundReserve
        );
      }
      for (const entry of remaining) {
        const current = await fetchGumballMachine(f.umi, f.machine);
        if (current.items[entry.index].isSettled) continue;
        await settle(
          f,
          items[entry.index],
          entry.index,
          entry.isDrawn ? f.buyer.identity.publicKey : defaultPublicKey(),
          curator.identity.publicKey,
          sellerFor(entry.index)
        )
          .prepend(setComputeUnitLimit(f.caller, { units: 300_000 }))
          .sendAndConfirm(f.caller);
      }
      const final = await fetchGumballMachine(f.umi, f.machine);
      t.is(final.totalRevenue, 2n * f.price);
      t.is(final.totalProceedsSettled, 2n * f.price);
      t.is(final.refundReserve, 0n);
      t.is(final.outstandingDraws, 0n);
      t.is(final.itemsSettled, 4n);
      t.is(final.itemsRefunded, 1n);
      const expected = [0n, 0n, 0n, 0n];
      const share = (2n * f.price) / 3n;
      for (const entry of remaining) {
        const gross = final.itemProceedsPaid![entry.index];
        t.true(gross === share || gross === share + 1n);
        const fee = (gross * 500n) / 10000n;
        const curatorFee = ((gross - fee) * 1000n) / 10000n;
        expected[entry.index < 2 ? 0 : 1] += gross - fee - curatorFee;
        expected[2] += curatorFee;
        expected[3] += fee;
      }
      const after = await Promise.all(recipients.map(balance));
      for (let i = 0; i < recipients.length; i += 1) {
        const rent = payment === 'sol' && i < 2 ? rents[i] : 0n;
        t.is(after[i] - balances[i] - rent, expected[i]);
      }
      t.is(
        expected.reduce((sum, value) => sum + value, 0n),
        2n * f.price
      );
      await setGumballMachineAuthority(curator, {
        gumballMachine: f.machine,
        newAuthority: f.umi.identity.publicKey,
        newAuthoritySigner: f.umi.identity,
      }).sendAndConfirm(f.caller);
      await f.close();
      t.false(await f.caller.rpc.accountExists(f.machine));
    });
  }
}

for (const admin of [false, true]) {
  test(`R16-01: ${admin ? 'admin' : 'proof'} refund cannot remove undrawn inventory during SaleLive`, async (t) => {
    const f = await fixture('sol', false, 2);
    await f.add(await mintCnft(f.umi));
    const machine = await fetchGumballMachine(f.umi, f.machine);
    await updateSettings(f.umi, {
      gumballMachine: f.machine,
      settings: {
        ...machine.settings,
        sellersMerkleRoot: some(new Uint8Array(32)),
      },
    }).sendAndConfirm(f.umi);
    await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    const empty = emptyProof(f.item);
    await t.throwsAsync(
      (admin ? f.adminRefund : f.refund)(
        null,
        empty.root,
        empty.proof
      ).sendAndConfirm(f.caller),
      { message: /Error Number: 6036/ }
    );
    t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
  });
}

test('R3-01: settling unsold items cannot spend a pending buyer refund', async (t) => {
  const f = await fixture('sol', true, 3);
  const items = [f.item];
  for (let i = 1; i < 3; i += 1) {
    const item = await mintCnft(f.umi);
    await f.add(item);
    items.push(item);
  }
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  const account = await fetchGumballMachine(f.umi, f.machine);
  const drawn = account.items.find((i) => i.isDrawn)!;
  const sellerBefore = await lamports(f.umi);
  for (const unsold of account.items.filter((i) => !i.isDrawn)) {
    await settle(f, items[unsold.index], unsold.index).sendAndConfirm(f.caller);
    items[unsold.index].owner = f.umi.identity.publicKey;
  }
  t.is(await lamports(f.umi), sellerBefore);
  t.is((await fetchGumballMachine(f.umi, f.machine)).totalProceedsSettled, 0n);
  const item = items[drawn.index];
  await setPermanentCollection(f.umi, item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, item)).sendAndConfirm(f.umi);
  const empty = emptyProof(item);
  const before = await f.balance();
  await f
    .refund(null, empty.root, empty.proof, {
      index: drawn.index,
      merkleTree: item.merkleTree,
    })
    .sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, f.price);
  for (const unsold of account.items.filter((i) => !i.isDrawn)) {
    await settle(f, items[unsold.index], unsold.index).sendAndConfirm(f.caller);
  }
  await f.close();
});

test('R3-10: refund explicitly rejects pre-v5 accounting', async (t) => {
  const f = await fixture();
  const key = publicKeyBytes(f.machine);
  const account = getSvm().getAccount(key)!;
  const data = account.data();
  data[8] = 4;
  getSvm().setAccount(
    key,
    new Account(account.lamports(), data, account.owner(), false, 0n)
  );
  await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
    message: /Error Number: 6060/,
  });
});

test('R3-01: changing draw prices are recorded and refunded independently', async (t) => {
  const f = await fixture('sol', true, 2, 5, {
    groups: [
      { label: 'LOW1', guards: { solPayment: some({ lamports: sol(1) }) } },
      { label: 'HIGH1', guards: { solPayment: some({ lamports: sol(2) }) } },
    ],
  });
  const other = await mintCnft(f.umi);
  await f.add(other);
  const items = [f.item, other];
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem('LOW1');
  const first = (await fetchGumballMachine(f.umi, f.machine)).items.find(
    (i) => i.isDrawn
  )!;
  await f.drawItem('HIGH1');
  const account = await fetchGumballMachine(f.umi, f.machine);
  t.is(account.items[first.index].drawPayment, 1_000_000_000n);
  t.is(account.items[1 - first.index].drawPayment, 2_000_000_000n);
  t.is(account.pendingDrawPayment, 0n);
  t.is(account.refundReserve, 3_000_000_000n);
  for (const index of [first.index, 1 - first.index]) {
    const item = items[index];
    await setPermanentCollection(f.umi, item, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, item)).sendAndConfirm(f.umi);
    const empty = emptyProof(item);
    const before = await f.balance();
    await f
      .refund(null, empty.root, empty.proof, {
        index,
        merkleTree: item.merkleTree,
      })
      .sendAndConfirm(f.caller);
    t.is((await f.balance()) - before, account.items[index].drawPayment);
  }
  const final = await fetchGumballMachine(f.umi, f.machine);
  t.is(final.totalRevenue, 0n);
  t.is(final.refundReserve, 0n);
  await f.close();
});

test('R3-04: an unused v5 machine enables the payment ledger before accepting v2 custody', async (t) => {
  const f = await fixture('sol', false, 1, 5, { skipAdd: true });
  const key = publicKeyBytes(f.machine);
  const original = getSvm().getAccount(key)!;
  const oldSize = getGumballMachineSizeForItemCount(1, 5);
  getSvm().setAccount(
    key,
    new Account(
      original.lamports(),
      original.data().slice(0, oldSize),
      original.owner(),
      false,
      0n
    )
  );
  await f.add(f.item);
  t.true(getSvm().getAccount(key)!.data().length > oldSize);
  const machine = await fetchGumballMachine(f.umi, f.machine);
  t.is(machine.version, 6);
  t.is(machine.refundReserve, 0n);
  t.is(machine.pendingDrawPayment, 0n);
  t.deepEqual(machine.drawPayments, [0n]);
});

test('R3-01: mixed-machine batch settlement preserves the cNFT refund reserve and pays deferred fees', async (t) => {
  const f = await fixture('sol', true, 3, 5, { feeBps: 500 });
  const [mint] = await createMintWithHolders(f.umi, {
    decimals: 0,
    holders: [
      { owner: f.umi.identity, amount: 2 },
      { owner: f.buyer.identity, amount: 0 },
    ],
  });
  await addTokens(f.umi, {
    gumballMachine: f.machine,
    mint: mint.publicKey,
    amount: 1,
    quantity: 2,
  }).sendAndConfirm(f.umi);
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  for (let i = 0; i < 3; i += 1) await f.drawItem();
  for (const index of [1, 2]) {
    await claimTokens(f.buyer, {
      gumballMachine: f.machine,
      authority: f.umi.identity.publicKey,
      index,
      seller: f.umi.identity.publicKey,
      mint: mint.publicKey,
    }).sendAndConfirm(f.buyer);
  }
  const batch = () =>
    settleTokensSaleClaimed(f.caller, {
      gumballMachine: f.machine,
      authority: f.umi.identity.publicKey,
      seller: f.umi.identity.publicKey,
      mint: mint.publicKey,
      startIndex: 1,
      endIndex: 2,
    });
  const sellerBeforePartial = await lamports(f.umi);
  await batch()
    .addRemainingAccounts([
      { pubkey: f.feeAccount, isWritable: true, isSigner: false },
    ])
    .sendAndConfirm(f.caller);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
  const partialBatch = (await lamports(f.umi)) - sellerBeforePartial;
  await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  const empty = emptyProof(f.item);
  const buyerBefore = await f.balance();
  await f.refund(null, empty.root, empty.proof).sendAndConfirm(f.caller);
  t.is((await f.balance()) - buyerBefore, f.price);
  await t.throwsAsync(batch().sendAndConfirm(f.caller), {
    message: /Error Number: 6037/,
  });
  const before = await lamports(f.umi);
  const rent = historyRent(f);
  await batch()
    .addRemainingAccounts([
      { pubkey: f.feeAccount, isWritable: true, isSigner: false },
    ])
    .sendAndConfirm(f.caller);
  t.is((await lamports(f.umi)) - before - rent + partialBatch, 1_900_000_000n);
  t.is(await lamports(f.umi, f.feeAccount), 100_000_000n);
  const machine = await fetchGumballMachine(f.umi, f.machine);
  t.is(machine.refundReserve, 0n);
  t.is(machine.totalProceedsSettled, 2_000_000_000n);
  await f.close();
});

test('R4-01: an undrawn v2 item cannot settle during SaleLive and remains claimable after draw', async (t) => {
  const f = await fixture('sol', true, 2);
  const other = await mintCnft(f.umi);
  await f.add(other);
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await t.throwsAsync(settle(f, f.item, 0).sendAndConfirm(f.caller), {
    message: /Error Number: 6036/,
  });
  const unchanged = await fetchGumballMachine(f.umi, f.machine);
  t.is(unchanged.itemsSettled, 0n);
  t.is(unchanged.itemsRedeemed, 0n);
  t.false(unchanged.items[0].isClaimed);
  await f.drawItem();
  const drawn = (await fetchGumballMachine(f.umi, f.machine)).items.find(
    (i) => i.isDrawn
  )!;
  await settle(
    f,
    [f.item, other][drawn.index],
    drawn.index,
    f.buyer.identity.publicKey
  ).sendAndConfirm(f.caller);
  t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, 0n);
});

test('R4-02/R4-17: two collab sellers receive equal shares regardless of an unsold-first attempt', async (t) => {
  const f = await fixture('sol', true, 2);
  const sellerB = await createCnftUmi(createUmi as any);
  const other = await mintCnft(sellerB);
  const beforeSettings = await fetchGumballMachine(f.umi, f.machine);
  await updateSettings(f.umi, {
    gumballMachine: f.machine,
    settings: {
      ...beforeSettings.settings,
      sellersMerkleRoot: some(
        getSellerMerkleRoot([sellerB.identity.publicKey])
      ),
    },
  }).sendAndConfirm(f.umi);
  await addCnftV2(sellerB, {
    gumballMachine: f.machine,
    treeConfig: other.treeConfig,
    merkleTree: other.merkleTree,
    leafDelegate: other.owner,
    args: cnftArgs(sellerB, other),
    addItemArgs: { sellerProofPath: some([]) },
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(sellerB, other).proof))
    .sendAndConfirm(sellerB);
  other.owner = f.escrow;
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  const machine = await fetchGumballMachine(f.umi, f.machine);
  const sold = machine.items.find((i) => i.isDrawn)!;
  const unsold = machine.items.find((i) => !i.isDrawn)!;
  const items = [f.item, other];
  const sellers = [f.umi.identity.publicKey, sellerB.identity.publicKey];
  const histories = sellers.map((seller) =>
    getSvm()
      .getAccount(
        publicKeyBytes(
          findSellerHistoryPda(f.umi, { gumballMachine: f.machine, seller })[0]
        )
      )!
      .lamports()
  );
  const before = await Promise.all(
    sellers.map((seller) => lamports(f.umi, seller))
  );
  await settle(
    f,
    items[unsold.index],
    unsold.index,
    defaultPublicKey(),
    f.umi.identity.publicKey,
    sellers[unsold.index]
  ).sendAndConfirm(f.caller);
  const deferred = await fetchGumballMachine(f.umi, f.machine);
  t.is(deferred.totalProceedsSettled, 0n);
  t.is(deferred.itemsSettled, 0n);
  t.true(deferred.items[unsold.index].isClaimed);
  items[unsold.index].owner = sellers[unsold.index];
  t.deepEqual(
    await Promise.all(sellers.map((seller) => lamports(f.umi, seller))),
    before
  );
  await claimCnftV2(f.caller, {
    gumballMachine: f.machine,
    index: sold.index,
    seller: sellers[sold.index],
    buyer: f.buyer.identity.publicKey,
    treeConfig: items[sold.index].treeConfig,
    merkleTree: items[sold.index].merkleTree,
    args: cnftArgs(f.umi, items[sold.index]),
  })
    .addRemainingAccounts(
      proofAccounts(getCnftProof(f.umi, items[sold.index]).proof)
    )
    .sendAndConfirm(f.caller);
  items[sold.index].owner = f.buyer.identity.publicKey;
  await settle(
    f,
    items[unsold.index],
    unsold.index,
    defaultPublicKey(),
    f.umi.identity.publicKey,
    sellers[unsold.index]
  ).sendAndConfirm(f.caller);
  await settle(
    f,
    items[sold.index],
    sold.index,
    f.buyer.identity.publicKey,
    f.umi.identity.publicKey,
    sellers[sold.index]
  ).sendAndConfirm(f.caller);
  for (const index of [0, 1])
    t.is(
      (await lamports(f.umi, sellers[index])) -
        before[index] -
        histories[index],
      500_000_000n
    );
  const final = await fetchGumballMachine(f.umi, f.machine);
  t.is(final.totalProceedsSettled, 1_000_000_000n);
  t.is(final.refundReserve, 0n);
});

test('R4-04/R4-17: an unwrapped wallet mint authority cannot inflate revenue or draw on v6', async (t) => {
  const f = await fixture('sol', true, 2);
  const other = await mintCnft(f.umi);
  await f.add(other);
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  await unwrap(f.umi, {
    gumballMachine: f.machine,
    gumballGuard: findGumballGuardPda(f.umi, { base: f.machine })[0],
  }).sendAndConfirm(f.umi);
  await setMintAuthority(f.umi, {
    gumballMachine: f.machine,
    mintAuthority: f.umi.identity,
  }).sendAndConfirm(f.umi);
  const before = await fetchGumballMachine(f.umi, f.machine);
  await t.throwsAsync(
    incrementTotalRevenue(f.umi, {
      gumballMachine: f.machine,
      revenue: 1_000_000_000n,
    }).sendAndConfirm(f.umi),
    { message: /Error Number: 6037/ }
  );
  await t.throwsAsync(
    drawFromGumballMachine(f.umi, {
      gumballMachine: f.machine,
      buyer: f.buyer.identity.publicKey,
    }).sendAndConfirm(f.umi),
    { message: /Error Number: 6037/ }
  );
  const after = await fetchGumballMachine(f.umi, f.machine);
  t.is(after.totalRevenue, before.totalRevenue);
  t.is(after.pendingDrawPayment, 0n);
  t.is(after.refundReserve, 1_000_000_000n);
  t.is(after.itemsRedeemed, 1n);
  await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  const sold = after.items.find((i) => i.isDrawn)!;
  const item = [f.item, other][sold.index];
  await setPermanentCollection(f.umi, item, 'PermanentFreezeDelegate', true);
  const buyerBefore = await f.balance();
  await f
    .adminRefund(
      evidence(item),
      publicKeyBytes(getCnftProof(f.umi, item).root),
      getCnftProof(f.umi, item).proof,
      {
        index: sold.index,
        merkleTree: item.merkleTree,
        coreCollection: item.collection,
      }
    )
    .sendAndConfirm(f.caller);
  t.is((await f.balance()) - buyerBefore, 1_000_000_000n);
});

for (const approve of [false, true]) {
  test(`R4-05: an unapproved v2 request preserves v5; ${approve ? 'authority approval enables v6' : 'cancellation preserves v5'}`, async (t) => {
    const f = await fixture('sol', false, 1, 5, { skipAdd: true, feeBps: 500 });
    await updateSettings(f.umi, {
      gumballMachine: f.machine,
      settings: {
        ...(await fetchGumballMachine(f.umi, f.machine)).settings,
        sellersMerkleRoot: some(new Uint8Array(32)),
      },
    }).sendAndConfirm(f.umi);
    const item = await mintCnft(f.caller);
    const key = publicKeyBytes(f.machine);
    const account = getSvm().getAccount(key)!;
    const size = getGumballMachineSizeForItemCount(1, 5);
    getSvm().setAccount(
      key,
      new Account(
        account.lamports(),
        account.data().slice(0, size),
        account.owner(),
        false,
        0n
      )
    );
    await requestAddCnftV2(f.caller, {
      gumballMachine: f.machine,
      asset: item.assetId,
      leafDelegate: item.owner,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      args: cnftArgs(f.caller, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(f.caller, item).proof))
      .sendAndConfirm(f.caller);
    item.owner = f.escrow;
    t.is((await fetchGumballMachine(f.umi, f.machine)).version, 5);
    t.is(getSvm().getAccount(key)!.data().length, size);
    if (approve) {
      await t.throwsAsync(
        approveAddItem(f.caller, {
          gumballMachine: f.machine,
          seller: f.caller.identity.publicKey,
          asset: item.assetId,
        }).sendAndConfirm(f.caller),
        { message: /Error Number: 6037/ }
      );
      await approveAddItem(f.umi, {
        gumballMachine: f.machine,
        seller: f.caller.identity.publicKey,
        asset: item.assetId,
      }).sendAndConfirm(f.umi);
      const machine = await fetchGumballMachine(f.umi, f.machine);
      t.is(machine.version, 6);
      t.is(machine.itemsLoaded, 1);
      t.deepEqual(machine.drawPayments, [0n]);
      t.is(machine.refundReserve, 0n);
    } else {
      await withRequestCancellationMachine(
        cancelAddCnftRequestV2(f.caller, {
          sellerHistory: findSellerHistoryPda(f.caller, {
            gumballMachine: f.machine,
            seller: f.caller.identity.publicKey,
          })[0],
          authorityPda: f.escrow,
          asset: item.assetId,
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          args: cnftArgs(f.caller, item),
        }).addRemainingAccounts(
          proofAccounts(getCnftProof(f.caller, item).proof)
        ),
        f.machine
      ).sendAndConfirm(f.caller);
      t.is((await fetchGumballMachine(f.umi, f.machine)).version, 5);
      t.is(getSvm().getAccount(key)!.data().length, size);
    }
  });
}

for (const size of [
  16_384, 16_385, 17_156, 22_156, 22_212, 22_213, 22_214, 24_156,
]) {
  test(`R6-02/R6-17: single-attribute transfer boundary at ${size} bytes`, async (t) => {
    const f = await fixture();
    const collection = generateSigner(f.umi);
    await createCollection(f.umi, {
      collection,
      name: 'Boundary collection',
      uri: '',
      plugins: [{ type: 'BubblegumV2' }],
    }).sendAndConfirm(f.umi);
    await setCollectionV2(f.umi, {
      ...mutationArgs(f.umi, f.item),
      metadata: f.item.metadata,
      newCoreCollection: collection.publicKey,
    }).sendAndConfirm(f.umi);
    f.item.collection = collection.publicKey;
    f.item.metadata = {
      ...f.item.metadata,
      collection: some(collection.publicKey),
    };
    f.item.metaHash = hash(
      getMetadataArgsV2Serializer().serialize(f.item.metadata)
    );
    const key = publicKeyBytes(collection.publicKey);
    const original = getSvm().getAccount(key)!;
    addLargeCollectionAttributes(collection.publicKey, 0);
    const overhead = getSvm().getAccount(key)!.data().length;
    getSvm().setAccount(key, original);
    addLargeCollectionAttributes(collection.publicKey, size - overhead);
    t.is(getSvm().getAccount(key)!.data().length, size);
    const claim = () =>
      claimCnftV2(f.caller, {
        gumballMachine: f.machine,
        index: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        coreCollection: collection.publicKey,
        args: cnftArgs(f.umi, f.item),
      }).addRemainingAccounts(proofAccounts(getCnftProof(f.umi, f.item).proof));
    await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
      message: /Error Number: 6074/,
    });
    if (size <= 22_156) {
      await claim().sendAndConfirm(f.caller);
      t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, 0n);
    } else {
      await t.throwsAsync(claim().sendAndConfirm(f.caller), {
        message: /memory allocation failed/,
      });
      const before = await f.balance();
      const refund = f.adminRefund();
      const tx = await refund.buildAndSign(f.caller);
      const sim = await f.caller.rpc.simulateTransaction(tx);
      t.is(sim.err, null);
      t.log(
        `${size}-byte collection admin refund: ${sim.unitsConsumed} CU, ${toWeb3JsTransaction(tx).serialize().length} bytes`
      );
      await refund.sendAndConfirm(f.caller);
      t.is((await f.balance()) - before, f.price);
    }
  });
}

test('R6-01: batch settlement accrues resolved revenue and tops up after draws resolve', async (t) => {
  const f = await fixture('sol', true, 4, 5, {
    groups: [
      { label: 'ONE1', guards: { solPayment: some({ lamports: sol(1) }) } },
      { label: 'ZERO1', guards: { solPayment: some({ lamports: sol(0) }) } },
      { label: 'THREE', guards: { solPayment: some({ lamports: sol(3) }) } },
    ],
  });
  const other = await mintCnft(f.umi);
  await f.add(other);
  const [mint] = await createMintWithHolders(f.umi, {
    decimals: 0,
    holders: [
      { owner: f.umi.identity, amount: 2 },
      { owner: f.buyer.identity, amount: 0 },
    ],
  });
  await addTokens(f.umi, {
    gumballMachine: f.machine,
    mint: mint.publicKey,
    amount: 1,
    quantity: 2,
  }).sendAndConfirm(f.umi);
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  for (let n = 0; n < 3; n += 1) await f.drawItem('ONE1');
  const remaining = (await fetchGumballMachine(f.umi, f.machine)).items.find(
    (i) => !i.isDrawn
  )!;
  await f.drawItem(remaining.index < 2 ? 'THREE' : 'ZERO1');
  for (const index of [2, 3])
    await claimTokens(f.buyer, {
      gumballMachine: f.machine,
      authority: f.umi.identity.publicKey,
      seller: f.umi.identity.publicKey,
      mint: mint.publicKey,
      index,
    }).sendAndConfirm(f.buyer);
  const batch = () =>
    settleTokensSaleClaimed(f.caller, {
      gumballMachine: f.machine,
      authority: f.umi.identity.publicKey,
      seller: f.umi.identity.publicKey,
      mint: mint.publicKey,
      startIndex: 2,
      endIndex: 3,
    });
  const before = await fetchGumballMachine(f.umi, f.machine);
  const sellerBefore = await lamports(f.umi);
  await batch().sendAndConfirm(f.caller);
  const partial = await fetchGumballMachine(f.umi, f.machine);
  t.is(partial.itemsSettled, 0n);
  t.is(
    partial.totalProceedsSettled,
    (before.totalRevenue - before.refundReserve!) / 2n
  );
  t.is((await lamports(f.umi)) - sellerBefore, partial.totalProceedsSettled);
  for (const [index, item] of [f.item, other].entries()) {
    await claimCnftV2(f.caller, {
      gumballMachine: f.machine,
      index,
      seller: f.umi.identity.publicKey,
      buyer: f.buyer.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      args: cnftArgs(f.umi, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(f.umi, item).proof))
      .sendAndConfirm(f.caller);
  }
  await batch().sendAndConfirm(f.caller);
  t.is((await lamports(f.umi)) - sellerBefore, before.totalRevenue / 2n);
  t.is(
    (await fetchGumballMachine(f.umi, f.machine)).totalProceedsSettled,
    before.totalRevenue / 2n
  );
});

for (const type of [
  'PermanentTransferDelegate',
  'PermanentBurnDelegate',
  'PermanentFreezeDelegate',
]) {
  test(`R6-02: ${type} alone never authorizes permissionless recovery`, async (t) => {
    const f = await fixture();
    await setPermanentCollection(f.umi, f.item, type);
    const claim = claimCnftV2(f.caller, {
      gumballMachine: f.machine,
      index: 0,
      seller: f.umi.identity.publicKey,
      buyer: f.buyer.identity.publicKey,
      treeConfig: f.item.treeConfig,
      merkleTree: f.item.merkleTree,
      coreCollection: f.item.collection,
      args: cnftArgs(f.umi, f.item),
    }).addRemainingAccounts(proofAccounts(getCnftProof(f.umi, f.item).proof));
    t.is(
      (
        await f.caller.rpc.simulateTransaction(
          await claim.buildAndSign(f.caller)
        )
      ).err,
      null
    );
    await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
      message: /Error Number: 6074/,
    });
    await claim.sendAndConfirm(f.caller);
    t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, 0n);
  });
}

for (const collab of [false, true]) {
  test(`R5-01/R5-20: ${collab ? 'collab' : 'solo'} settings preserve live and ended states`, async (t) => {
    const f = await fixture('sol', true, 2);
    const other = await mintCnft(f.umi);
    await f.add(other);
    let machine = await fetchGumballMachine(f.umi, f.machine);
    if (collab) {
      await updateSettings(f.umi, {
        gumballMachine: f.machine,
        settings: {
          ...machine.settings,
          sellersMerkleRoot: some(new Uint8Array(32)),
        },
      }).sendAndConfirm(f.umi);
    }
    await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    await f.drawItem();
    for (const state of [GumballState.SaleLive, GumballState.SaleEnded]) {
      if (state === GumballState.SaleEnded)
        await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(
          f.umi
        );
      machine = await fetchGumballMachine(f.umi, f.machine);
      const before = getSvm().getAccount(publicKeyBytes(f.machine))!.data();
      const root = collab ? null : some(new Uint8Array(32));
      await t.throwsAsync(
        updateSettings(f.umi, {
          gumballMachine: f.machine,
          settings: { ...machine.settings, sellersMerkleRoot: root },
        }).sendAndConfirm(f.umi),
        { message: /Error Number: 6045/ }
      );
      t.deepEqual(
        getSvm().getAccount(publicKeyBytes(f.machine))!.data(),
        before
      );
      await updateSettings(f.umi, {
        gumballMachine: f.machine,
        settings: { ...machine.settings, uri: 'updated' },
      }).sendAndConfirm(f.umi);
      t.is((await fetchGumballMachine(f.umi, f.machine)).state, state);
      const drawn = machine.items.find((item) => item.isDrawn)!;
      const item = [f.item, other][drawn.index];
      await t.throwsAsync(
        removeCnftV2(f.umi, {
          gumballMachine: f.machine,
          index: drawn.index,
          seller: f.umi.identity.publicKey,
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          args: cnftArgs(f.umi, item),
        })
          .addRemainingAccounts(proofAccounts(getCnftProof(f.umi, item).proof))
          .sendAndConfirm(f.umi),
        { message: /Error Number: 6036/ }
      );
    }
    const drawn = machine.items.find((item) => item.isDrawn)!;
    await claimCnftV2(f.caller, {
      gumballMachine: f.machine,
      index: drawn.index,
      seller: f.umi.identity.publicKey,
      buyer: f.buyer.identity.publicKey,
      treeConfig: [f.item, other][drawn.index].treeConfig,
      merkleTree: [f.item, other][drawn.index].merkleTree,
      args: cnftArgs(f.umi, [f.item, other][drawn.index]),
    })
      .addRemainingAccounts(
        proofAccounts(getCnftProof(f.umi, [f.item, other][drawn.index]).proof)
      )
      .sendAndConfirm(f.caller);
    [f.item, other][drawn.index].owner = f.buyer.identity.publicKey;
    for (const line of machine.items)
      await settle(
        f,
        [f.item, other][line.index],
        line.index,
        line.isDrawn ? f.buyer.identity.publicKey : defaultPublicKey()
      ).sendAndConfirm(f.caller);
    const after = await fetchGumballMachine(f.umi, f.machine);
    await updateSettings(f.umi, {
      gumballMachine: f.machine,
      settings: { ...after.settings, uri: 'settled' },
    }).sendAndConfirm(f.umi);
    await t.throwsAsync(
      startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi),
      { message: /Error Number: 6036/ }
    );
    const balance = await f.balance();
    await t.throwsAsync(f.drawItem(), { message: /Error Number: 6036/ });
    t.is(await f.balance(), balance - 5_000n);
    t.is(
      (await fetchGumballMachine(f.umi, f.machine)).state,
      GumballState.SaleEnded
    );
    t.is(after.refundReserve, 0n);
    t.is(after.totalProceedsSettled, 1_000_000_000n);
  });
}

for (const request of [false, true]) {
  test(`R6-02: actual transfer failure rejects ${request ? 'request' : 'direct'} entry`, async (t) => {
    const f = await fixture('sol', false, 1, 5, { skipAdd: true });
    const entryUmi = request ? f.caller : f.umi;
    if (request) f.item = await mintCnft(entryUmi);
    const collection = generateSigner(entryUmi);
    await createCollection(entryUmi, {
      collection,
      name: 'Entry collection',
      uri: '',
      plugins: [{ type: 'BubblegumV2' }],
    }).sendAndConfirm(entryUmi);
    await setCollectionV2(entryUmi, {
      ...mutationArgs(entryUmi, f.item),
      metadata: f.item.metadata,
      newCoreCollection: collection.publicKey,
    }).sendAndConfirm(entryUmi);
    f.item.collection = collection.publicKey;
    f.item.metadata = {
      ...f.item.metadata,
      collection: some(collection.publicKey),
    };
    f.item.metaHash = hash(
      getMetadataArgsV2Serializer().serialize(f.item.metadata)
    );
    const collectionKey = publicKeyBytes(collection.publicKey);
    const original = getSvm().getAccount(collectionKey)!;
    addLargeCollectionAttributes(collection.publicKey, 0);
    const overhead = getSvm().getAccount(collectionKey)!.data().length;
    getSvm().setAccount(collectionKey, original);
    addLargeCollectionAttributes(collection.publicKey, 24_156 - overhead);
    t.is(getSvm().getAccount(collectionKey)!.data().length, 24_156);
    const before = getSvm().getAccount(publicKeyBytes(f.machine))!.data();
    const build = request ? requestAddCnftV2 : addCnftV2;
    await t.throwsAsync(
      build(entryUmi, {
        gumballMachine: f.machine,
        asset: f.item.assetId,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        coreCollection: collection.publicKey,
        leafDelegate: f.item.owner,
        args: cnftArgs(entryUmi, f.item),
        addItemArgs: {},
      })
        .addRemainingAccounts(
          proofAccounts(getCnftProof(entryUmi, f.item).proof)
        )
        .sendAndConfirm(entryUmi),
      { message: /memory allocation failed/ }
    );
    t.deepEqual(getSvm().getAccount(publicKeyBytes(f.machine))!.data(), before);
    t.is(f.item.owner, entryUmi.identity.publicKey);
  });
}

test('R5-02/R5-20: only the seller or authority may forfeit an unsold pooled share', async (t) => {
  const f = await fixture('sol', false);
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  const before = getSvm().getAccount(publicKeyBytes(f.machine))!.data();
  const sellerBefore = await lamports(f.umi);
  await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
    message: /Error Number: 6037/,
  });
  t.deepEqual(getSvm().getAccount(publicKeyBytes(f.machine))!.data(), before);
  t.is(await lamports(f.umi), sellerBefore);
  await f
    .refund(undefined, undefined, undefined, { payer: f.umi.identity })
    .sendAndConfirm(f.caller);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
  await settleRecovered(f, f.item, 0).sendAndConfirm(f.caller);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
});

for (const attempt of ['unsold', 'claimed']) {
  test(`R6-01: ${attempt}-first settlement pays partial then equal final collab shares`, async (t) => {
    const f = await fixture('sol', true, 3);
    const sellers = [
      f.umi,
      await createCnftUmi(createUmi),
      await createCnftUmi(createUmi),
    ];
    const keys = sellers.map((seller) => seller.identity.publicKey);
    const items = [f.item];
    const machine = await fetchGumballMachine(f.umi, f.machine);
    await updateSettings(f.umi, {
      gumballMachine: f.machine,
      settings: {
        ...machine.settings,
        sellersMerkleRoot: some(getSellerMerkleRoot(keys)),
      },
    }).sendAndConfirm(f.umi);
    for (let index = 1; index < 3; index += 1) {
      const seller = sellers[index];
      const item = await mintCnft(seller);
      await addCnftV2(seller, {
        gumballMachine: f.machine,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        leafDelegate: item.owner,
        args: cnftArgs(seller, item),
        addItemArgs: {
          sellerProofPath: some(getSellerMerkleProof(keys, keys[index])),
        },
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(seller, item).proof))
        .sendAndConfirm(seller);
      item.owner = f.escrow;
      items.push(item);
    }
    await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    await f.drawItem();
    await f.drawItem();
    await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    const drawn = (await fetchGumballMachine(f.umi, f.machine)).items.filter(
      (i) => i.isDrawn
    );
    const claimed = drawn[0].index;
    const refunded = drawn[1].index;
    const unsold = [0, 1, 2].find(
      (index) => index !== claimed && index !== refunded
    )!;
    await claimCnftV2(f.caller, {
      gumballMachine: f.machine,
      index: claimed,
      seller: keys[claimed],
      buyer: f.buyer.identity.publicKey,
      treeConfig: items[claimed].treeConfig,
      merkleTree: items[claimed].merkleTree,
      args: cnftArgs(f.umi, items[claimed]),
    })
      .addRemainingAccounts(
        proofAccounts(getCnftProof(f.umi, items[claimed]).proof)
      )
      .sendAndConfirm(f.caller);
    items[claimed].owner = f.buyer.identity.publicKey;
    const target = items[refunded];
    await setPermanentCollection(
      sellers[refunded],
      target,
      'PermanentBurnDelegate'
    );
    await burnV2(sellers[refunded], mutationArgs(f.umi, target)).sendAndConfirm(
      sellers[refunded]
    );
    const rents = keys.map((seller) =>
      getSvm()
        .getAccount(
          publicKeyBytes(
            findSellerHistoryPda(f.umi, {
              gumballMachine: f.machine,
              seller,
            })[0]
          )
        )!
        .lamports()
    );
    const before = await Promise.all(keys.map((key) => lamports(f.umi, key)));
    const index = attempt === 'unsold' ? unsold : claimed;
    await settle(
      f,
      items[index],
      index,
      index === claimed ? f.buyer.identity.publicKey : defaultPublicKey(),
      keys[0],
      keys[index]
    ).sendAndConfirm(f.caller);
    items[index].owner =
      index === claimed ? f.buyer.identity.publicKey : keys[index];
    const partial = await fetchGumballMachine(f.umi, f.machine);
    t.is(partial.totalProceedsSettled, 333_333_333n);
    t.is(partial.itemsSettled, 0n);
    t.is((await lamports(f.umi, keys[index])) - before[index], 333_333_333n);
    const empty = emptyProof(target);
    const buyerBefore = await f.balance();
    await f
      .refund(null, empty.root, empty.proof, {
        index: refunded,
        seller: keys[refunded],
        merkleTree: target.merkleTree,
      })
      .sendAndConfirm(f.caller);
    t.is((await f.balance()) - buyerBefore, 1_000_000_000n);
    for (const indexToSettle of [unsold, claimed])
      await settle(
        f,
        items[indexToSettle],
        indexToSettle,
        indexToSettle === claimed
          ? f.buyer.identity.publicKey
          : defaultPublicKey(),
        keys[0],
        keys[indexToSettle]
      ).sendAndConfirm(f.caller);
    for (const indexToCheck of [0, 1, 2])
      t.is(
        (await lamports(f.umi, keys[indexToCheck])) -
          before[indexToCheck] -
          rents[indexToCheck],
        indexToCheck === refunded ? 0n : 500_000_000n
      );
    const after = await fetchGumballMachine(f.umi, f.machine);
    t.is(after.totalRevenue, 1_000_000_000n);
    t.is(after.totalProceedsSettled, 1_000_000_000n);
    t.is(after.refundReserve, 0n);
    t.is(after.itemsSettled, 3n);
  });
}

test('R5-02/R5-20: deliverable unsold collab inventory cannot lose its pooled share to recovery', async (t) => {
  const f = await fixture('sol', true, 2);
  const sellerB = await createCnftUmi(createUmi);
  const sellers = [f.umi, sellerB];
  const keys = sellers.map((seller) => seller.identity.publicKey);
  const machine = await fetchGumballMachine(f.umi, f.machine);
  await updateSettings(f.umi, {
    gumballMachine: f.machine,
    settings: {
      ...machine.settings,
      sellersMerkleRoot: some(getSellerMerkleRoot([keys[1]])),
    },
  }).sendAndConfirm(f.umi);
  const other = await mintCnft(sellerB);
  await addCnftV2(sellerB, {
    gumballMachine: f.machine,
    treeConfig: other.treeConfig,
    merkleTree: other.merkleTree,
    leafDelegate: other.owner,
    args: cnftArgs(sellerB, other),
    addItemArgs: { sellerProofPath: some([]) },
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(sellerB, other).proof))
    .sendAndConfirm(sellerB);
  other.owner = f.escrow;
  const items = [f.item, other];
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  const sold = (await fetchGumballMachine(f.umi, f.machine)).items.find(
    (i) => i.isDrawn
  )!.index;
  const unsold = 1 - sold;
  const target = items[unsold];
  const seller = sellers[unsold];
  const collection = generateSigner(seller);
  await createCollection(seller, {
    collection,
    name: 'Deliverable collab collection',
    uri: '',
    plugins: [{ type: 'BubblegumV2' }],
  }).sendAndConfirm(seller);
  await setCollectionV2(seller, {
    ...mutationArgs(seller, target),
    metadata: target.metadata,
    newCoreCollection: collection.publicKey,
  }).sendAndConfirm(seller);
  target.collection = collection.publicKey;
  target.metadata = {
    ...target.metadata,
    collection: some(collection.publicKey),
  };
  target.metaHash = hash(
    getMetadataArgsV2Serializer().serialize(target.metadata)
  );
  addLargeCollectionAttributes(collection.publicKey, 17_000);
  const snapshot = getSvm().getAccount(publicKeyBytes(f.machine))!.data();
  const before = await Promise.all(keys.map((key) => lamports(f.umi, key)));
  const rents = keys.map((key) =>
    getSvm()
      .getAccount(
        publicKeyBytes(
          findSellerHistoryPda(f.umi, {
            gumballMachine: f.machine,
            seller: key,
          })[0]
        )
      )!
      .lamports()
  );
  const refund = (payer = f.caller.identity) =>
    f.refund(
      evidence(target),
      publicKeyBytes(getCnftProof(seller, target).root),
      getCnftProof(seller, target).proof,
      {
        index: unsold,
        seller: keys[unsold],
        buyer: null,
        merkleTree: target.merkleTree,
        coreCollection: collection.publicKey,
        payer,
      }
    );
  await t.throwsAsync(refund().sendAndConfirm(f.caller), {
    message: /Error Number: 6037/,
  });
  await t.throwsAsync(refund(seller.identity).sendAndConfirm(f.caller), {
    message: /Error Number: 6074/,
  });
  await t.throwsAsync(
    f
      .adminRefund(
        evidence(target),
        publicKeyBytes(getCnftProof(seller, target).root),
        getCnftProof(seller, target).proof,
        {
          index: unsold,
          seller: keys[unsold],
          buyer: null,
          merkleTree: target.merkleTree,
        },
        f.umi.identity
      )
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6037/ }
  );
  t.deepEqual(getSvm().getAccount(publicKeyBytes(f.machine))!.data(), snapshot);
  t.deepEqual(
    await Promise.all(keys.map((key) => lamports(f.umi, key))),
    before
  );
  await claimCnftV2(f.caller, {
    gumballMachine: f.machine,
    index: sold,
    seller: keys[sold],
    buyer: f.buyer.identity.publicKey,
    treeConfig: items[sold].treeConfig,
    merkleTree: items[sold].merkleTree,
    args: cnftArgs(f.umi, items[sold]),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(f.umi, items[sold]).proof))
    .sendAndConfirm(f.caller);
  items[sold].owner = f.buyer.identity.publicKey;
  const beforeSettle = await Promise.all(
    keys.map((key) => lamports(f.umi, key))
  );
  for (const index of [unsold, sold])
    await settle(
      f,
      items[index],
      index,
      index === sold ? f.buyer.identity.publicKey : defaultPublicKey(),
      keys[0],
      keys[index]
    ).sendAndConfirm(f.caller);
  for (const index of [0, 1])
    t.is(
      (await lamports(f.umi, keys[index])) - beforeSettle[index] - rents[index],
      500_000_000n
    );
  t.is(
    (await fetchGumballMachine(f.umi, f.machine)).totalProceedsSettled,
    1_000_000_000n
  );
});

const attachRecoveryCollection = async (
  f: any,
  item = f.item,
  name = 'Shape fixture'
) => {
  const collection = generateSigner(f.umi);
  await createCollection(f.umi, {
    collection,
    name,
    uri: '',
    plugins: [{ type: 'BubblegumV2' }],
  }).sendAndConfirm(f.umi);
  await setCollectionV2(f.umi, {
    ...mutationArgs(f.umi, item),
    metadata: item.metadata,
    newCoreCollection: collection.publicKey,
  }).sendAndConfirm(f.umi);
  item.collection = collection.publicKey;
  item.metadata = { ...item.metadata, collection: some(collection.publicKey) };
  item.metaHash = hash(getMetadataArgsV2Serializer().serialize(item.metadata));
  return collection.publicKey;
};
const claimRecoveryItem = (
  f: any,
  item = f.item,
  index = 0,
  seller = f.umi.identity.publicKey
) =>
  claimCnftV2(f.caller, {
    gumballMachine: f.machine,
    index,
    seller,
    buyer: f.buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    coreCollection: item.collection,
    args: cnftArgs(f.umi, item),
  }).addRemainingAccounts(proofAccounts(getCnftProof(f.umi, item).proof));

for (const count of [170, 180, 200]) {
  test(`R6-02/R6-17: ${count} short attributes use actual transfer and admin recovery`, async (t) => {
    const f = await fixture();
    const collection = await attachRecoveryCollection(f);
    addLargeCollectionAttributes(collection, 1, count);
    const size = getSvm().getAccount(publicKeyBytes(collection))!.data().length;
    t.true(size < 2200);
    await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
      message: /Error Number: 6074/,
    });
    const claim = claimRecoveryItem(f);
    const simulation = await f.caller.rpc.simulateTransaction(
      await claim.buildAndSign(f.caller)
    );
    t.log(
      `${count} short attributes: ${size} bytes; claim ${simulation.err ? 'fails' : 'succeeds'}`
    );
    if (count === 170) {
      t.is(simulation.err, null);
      await claim.sendAndConfirm(f.caller);
    } else {
      t.not(simulation.err, null);
      await t.throwsAsync(claim.sendAndConfirm(f.caller), {
        message: /memory allocation failed/,
      });
      await t.throwsAsync(
        f
          .adminRefund(undefined, undefined, undefined, {}, f.caller.identity)
          .sendAndConfirm(f.caller),
        { message: /Error Number: 6037/ }
      );
      await t.throwsAsync(
        f.adminRefund(undefined, new Uint8Array(32)).sendAndConfirm(f.caller),
        { message: /Error Number: 6075/ }
      );
      const before = await f.balance();
      const refund = f.adminRefund();
      const tx = await refund.buildAndSign(f.caller);
      const sim = await f.caller.rpc.simulateTransaction(tx);
      t.is(sim.err, null);
      t.log(
        `admin refund: ${sim.unitsConsumed} CU, ${toWeb3JsTransaction(tx).serialize().length} bytes`
      );
      await refund.sendAndConfirm(f.caller);
      t.is((await f.balance()) - before, f.price);
      await f.close();
    }
  });
}

for (const size of [30_000, 60_000]) {
  for (const entry of [false, true]) {
    test(`R6-02: ${size}-byte AppData is deliverable ${entry ? 'at entry' : 'after escrow'} and never refund evidence`, async (t) => {
      const f = await fixture('sol', true, 1, 5, { skipAdd: entry });
      const collection = await attachRecoveryCollection(f);
      addCollectionExternalAdapters(f.umi, collection, 1, size);
      t.true(
        getSvm().getAccount(publicKeyBytes(collection))!.data().length > size
      );
      if (entry) {
        await f.add(f.item);
        await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(
          f.umi
        );
        await f.drawItem();
      }
      const before = await f.balance();
      await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
        message: /Error Number: 6074/,
      });
      t.is(await f.balance(), before);
      const claim = claimRecoveryItem(f);
      t.is(
        (
          await f.caller.rpc.simulateTransaction(
            await claim.buildAndSign(f.caller)
          )
        ).err,
        null
      );
      await claim.sendAndConfirm(f.caller);
      t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, 0n);
    });
  }
}

for (const refundFirst of [false, true]) {
  test(`R7-04: unsold recovery ${refundFirst ? 'before' : 'after'} payouts preserves shares and closes`, async (t) => {
    const f = await fixture('sol', true, 3);
    const items = [f.item];
    for (let i = 1; i < 3; i += 1) {
      const item = await mintCnft(f.umi);
      await f.add(item);
      items.push(item);
    }
    await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    await f.drawItem();
    await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    const machine = await fetchGumballMachine(f.umi, f.machine);
    const sold = machine.items.find((i) => i.isDrawn)!.index;
    const target = machine.items.find((i) => !i.isDrawn)!.index;
    const other = 3 - sold - target;
    const item = items[target];
    await setPermanentCollection(f.umi, item, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, item)).sendAndConfirm(f.umi);
    const empty = emptyProof(item);
    const recover = () =>
      f
        .refund(null, empty.root, empty.proof, {
          index: target,
          merkleTree: item.merkleTree,
          buyer: null,
          payer: f.umi.identity,
        })
        .sendAndConfirm(f.caller);
    await claimRecoveryItem(f, items[sold], sold).sendAndConfirm(f.caller);
    items[sold].owner = f.buyer.identity.publicKey;
    if (refundFirst) await recover();
    const before = await lamports(f.umi);
    await settle(
      f,
      items[sold],
      sold,
      f.buyer.identity.publicKey
    ).sendAndConfirm(f.caller);
    t.is((await lamports(f.umi)) - before, 333_333_333n);
    if (!refundFirst) await recover();
    await settleRecovered(f, item, target, true).sendAndConfirm(f.caller);
    await settle(f, items[other], other).sendAndConfirm(f.caller);
    const final = await fetchGumballMachine(f.umi, f.machine);
    t.is(final.itemsSettled, 3n);
    t.is(final.totalProceedsSettled, f.price);
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
  });
}

test('R6-17: measure adjacent single-attribute heap boundaries for this fixture', async (t) => {
  const f = await fixture();
  const collection = await attachRecoveryCollection(f);
  const key = publicKeyBytes(collection);
  const original = getSvm().getAccount(key)!;
  addLargeCollectionAttributes(collection, 0);
  const overhead = getSvm().getAccount(key)!.data().length;
  let low = 22_156;
  let high = 22_214;
  while (high - low > 1) {
    const size = Math.floor((low + high) / 2);
    getSvm().setAccount(key, original);
    addLargeCollectionAttributes(collection, size - overhead);
    t.is(getSvm().getAccount(key)!.data().length, size);
    const sim = await f.caller.rpc.simulateTransaction(
      await claimRecoveryItem(f).buildAndSign(f.caller)
    );
    if (sim.err === null) low = size;
    else high = size;
  }
  t.is(high, low + 1);
  t.log(
    `single-attribute fixture: last transferable ${low} bytes, first allocation failure ${high} bytes`
  );
  getSvm().setAccount(key, original);
  addLargeCollectionAttributes(collection, low - overhead);
  t.is(
    (
      await f.caller.rpc.simulateTransaction(
        await claimRecoveryItem(f).buildAndSign(f.caller)
      )
    ).err,
    null
  );
  getSvm().setAccount(key, original);
  addLargeCollectionAttributes(collection, high - overhead);
  await t.throwsAsync(claimRecoveryItem(f).sendAndConfirm(f.caller), {
    message: /memory allocation failed/,
  });
  await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
    message: /Error Number: 6074/,
  });
  const before = await f.balance();
  await f.adminRefund().sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, f.price);
});

for (const resolution of ['refund', 'claim']) {
  for (const partialFirst of [false, true]) {
    test(`R6-01/R6-02: collab stuck draw ${resolution}, partial-first=${partialFirst} preserves seller payouts`, async (t) => {
      const f = await fixture('sol', true, 2);
      const sellerB = await createCnftUmi(createUmi);
      const other = await mintCnft(sellerB);
      const machine = await fetchGumballMachine(f.umi, f.machine);
      await updateSettings(f.umi, {
        gumballMachine: f.machine,
        settings: {
          ...machine.settings,
          sellersMerkleRoot: some(
            getSellerMerkleRoot([sellerB.identity.publicKey])
          ),
        },
      }).sendAndConfirm(f.umi);
      await addCnftV2(sellerB, {
        gumballMachine: f.machine,
        treeConfig: other.treeConfig,
        merkleTree: other.merkleTree,
        leafDelegate: other.owner,
        args: cnftArgs(sellerB, other),
        addItemArgs: { sellerProofPath: some([]) },
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(sellerB, other).proof))
        .sendAndConfirm(sellerB);
      other.owner = f.escrow;
      await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(
        f.umi
      );
      await f.drawItem();
      await f.drawItem();
      const collection = await attachRecoveryCollection(
        { ...f, umi: sellerB },
        other
      );
      const key = publicKeyBytes(collection);
      const original = getSvm().getAccount(key)!;
      addLargeCollectionAttributes(collection, 1, 200);
      await claimRecoveryItem(f).sendAndConfirm(f.caller);
      f.item.owner = f.buyer.identity.publicKey;
      await t.throwsAsync(
        claimRecoveryItem(
          f,
          other,
          1,
          sellerB.identity.publicKey
        ).sendAndConfirm(f.caller),
        { message: /memory allocation failed/ }
      );
      const refundArgs = {
        index: 1,
        merkleTree: other.merkleTree,
        seller: sellerB.identity.publicKey,
      };
      const root = publicKeyBytes(getCnftProof(f.umi, other).root);
      const proof = getCnftProof(f.umi, other).proof;
      await t.throwsAsync(
        f
          .refund(evidence(other), root, proof, refundArgs)
          .sendAndConfirm(f.caller),
        { message: /Error Number: 6074/ }
      );
      const sellerBefore = await lamports(f.umi);
      const rent = historyRent(f);
      let closeFee = 0n;
      if (partialFirst) {
        const settleBuilder = settle(f, f.item, 0, f.buyer.identity.publicKey);
        const tx = await settleBuilder.buildAndSign(f.caller);
        const sim = await f.caller.rpc.simulateTransaction(tx);
        t.is(sim.err, null);
        t.log(
          `partial collab settle: ${sim.unitsConsumed} CU, ${toWeb3JsTransaction(tx).serialize().length} bytes`
        );
        await settleBuilder.sendAndConfirm(f.caller);
        t.is((await lamports(f.umi)) - sellerBefore, 500_000_000n);
        const state = await fetchGumballMachine(f.umi, f.machine);
        t.is(state.refundReserve, f.price);
        t.is(state.outstandingDraws, 1n);
        t.is(state.itemsSettled, 0n);
        t.is(state.itemProceedsPaid![0], 500_000_000n);
        await settle(f, f.item, 0, f.buyer.identity.publicKey).sendAndConfirm(
          f.caller
        );
        t.is((await lamports(f.umi)) - sellerBefore, 500_000_000n);
        const beforeClose = await lamports(f.umi);
        await t.throwsAsync(f.close(), { message: /Error Number: 6047/ });
        closeFee = beforeClose - (await lamports(f.umi));
      }
      const sellerAfterPartial = await lamports(f.umi);
      const buyerBefore = await f.balance();
      if (resolution === 'refund') {
        await f
          .adminRefund(evidence(other), root, proof, refundArgs)
          .sendAndConfirm(f.caller);
        t.is((await f.balance()) - buyerBefore, f.price);
      } else {
        getSvm().setAccount(key, original);
        await claimRecoveryItem(
          f,
          other,
          1,
          sellerB.identity.publicKey
        ).sendAndConfirm(f.caller);
        other.owner = f.buyer.identity.publicKey;
        await settle(
          f,
          other,
          1,
          f.buyer.identity.publicKey,
          f.umi.identity.publicKey,
          sellerB.identity.publicKey
        ).sendAndConfirm(f.caller);
      }
      const adminFees = sellerAfterPartial - (await lamports(f.umi));
      await settle(f, f.item, 0, f.buyer.identity.publicKey).sendAndConfirm(
        f.caller
      );
      t.is(
        (await lamports(f.umi)) - sellerBefore - rent + adminFees + closeFee,
        f.price
      );
      const final = await fetchGumballMachine(f.umi, f.machine);
      t.is(final.itemsSettled, 2n);
      t.is(final.outstandingDraws, 0n);
      t.is(final.refundReserve, 0n);
      t.is(
        final.totalProceedsSettled,
        resolution === 'refund' ? f.price : f.price * 2n
      );
      await f.close();
    });
  }
}

for (const blocked of [false, true]) {
  test(`R6-02: operator preparation ${blocked ? 'simulates failure before refund' : 'refuses a successful claim'}`, async (t) => {
    const f = await fixture();
    const collection = await attachRecoveryCollection(f);
    if (blocked) addLargeCollectionAttributes(collection, 1, 180);
    const input = {
      authority: f.marketplace.identity,
      claim: {
        gumballMachine: f.machine,
        index: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        coreCollection: collection,
        args: cnftArgs(f.umi, f.item),
      },
      refund: {
        gumballMachine: f.machine,
        index: 0,
        nonce: 0,
        root: publicKeyBytes(getCnftProof(f.umi, f.item).root),
        leaf: evidence(f.item),
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        merkleTree: f.item.merkleTree,
        coreCollection: collection,
      },
      proof: getCnftProof(f.umi, f.item).proof,
    };
    await t.throwsAsync(
      prepareAdminRefundCnftSaleV2(f.caller, {
        ...input,
        claim: { ...input.claim, index: 1 },
      }),
      { message: /same recorded draw/ }
    );
    await t.throwsAsync(
      prepareAdminRefundCnftSaleV2(f.caller, {
        ...input,
        claim: {
          ...input.claim,
          args: { ...input.claim.args, metaHash: new Uint8Array(32) },
        },
      }),
      { message: /metadata must match/ }
    );
    if (blocked) {
      const refund = await prepareAdminRefundCnftSaleV2(f.caller, input);
      const before = await f.balance();
      await refund.sendAndConfirm(f.caller);
      t.is((await f.balance()) - before, f.price);
    } else {
      const before = getSvm().getAccount(publicKeyBytes(f.machine))!.data();
      await t.throwsAsync(prepareAdminRefundCnftSaleV2(f.caller, input), {
        message: /claim succeeds/,
      });
      t.deepEqual(
        getSvm().getAccount(publicKeyBytes(f.machine))!.data(),
        before
      );
      t.false(await f.umi.rpc.accountExists(f.recovery));
    }
  });
}

test('R7-01/R7-22: machine authority and unsigned marketplace key cannot admin-refund a deliverable draw', async (t) => {
  const f = await fixture();
  const before = getSvm().getAccount(publicKeyBytes(f.machine))!.data();
  const balance = await f.balance();
  await t.throwsAsync(
    f
      .adminRefund(undefined, undefined, undefined, {}, f.umi.identity)
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6037/ }
  );
  const unsigned = adminRefundCnftSaleV2(f.caller, {
    gumballMachine: f.machine,
    index: 0,
    nonce: 0,
    root: publicKeyBytes(getCnftProof(f.umi, f.item).root),
    leaf: evidence(f.item),
    seller: f.umi.identity.publicKey,
    buyer: f.buyer.identity.publicKey,
    merkleTree: f.item.merkleTree,
  }).addRemainingAccounts([
    {
      pubkey: f.marketplace.identity.publicKey,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: f.globalConfig, isSigner: false, isWritable: false },
    ...proofAccounts(getCnftProof(f.umi, f.item).proof),
  ]);
  await t.throwsAsync(unsigned.sendAndConfirm(f.caller), {
    message: /Error Number: 6037/,
  });
  t.deepEqual(getSvm().getAccount(publicKeyBytes(f.machine))!.data(), before);
  t.is(await f.balance(), balance);
  t.false(await f.umi.rpc.accountExists(f.recovery));
  await claimRecoveryItem(f, f.item, 0).sendAndConfirm(f.caller);
  t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, 0n);
});

for (const version of [5, 6]) {
  test(`R7-03/R7-06: v${version} pending request locks economics while invite-root updates remain available`, async (t) => {
    const f = await fixture('sol', false, 2, 5, { skipAdd: true });
    const seller = f.caller;
    const item = await mintCnft(seller);
    const initial = await fetchGumballMachine(f.umi, f.machine);
    await updateSettings(f.umi, {
      gumballMachine: f.machine,
      settings: {
        ...initial.settings,
        sellersMerkleRoot: some(
          getSellerMerkleRoot([seller.identity.publicKey])
        ),
      },
    }).sendAndConfirm(f.umi);
    if (version === 6) await f.add(f.item);
    await requestAddCnftV2(seller, {
      gumballMachine: f.machine,
      asset: item.assetId,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      leafDelegate: item.owner,
      args: cnftArgs(seller, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(seller, item).proof))
      .sendAndConfirm(seller);
    item.owner = f.escrow;
    const before = await fetchGumballMachine(f.umi, f.machine);
    t.is(before.version, version);
    for (const settings of [
      { ...before.settings, sellersMerkleRoot: null },
      { ...before.settings, paymentMint: item.assetId },
    ]) {
      await t.throwsAsync(
        updateSettings(f.umi, {
          gumballMachine: f.machine,
          settings,
        }).sendAndConfirm(f.umi),
        { message: /Error Number: 6045/ }
      );
    }
    await updateSettings(f.umi, {
      gumballMachine: f.machine,
      settings: {
        ...before.settings,
        sellersMerkleRoot: some(new Uint8Array(32).fill(7)),
      },
    }).sendAndConfirm(f.umi);
    await approveAddItem(f.umi, {
      gumballMachine: f.machine,
      seller: seller.identity.publicKey,
      asset: item.assetId,
    }).sendAndConfirm(f.umi);
    t.true(
      (await fetchGumballMachine(f.umi, f.machine)).settings.sellersMerkleRoot
        .__option === 'Some'
    );
    if (version === 5) await f.add(f.item);
    await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    await f.drawItem();
    await t.throwsAsync(
      settle(
        f,
        item,
        version === 6 ? 1 : 0,
        f.buyer.identity.publicKey,
        f.umi.identity.publicKey,
        seller.identity.publicKey
      ).sendAndConfirm(f.caller),
      { message: /Error Number: 6036/ }
    );
  });
}

for (const payment of ['sol', 'spl', 'token2022']) {
  test(`R7-05: ${payment} live payout followed by last-draw refund drains proceeds exactly`, async (t) => {
    const f = await fixture(payment, true, 2);
    const other = await mintCnft(f.umi, { creators: [] });
    await f.add(other);
    const escrowBefore = await lamports(f.umi, f.escrow);
    await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    await f.drawItem();
    const first = (await fetchGumballMachine(f.umi, f.machine)).items.find(
      (i) => i.isDrawn
    )!.index;
    const items = [f.item, other];
    await claimRecoveryItem(f, items[first], first).sendAndConfirm(f.caller);
    items[first].owner = f.buyer.identity.publicKey;
    await settle(
      f,
      items[first],
      first,
      f.buyer.identity.publicKey
    ).sendAndConfirm(f.caller);
    const partial = await fetchGumballMachine(f.umi, f.machine);
    t.is(partial.itemsSettled, 0n);
    t.is(partial.totalProceedsSettled, f.price / 2n);
    await f.drawItem();
    const last = 1 - first;
    const target = items[last];
    await setPermanentCollection(f.umi, target, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, target)).sendAndConfirm(f.umi);
    const empty = emptyProof(target);
    const buyerBefore = await f.balance();
    await f
      .refund(null, empty.root, empty.proof, {
        index: last,
        merkleTree: target.merkleTree,
      })
      .sendAndConfirm(f.caller);
    t.is((await f.balance()) - buyerBefore, f.price);
    await settle(
      f,
      items[first],
      first,
      f.buyer.identity.publicKey
    ).sendAndConfirm(f.caller);
    const final = await fetchGumballMachine(f.umi, f.machine);
    t.is(final.itemsSettled, 2n);
    t.is(final.totalProceedsSettled, final.totalRevenue);
    t.is(final.unfinalizedProceeds, 0n);
    if (f.mint) t.is((await fetchToken(f.tokenUmi, f.treasury)).amount, 0n);
    else t.is(await lamports(f.umi, f.escrow), escrowBefore);
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
  });
}

for (const capacity of [637, 638]) {
  test(`R7-13: minimally allocated v5 ledger growth boundary at ${capacity} items`, async (t) => {
    const f = await fixture('sol', false, capacity, 5, { skipAdd: true });
    const key = publicKeyBytes(f.machine);
    const account = getSvm().getAccount(key)!;
    // The client size helper has nineteen padding bytes beyond the program minimum.
    const oldSize = getGumballMachineSizeForItemCount(capacity, 5) - 19;
    getSvm().setAccount(
      key,
      new Account(
        account.lamports(),
        account.data().slice(0, oldSize),
        account.owner(),
        false,
        0n
      )
    );
    if (capacity === 637) {
      await f.add(f.item);
      t.is((await fetchGumballMachine(f.umi, f.machine)).version, 6);
      t.is(
        getSvm().getAccount(key)!.data().length - oldSize,
        40 + 16 * capacity
      );
    } else {
      await t.throwsAsync(f.add(f.item), { message: /Error Number: 6078/ });
      t.is(getSvm().getAccount(key)!.data().length, oldSize);
    }
  });
}

test('R7-13: an invited seller cannot fund ledger rent returned to the machine authority', async (t) => {
  const f = await fixture('sol', false, 1, 5, { skipAdd: true });
  const key = publicKeyBytes(f.machine);
  const account = getSvm().getAccount(key)!;
  getSvm().setAccount(
    key,
    new Account(
      account.lamports(),
      account.data().slice(0, getGumballMachineSizeForItemCount(1, 5)),
      account.owner(),
      false,
      0n
    )
  );
  const item = await mintCnft(f.caller);
  await updateSettings(f.umi, {
    gumballMachine: f.machine,
    settings: {
      ...(await fetchGumballMachine(f.umi, f.machine)).settings,
      sellersMerkleRoot: some(
        getSellerMerkleRoot([f.caller.identity.publicKey])
      ),
    },
  }).sendAndConfirm(f.umi);
  const before = getSvm().getAccount(key)!.data();
  await t.throwsAsync(
    addCnftV2(f.caller, {
      gumballMachine: f.machine,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      leafDelegate: item.owner,
      args: cnftArgs(f.caller, item),
      addItemArgs: { sellerProofPath: some([]) },
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(f.caller, item).proof))
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6079/ }
  );
  t.deepEqual(getSvm().getAccount(key)!.data(), before);
  await requestAddCnftV2(f.caller, {
    gumballMachine: f.machine,
    asset: item.assetId,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    leafDelegate: item.owner,
    args: cnftArgs(f.caller, item),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(f.caller, item).proof))
    .sendAndConfirm(f.caller);
  await approveAddItem(f.umi, {
    gumballMachine: f.machine,
    seller: f.caller.identity.publicKey,
    asset: item.assetId,
  }).sendAndConfirm(f.umi);
  t.is((await fetchGumballMachine(f.umi, f.machine)).version, 6);
});

test('R7-02/R7-04: burnt invited inventory retains its exact pooled share after another seller is paid', async (t) => {
  const f = await fixture('sol', true, 3);
  const sellers = [
    f.umi,
    await createCnftUmi(createUmi),
    await createCnftUmi(createUmi),
  ];
  const keys = sellers.map((s) => s.identity.publicKey);
  await updateSettings(f.umi, {
    gumballMachine: f.machine,
    settings: {
      ...(await fetchGumballMachine(f.umi, f.machine)).settings,
      sellersMerkleRoot: some(getSellerMerkleRoot(keys)),
    },
  }).sendAndConfirm(f.umi);
  const items = [f.item];
  for (let i = 1; i < 3; i += 1) {
    const item = await mintCnft(sellers[i]);
    await addCnftV2(sellers[i], {
      gumballMachine: f.machine,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      leafDelegate: item.owner,
      args: cnftArgs(sellers[i], item),
      addItemArgs: {
        sellerProofPath: some(getSellerMerkleProof(keys, keys[i])),
      },
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(sellers[i], item).proof))
      .sendAndConfirm(sellers[i]);
    item.owner = f.escrow;
    items.push(item);
  }
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  const machine = await fetchGumballMachine(f.umi, f.machine);
  const sold = machine.items.find((i) => i.isDrawn)!.index;
  const lost = machine.items.find(
    (i) => !i.isDrawn && i.seller !== keys[0]
  )!.index;
  const last = 3 - sold - lost;
  const target = items[lost];
  const sender = sellers[lost];
  await t.throwsAsync(
    f
      .adminRefund(
        evidence(target),
        publicKeyBytes(getCnftProof(sender, target).root),
        getCnftProof(sender, target).proof,
        {
          index: lost,
          merkleTree: target.merkleTree,
          seller: keys[lost],
          buyer: null,
        },
        f.umi.identity
      )
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6037/ }
  );
  await claimCnftV2(f.caller, {
    gumballMachine: f.machine,
    index: sold,
    seller: keys[sold],
    buyer: f.buyer.identity.publicKey,
    treeConfig: items[sold].treeConfig,
    merkleTree: items[sold].merkleTree,
    args: cnftArgs(sellers[sold], items[sold]),
  })
    .addRemainingAccounts(
      proofAccounts(getCnftProof(sellers[sold], items[sold]).proof)
    )
    .sendAndConfirm(f.caller);
  items[sold].owner = f.buyer.identity.publicKey;
  await settle(
    f,
    items[sold],
    sold,
    f.buyer.identity.publicKey,
    keys[0],
    keys[sold]
  ).sendAndConfirm(f.caller);
  t.is(
    (await fetchGumballMachine(f.umi, f.machine)).totalProceedsSettled,
    333_333_333n
  );
  await setPermanentCollection(sender, target, 'PermanentBurnDelegate');
  await burnV2(sender, mutationArgs(sender, target)).sendAndConfirm(sender);
  const empty = emptyProof(target);
  const history = findSellerHistoryPda(sender, {
    gumballMachine: f.machine,
    seller: keys[lost],
  })[0];
  const rent = getSvm().getAccount(publicKeyBytes(history))!.lamports();
  await f
    .refund(null, empty.root, empty.proof, {
      index: lost,
      merkleTree: target.merkleTree,
      seller: keys[lost],
      buyer: null,
      payer: sender.identity,
    })
    .sendAndConfirm(f.caller);
  const before = await lamports(sender);
  await settleRecovered(f, target, lost, true, keys[lost]).sendAndConfirm(
    f.caller
  );
  t.is((await lamports(sender)) - before - rent, 333_333_333n);
  await settle(
    f,
    items[last],
    last,
    defaultPublicKey(),
    keys[0],
    keys[last]
  ).sendAndConfirm(f.caller);
  const final = await fetchGumballMachine(f.umi, f.machine);
  t.is(final.itemsSettled, 3n);
  t.is(final.totalProceedsSettled, f.price);
  await f.close();
  t.false(await f.umi.rpc.accountExists(f.machine));
});

test('R8-03: marketplace reclaim survives a closed machine address being recreated', async (t) => {
  const f = await fixture();
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  await f.refund().sendAndConfirm(f.caller);
  await f.close();
  await createAccount(f.umi, {
    newAccount: f.machineSigner,
    space: 1,
    lamports: sol(0.01),
    programId: defaultPublicKey(),
  }).sendAndConfirm(f.umi);
  t.is(getSvm().getAccount(publicKeyBytes(f.machine))!.data().length, 1);
  await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 0;
  const reclaim = f.reclaim();
  const tx = await reclaim.buildAndSign(f.marketplace);
  const sim = await f.marketplace.rpc.simulateTransaction(tx);
  t.is(sim.err, null);
  t.log(
    `reused-address reclaim: ${sim.unitsConsumed} CU, ${toWeb3JsTransaction(tx).serialize().length} bytes`
  );
  await reclaim.sendAndConfirm(f.marketplace);
  t.false(await f.umi.rpc.accountExists(f.recovery));
  f.item.owner = f.umi.identity.publicKey;
  // A current seller transfer proves that the original seller received the leaf.
  await transferV2(f.umi, {
    ...mutationArgs(f.umi, f.item),
    newLeafOwner: f.caller.identity.publicKey,
  }).sendAndConfirm(f.umi);
});

for (const type of [
  'PermanentTransferDelegate',
  'PermanentBurnDelegate',
  'PermanentFreezeDelegate',
]) {
  for (const choice of ['claim', 'settle', 'refund']) {
    test(`R8-16: buyer may ${choice} after escrowed collection gains ${type}`, async (t) => {
      const f = await fixture();
      await setPermanentCollection(f.umi, f.item, type);
      if (choice === 'claim' || choice === 'settle') {
        if (choice === 'claim')
          await claimRecoveryItem(f, f.item, 0).sendAndConfirm(f.caller);
        else
          await settle(f, f.item, 0, f.buyer.identity.publicKey).sendAndConfirm(
            f.caller
          );
        t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, 0n);
        await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
          message:
            choice === 'settle'
              ? /AccountNotInitialized/
              : /Error Number: 6074/,
        });
        return;
      }
      const substitute = generateSigner(f.umi);
      await createCollection(f.umi, {
        collection: substitute,
        name: 'Unrelated permanent collection',
        uri: '',
        plugins: [{ type: 'BubblegumV2' }, { type: 'PermanentBurnDelegate' }],
      }).sendAndConfirm(f.umi);
      const build = (overrides: any = {}) =>
        f.refund(undefined, undefined, undefined, {
          coreCollection: f.item.collection,
          payer: f.buyer.identity,
          ...overrides,
        });
      await t.throwsAsync(
        build({ coreCollection: substitute.publicKey }).sendAndConfirm(f.buyer),
        { message: /Error Number: 6076/ }
      );
      await t.throwsAsync(
        build({ payer: f.caller.identity }).sendAndConfirm(f.caller),
        { message: /Error Number: 6037/ }
      );
      await t.throwsAsync(
        build({ merkleTree: f.caller.identity.publicKey }).sendAndConfirm(
          f.buyer
        ),
        { message: /Error Number: 6069/ }
      );
      const refund = build();
      const tx = await refund.buildAndSign(f.buyer);
      const sim = await f.buyer.rpc.simulateTransaction(tx);
      t.is(sim.err, null);
      t.log(
        `${type} buyer refund: ${sim.unitsConsumed} CU, ${toWeb3JsTransaction(tx).serialize().length} bytes`
      );
      const before = await f.balance();
      const receiptRent = await f.umi.rpc.getRent(208);
      await refund.sendAndConfirm(f.buyer);
      t.is(
        (await f.balance()) - before + receiptRent.basisPoints + 5000n,
        f.price
      );
      t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
      t.is(
        (await fetchCnftRecovery(f.umi, f.recovery)).rentPayer,
        f.buyer.identity.publicKey
      );
      await f.close();
    });
  }
}

test('R8-16: collection evidence cannot forfeit an unsold item or substitute for a valid current proof', async (t) => {
  const unsold = await fixture('sol', false);
  await setPermanentCollection(
    unsold.umi,
    unsold.item,
    'PermanentBurnDelegate'
  );
  await t.throwsAsync(
    unsold
      .refund(undefined, undefined, undefined, {
        coreCollection: unsold.item.collection,
        payer: unsold.umi.identity,
      })
      .sendAndConfirm(unsold.umi),
    { message: /Error Number: 6074/ }
  );
  const f = await fixture();
  await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
  const fake = { ...evidence(f.item), dataHash: new Uint8Array(32).fill(77) };
  await t.throwsAsync(
    f
      .refund(fake, undefined, undefined, {
        coreCollection: f.item.collection,
        payer: f.buyer.identity,
      })
      .sendAndConfirm(f.buyer),
    {
      message:
        /Invalid root recomputed from proof|InvalidRoot|LeafContentsModified/,
    }
  );
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
});

test('R8-15: v6 normal draws cannot refill mid-sale and sellout ends the sale', async (t) => {
  const f = await fixture('sol', true, 2);
  const other = await mintCnft(f.umi, { creators: [] });
  await f.add(other);
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  const items = [f.item, other];
  const first = (await fetchGumballMachine(f.umi, f.machine)).items.find(
    (i) => i.isDrawn
  )!.index;
  await claimRecoveryItem(f, items[first], first).sendAndConfirm(f.caller);
  items[first].owner = f.buyer.identity.publicKey;
  await settle(
    f,
    items[first],
    first,
    f.buyer.identity.publicKey
  ).sendAndConfirm(f.caller);
  const replacement = await mintCnft(f.umi, { creators: [] });
  const readd = () =>
    addCnftV2(f.umi, {
      gumballMachine: f.machine,
      treeConfig: replacement.treeConfig,
      merkleTree: replacement.merkleTree,
      leafDelegate: replacement.owner,
      args: cnftArgs(f.umi, replacement),
      addItemArgs: { index: first },
    }).addRemainingAccounts(
      proofAccounts(getCnftProof(f.umi, replacement).proof)
    );
  await t.throwsAsync(readd().sendAndConfirm(f.umi), {
    message: /Error Number: 6036/,
  });
  await f.drawItem();
  const last = 1 - first;
  await claimRecoveryItem(f, items[last], last).sendAndConfirm(f.caller);
  items[last].owner = f.buyer.identity.publicKey;
  await settle(f, items[last], last, f.buyer.identity.publicKey).sendAndConfirm(
    f.caller
  );
  await t.throwsAsync(readd().sendAndConfirm(f.umi), {
    message: /Error Number: 6036/,
  });
  await settle(
    f,
    items[first],
    first,
    f.buyer.identity.publicKey
  ).sendAndConfirm(f.caller);
  t.is((await fetchGumballMachine(f.umi, f.machine)).unfinalizedProceeds, 0n);
  t.is(
    (await fetchGumballMachine(f.umi, f.machine)).state,
    GumballState.SaleEnded
  );
  await t.throwsAsync(readd().sendAndConfirm(f.umi), {
    message: /Error Number: 6036/,
  });
});

for (const payment of ['spl', 'token2022']) {
  for (const admin of [false, true]) {
    test(`R13-03: ${payment} ${admin ? 'admin' : 'proof'} refund parks and releases collab proceeds`, async (t) => {
      const f = await fixture(payment, true, 2);
      const invited = await createCnftUmi(createUmi);
      const keys = [f.umi.identity.publicKey, invited.identity.publicKey];
      const machine = await fetchGumballMachine(f.umi, f.machine);
      await updateSettings(f.umi, {
        gumballMachine: f.machine,
        settings: {
          ...machine.settings,
          sellersMerkleRoot: some(getSellerMerkleRoot(keys)),
        },
      }).sendAndConfirm(f.umi);
      const honest = await mintCnft(invited);
      await addCnftV2(invited, {
        gumballMachine: f.machine,
        treeConfig: honest.treeConfig,
        merkleTree: honest.merkleTree,
        leafDelegate: honest.owner,
        args: cnftArgs(invited, honest),
        addItemArgs: {
          sellerProofPath: some(getSellerMerkleProof(keys, keys[1])),
        },
      })
        .addRemainingAccounts(
          proofAccounts(getCnftProof(invited, honest).proof)
        )
        .sendAndConfirm(invited);
      honest.owner = f.escrow;
      await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(
        f.umi
      );
      await f.drawItem();
      await f.drawItem();
      await claimCnftV2(f.buyer, {
        gumballMachine: f.machine,
        index: 1,
        seller: keys[1],
        buyer: f.buyer.identity.publicKey,
        merkleTree: honest.merkleTree,
        treeConfig: honest.treeConfig,
        args: cnftArgs(f.buyer, honest),
      })
        .addRemainingAccounts(
          proofAccounts(getCnftProof(f.buyer, honest).proof)
        )
        .sendAndConfirm(f.buyer);
      honest.owner = f.buyer.identity.publicKey;
      await settle(
        f,
        honest,
        1,
        f.buyer.identity.publicKey,
        keys[0],
        keys[1]
      ).sendAndConfirm(f.caller);
      t.is((await fetchGumballMachine(f.caller, f.machine)).itemsSettled, 0n);
      await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
      await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
      if (payment === 'spl')
        await reassignTokenOwner(
          f.buyer,
          f.buyerAta,
          f.caller.identity.publicKey
        );
      else await requireMemo(f.buyer, f.buyerAta);
      const empty = emptyProof(f.item);
      await measureInstruction(
        f.caller,
        (admin ? f.adminRefund : f.refund)(null, empty.root, empty.proof),
        t,
        admin ? 'admin_refund_cnft_sale_v2' : 'refund_cnft_sale_v2'
      );
      const ledger = (await f.caller.rpc.getAccount(f.escrow))!;
      t.is(ledger.data.length, 112);
      t.is(
        new DataView(ledger.data.buffer, ledger.data.byteOffset).getBigUint64(
          64,
          true
        ),
        f.price
      );
      const refunded = await fetchGumballMachine(f.caller, f.machine);
      t.is(refunded.refundReserve, 0n);
      t.is(refunded.outstandingDraws, 0n);
      await settle(
        f,
        honest,
        1,
        f.buyer.identity.publicKey,
        keys[0],
        keys[1]
      ).sendAndConfirm(f.caller);
      const sellerAta = findAssociatedTokenPda(f.tokenUmi, {
        owner: keys[1],
        mint: f.mint.publicKey,
        tokenProgramId: getSplTokenProgramId(f.tokenUmi),
      })[0];
      t.is((await fetchToken(f.caller, sellerAta)).amount, f.price);
      t.is((await fetchGumballMachine(f.caller, f.machine)).itemsSettled, 2n);
      await f.close();
      t.false((await f.caller.rpc.getAccount(f.machine)).exists);
      if (payment === 'spl')
        await reassignTokenOwner(
          f.caller,
          f.buyerAta,
          f.buyer.identity.publicKey
        );
      else await disableMemo(f.buyer, f.buyerAta);
      await withdrawPayout(f.caller, {
        gumballMachine: f.machine,
        recipient: f.buyer.identity,
        rentPayer: f.caller.identity.publicKey,
        amount: f.price,
        paymentMint: f.mint.publicKey,
        tokenProgram: getSplTokenProgramId(f.tokenUmi),
        authorityPdaPaymentAccount: f.treasury,
        recipientPaymentAccount: f.buyerAta,
      }).sendAndConfirm(f.caller);
      t.is((await fetchToken(f.caller, f.buyerAta)).amount, f.price);
      t.is((await f.caller.rpc.getAccount(f.escrow))!.data.length, 0);
    });
  }
}

// The pinned deployed Bubblegum binary requires fee_recipient at index 4,
// which the 5.1.0 builder omits. Keep this adjustment confined to fixtures.
const closeEmptyTree = async (umi: any, item: any) => {
  const feeRecipient = publicKey(
    '2dgJVPC5fjLTBTmMvKDRig9JJUGK2Fgwr3EHShFxckhv'
  );
  if (!getSvm().getAccount(publicKeyBytes(feeRecipient))) {
    getSvm().setAccount(
      publicKeyBytes(feeRecipient),
      new Account(
        1_000_000_000n,
        new Uint8Array(),
        publicKeyBytes(defaultPublicKey()),
        false,
        0n
      )
    );
  }
  await closeTreeV2(umi, {
    merkleTree: item.merkleTree,
    recipient: umi.identity.publicKey,
  })
    .mapInstructions((wrapped) => ({
      ...wrapped,
      instruction: {
        ...wrapped.instruction,
        keys: [
          ...wrapped.instruction.keys.slice(0, 4),
          { pubkey: feeRecipient, isSigner: false, isWritable: true },
          ...wrapped.instruction.keys.slice(4),
        ],
      },
    }))
    .sendAndConfirm(umi);
};

for (const payment of ['sol', 'spl', 'token2022']) {
  for (const admin of [false, true]) {
    test(`R19-01: closed tree ${payment} ${admin ? 'admin' : 'proof'} refund returns the full draw`, async (t) => {
      const f = await fixture(payment);
      // Model a closed recorded tree directly, without depending on collection
      // mutation behavior. The claimed-leaf regression below executes CloseTreeV2.
      for (const key of [f.item.merkleTree, f.item.treeConfig])
        getSvm().setAccount(
          publicKeyBytes(key),
          new Account(
            0n,
            new Uint8Array(),
            publicKeyBytes(defaultPublicKey()),
            false,
            0n
          )
        );
      const before = await f.balance();
      await measureInstruction(
        f.caller,
        (admin ? f.adminRefund : f.refund)(null, new Uint8Array(32), []),
        t,
        admin ? 'admin_refund_cnft_sale_v2' : 'refund_cnft_sale_v2'
      );
      t.is((await f.balance()) - before, f.price);
      const state = await fetchGumballMachine(f.umi, f.machine);
      t.is(state.totalRevenue, 0n);
      t.is(state.refundReserve, 0n);
      t.is(state.outstandingDraws, 0n);
      t.is(state.itemsSettled, 1n);
      t.false(await f.umi.rpc.accountExists(f.recovery));
      await f.close();
      t.false(await f.umi.rpc.accountExists(f.machine));
    });
  }
}

test('R19-01: claimed burnt leaf settles after deployed CloseTreeV2 and returns seller proceeds', async (t) => {
  const f = await fixture();
  await t.throwsAsync(closeEmptyTree(f.umi, f.item), {
    message: /Tree is not empty/,
  });
  await claimRecoveryItem(f).sendAndConfirm(f.caller);
  f.item.owner = f.buyer.identity.publicKey;
  await burnV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(f.buyer);
  await closeEmptyTree(f.umi, f.item);
  t.false(await f.umi.rpc.accountExists(f.item.merkleTree));
  t.false(await f.umi.rpc.accountExists(f.item.treeConfig));
  const rent = historyRent(f);
  const before = await lamports(f.umi);
  const builder = settleRecovered(
    f,
    f.item,
    0,
    true,
    f.umi.identity.publicKey,
    f.buyer.identity.publicKey,
    true
  );
  for (const [overrides, code] of [
    [{ version: 1 }, 6069],
    [{ index: 1 }, 6070],
    [{ flags: 0 }, 6069],
  ] as const) {
    await t.throwsAsync(
      settleRecovered(
        f,
        f.item,
        0,
        true,
        f.umi.identity.publicKey,
        f.buyer.identity.publicKey,
        true,
        overrides
      ).sendAndConfirm(f.caller),
      { message: new RegExp(`Error Number: ${code}`) }
    );
  }
  await t.throwsAsync(
    f.refund(null, new Uint8Array(32), []).sendAndConfirm(f.caller),
    { message: /Error Number: 6049/ }
  );
  await measureInstruction(f.caller, builder, t, 'settle_cnft_sale_v2');
  t.is((await lamports(f.umi)) - before, f.price + rent);
  const state = await fetchGumballMachine(f.umi, f.machine);
  t.is(state.itemsSettled, 1n);
  t.is(state.totalProceedsSettled, f.price);
  await f.close();
  t.false(await f.umi.rpc.accountExists(f.machine));
});

test('R19-01: closed-tree receipt cleanup returns rent after an earlier refund', async (t) => {
  const f = await fixture();
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  await f.refund().sendAndConfirm(f.caller);
  const receiptRent = getSvm()
    .getAccount(publicKeyBytes(f.recovery))!
    .lamports();
  getSvm().setAccount(
    publicKeyBytes(f.item.merkleTree),
    new Account(
      0n,
      new Uint8Array(),
      publicKeyBytes(defaultPublicKey()),
      false,
      0n
    )
  );
  await t.throwsAsync(f.reclaim().sendAndConfirm(f.caller), {
    message: /Error Number: 6069/,
  });
  const close = closeMissingCnftRecoveryV2(f.umi, {
    recovery: f.recovery,
    rentPayer: f.caller.identity.publicKey,
    merkleTree: f.item.merkleTree,
    root: new Uint8Array(32),
    leaf: null,
  });
  const before = await lamports(f.caller);
  await measureInstruction(f.umi, close, t, 'close_missing_cnft_recovery_v2');
  t.is((await lamports(f.caller)) - before, receiptRent);
  t.false(await f.umi.rpc.accountExists(f.recovery));
  await f.close();
});

test('R19-01: closed-tree evidence remains bound to the asset and rejects live-leaf inputs', async (t) => {
  const f = await fixture();
  const unrelated = generateSigner(f.umi).publicKey;
  await t.throwsAsync(
    f
      .refund(null, new Uint8Array(32), [], { merkleTree: unrelated })
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6039/ }
  );
  const savedTree = getSvm().getAccount(publicKeyBytes(f.item.merkleTree))!;
  getSvm().setAccount(
    publicKeyBytes(f.item.merkleTree),
    new Account(
      0n,
      new Uint8Array(),
      publicKeyBytes(defaultPublicKey()),
      false,
      0n
    )
  );
  await t.throwsAsync(f.refund().sendAndConfirm(f.caller), {
    message: /Error Number: 6069/,
  });
  await t.throwsAsync(claimRecoveryItem(f).sendAndConfirm(f.caller), {
    message: /Error Number: 6069/,
  });
  await t.throwsAsync(
    settle(f, f.item, 0, f.buyer.identity.publicKey).sendAndConfirm(f.caller),
    { message: /Error Number: 6069/ }
  );
  await t.throwsAsync(
    f
      .refund(null, new Uint8Array(32), [], { nonce: 1 })
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6039/ }
  );
  // A recreated MPL-owned tree must use current proof verification again.
  getSvm().setAccount(publicKeyBytes(f.item.merkleTree), savedTree);
  await t.throwsAsync(
    f.refund(null, new Uint8Array(32), []).sendAndConfirm(f.caller),
    { message: /Error Number: 6075/ }
  );
  t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, f.price);
});

for (const sold of [false, true]) {
  test(`R19-01: closed ${sold ? 'drawn' : 'unsold'} collab inventory preserves the other seller's proceeds`, async (t) => {
    const f = await fixture('sol', true, 2);
    const invited = await createCnftUmi(createUmi);
    const keys = [f.umi.identity.publicKey, invited.identity.publicKey];
    const settings = (await fetchGumballMachine(f.umi, f.machine)).settings;
    await updateSettings(f.umi, {
      gumballMachine: f.machine,
      settings: {
        ...settings,
        sellersMerkleRoot: some(getSellerMerkleRoot(keys)),
      },
    }).sendAndConfirm(f.umi);
    const item = await mintCnft(invited);
    await addCnftV2(invited, {
      gumballMachine: f.machine,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      leafDelegate: item.owner,
      args: cnftArgs(invited, item),
      addItemArgs: {
        sellerProofPath: some(getSellerMerkleProof(keys, keys[1])),
      },
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(invited, item).proof))
      .sendAndConfirm(invited);
    item.owner = f.escrow;
    await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    await f.drawItem();
    if (sold) await f.drawItem();
    if (!sold)
      await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
    const state = await fetchGumballMachine(f.umi, f.machine);
    // Whichever item remained undrawn is the closed-tree target in that case.
    const targetIndex = sold
      ? 1
      : state.items.find((entry) => !entry.isDrawn)!.index;
    const target = targetIndex === 1 ? item : f.item;
    const seller = keys[targetIndex];
    const otherIndex = 1 - targetIndex;
    const other = otherIndex === 0 ? f.item : item;
    getSvm().setAccount(
      publicKeyBytes(target.merkleTree),
      new Account(
        0n,
        new Uint8Array(),
        publicKeyBytes(defaultPublicKey()),
        false,
        0n
      )
    );
    const history = findSellerHistoryPda(f.umi, {
      gumballMachine: f.machine,
      seller,
    })[0];
    const rent = getSvm().getAccount(publicKeyBytes(history))!.lamports();
    const beforeSeller = await lamports(f.umi, seller);
    const beforeBuyer = await f.balance();
    await f
      .refund(null, new Uint8Array(32), [], {
        index: targetIndex,
        seller,
        merkleTree: target.merkleTree,
        buyer: sold ? f.buyer.identity.publicKey : null,
        payer: sold
          ? f.caller.identity
          : targetIndex === 1
            ? invited.identity
            : f.umi.identity,
      })
      .sendAndConfirm(f.caller);
    t.is((await f.balance()) - beforeBuyer, sold ? f.price : 0n);
    if (!sold) {
      await claimRecoveryItem(
        f,
        other,
        otherIndex,
        keys[otherIndex]
      ).sendAndConfirm(f.caller);
      other.owner = f.buyer.identity.publicKey;
      await settleRecovered(
        f,
        target,
        targetIndex,
        true,
        seller,
        defaultPublicKey(),
        true
      ).sendAndConfirm(f.caller);
    }
    t.is(
      (await lamports(f.umi, seller)) - beforeSeller,
      rent + (sold ? 0n : f.price / 2n)
    );
    const otherRent = getSvm()
      .getAccount(
        publicKeyBytes(
          findSellerHistoryPda(f.umi, {
            gumballMachine: f.machine,
            seller: keys[otherIndex],
          })[0]
        )
      )!
      .lamports();
    const beforeOther = await lamports(f.umi, keys[otherIndex]);
    await settle(
      f,
      other,
      otherIndex,
      f.buyer.identity.publicKey,
      keys[0],
      keys[otherIndex]
    ).sendAndConfirm(f.caller);
    t.is(
      (await lamports(f.umi, keys[otherIndex])) - beforeOther,
      otherRent + (sold ? f.price : f.price / 2n)
    );
    const final = await fetchGumballMachine(f.umi, f.machine);
    t.is(final.itemsSettled, 2n);
    t.is(final.refundReserve, 0n);
    t.is(final.totalRevenue, f.price);
    t.is(final.totalProceedsSettled, f.price);
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
  });
}

const recreatedTreeKinds = [
  'system',
  'foreign',
  'spl',
  'uninitialized',
  'v2',
] as const;
const recreateClosedTree = async (
  f: any,
  kind: (typeof recreatedTreeKinds)[number] | 'admin-v2'
) => {
  await closeEmptyTree(f.umi, f.item);
  const merkleTree = f.item.merkleTreeSigner;
  if (kind === 'v2' || kind === 'spl' || kind === 'admin-v2') {
    await (
      await (kind === 'spl' ? createTree : createTreeV2)(f.umi, {
        merkleTree,
        maxDepth: 5,
        maxBufferSize: 8,
        public: false,
      })
    ).sendAndConfirm(f.umi);
  } else {
    const owner =
      kind === 'system'
        ? defaultPublicKey()
        : kind === 'foreign'
          ? publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
          : publicKey('mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW');
    await createAccount(f.umi, {
      newAccount: merkleTree,
      space: 1,
      lamports: sol(0.01),
      programId: owner,
    }).sendAndConfirm(f.umi);
  }
  if (kind === 'admin-v2') {
    // Ledger fixture for an occupied replacement whose authority is unrelated
    // to Bubblegum. Recovery must rely on the marketplace, not a wider predicate.
    for (let index = 0; index <= f.item.leafIndex; index += 1) {
      await mintCnft(f.umi, { merkleTree, leafIndex: index });
    }
    const key = publicKeyBytes(f.item.merkleTree);
    const account = getSvm().getAccount(key)!;
    const data = account.data();
    data.set(publicKeyBytes(f.umi.identity.publicKey), 10);
    getSvm().setAccount(
      key,
      new Account(account.lamports(), data, account.owner(), false, 0n)
    );
  }
  // The old leaf's collection is gone from the replacement tree.
  f.item.collection = undefined;
};
const withMarketplaceEvidence = (f: any, builder: any) =>
  builder.addRemainingAccounts([
    { signer: f.marketplace.identity, isWritable: false },
    { pubkey: f.globalConfig, isSigner: false, isWritable: false },
  ]);

for (const kind of recreatedTreeKinds) {
  for (const payment of ['sol', 'spl', 'token2022']) {
    for (const admin of [false, true]) {
      // SPL replacement needs admin evidence because config lines also store v1 items.
      if (kind === 'spl' && !admin) continue;
      test(`R20-01: ${kind} replacement ${payment} ${admin ? 'admin' : 'proof'} refund makes buyer whole`, async (t) => {
        const f = await fixture(payment, true, 1, 5, { leafIndex: 2 });
        await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
        await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
        await recreateClosedTree(f, kind);
        const before = await f.balance();
        if (kind === 'spl')
          await t.throwsAsync(
            f.refund(null, new Uint8Array(32), []).sendAndConfirm(f.caller),
            { message: /Error Number: 6069/ }
          );
        await measureInstruction(
          f.caller,
          (admin ? f.adminRefund : f.refund)(null, new Uint8Array(32), []),
          t,
          admin ? 'admin_refund_cnft_sale_v2' : 'refund_cnft_sale_v2'
        );
        t.is((await f.balance()) - before, f.price);
        const state = await fetchGumballMachine(f.umi, f.machine);
        t.is(state.totalRevenue, 0n);
        t.is(state.refundReserve, 0n);
        t.is(state.outstandingDraws, 0n);
        t.is(state.itemsSettled, 1n);
        await f.close();
        t.false(await f.umi.rpc.accountExists(f.machine));
      });
    }
  }
  test(`R20-01: ${kind} replacement settles a claimed burn and closes machine`, async (t) => {
    const f = await fixture('sol', true, 1, 5, { leafIndex: 2 });
    await claimRecoveryItem(f).sendAndConfirm(f.caller);
    f.item.owner = f.buyer.identity.publicKey;
    await burnV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(
      f.buyer
    );
    await recreateClosedTree(f, kind);
    const rent = historyRent(f);
    const before = await lamports(f.umi);
    let builder = settleRecovered(
      f,
      f.item,
      0,
      true,
      f.umi.identity.publicKey,
      f.buyer.identity.publicKey,
      true
    );
    if (kind === 'spl') {
      await t.throwsAsync(builder.sendAndConfirm(f.caller), {
        message: /Error Number: 6037/,
      });
      builder = withMarketplaceEvidence(f, builder);
    }
    await measureInstruction(f.caller, builder, t, 'settle_cnft_sale_v2');
    t.is((await lamports(f.umi)) - before, f.price + rent);
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
  });
  test(`R20-01: ${kind} replacement has an unsold exit`, async (t) => {
    const f = await fixture('sol', false, 1, 5, { leafIndex: 2 });
    await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    await recreateClosedTree(f, kind);
    await (kind === 'spl' ? f.adminRefund : f.refund)(
      null,
      new Uint8Array(32),
      [],
      { payer: f.umi.identity }
    ).sendAndConfirm(f.caller);
    let settle = settleRecovered(
      f,
      f.item,
      0,
      true,
      f.umi.identity.publicKey,
      defaultPublicKey(),
      true
    );
    if (kind === 'spl') settle = withMarketplaceEvidence(f, settle);
    await settle.sendAndConfirm(f.caller);
    t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
    await f.close();
    t.false(await f.umi.rpc.accountExists(f.machine));
  });
  test(`R20-01: ${kind} replacement returns retained receipt rent`, async (t) => {
    const f = await fixture('sol', true, 1, 5, { leafIndex: 2 });
    await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
    await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    f.item.flags = 2;
    await f.refund().sendAndConfirm(f.caller);
    const rent = getSvm().getAccount(publicKeyBytes(f.recovery))!.lamports();
    await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    f.item.flags = 0;
    await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    await recreateClosedTree(f, kind);
    const before = await lamports(f.caller);
    await measureInstruction(
      f.umi,
      closeMissingCnftRecoveryV2(f.umi, {
        recovery: f.recovery,
        rentPayer: f.caller.identity.publicKey,
        merkleTree: f.item.merkleTree,
        root: new Uint8Array(32),
        leaf: null,
      }),
      t,
      'close_missing_cnft_recovery_v2'
    );
    t.is((await lamports(f.caller)) - before, rent);
    t.false(await f.umi.rpc.accountExists(f.recovery));
    await f.close();
  });
}

for (const kind of [...recreatedTreeKinds, 'admin-v2'] as const) {
  test(`${kind === 'admin-v2' ? 'R21-01' : 'R20-01'}: operator simulates the same ${kind} replacement before no-leaf admin refund`, async (t) => {
    const f = await fixture('sol', true, 1, 5, { leafIndex: 2 });
    await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
    await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
    await recreateClosedTree(f, kind);
    const input = {
      authority: f.marketplace.identity,
      claim: {
        gumballMachine: f.machine,
        index: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        merkleTree: f.item.merkleTree,
        treeConfig: f.item.treeConfig,
        args: { ...cnftArgs(f.umi, f.item), root: new Uint8Array(32) },
      },
      refund: {
        gumballMachine: f.machine,
        index: 0,
        nonce: f.item.leafIndex,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        merkleTree: f.item.merkleTree,
        root: new Uint8Array(32),
        leaf: null,
      },
      proof: [],
    };
    await t.throwsAsync(
      prepareAdminRefundCnftSaleV2(f.caller, {
        ...input,
        claim: { ...input.claim, index: 1 },
      }),
      { message: /same recorded draw/ }
    );
    const refund = await prepareAdminRefundCnftSaleV2(f.caller, input);
    const before = await f.balance();
    await refund.sendAndConfirm(f.caller);
    t.is((await f.balance()) - before, f.price);
    await f.close();
  });
}

test('R20-01: operator refuses no-leaf evidence for an occupied live v2 slot', async (t) => {
  const f = await fixture();
  await t.throwsAsync(
    prepareAdminRefundCnftSaleV2(f.caller, {
      authority: f.marketplace.identity,
      claim: {
        gumballMachine: f.machine,
        index: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        merkleTree: f.item.merkleTree,
        treeConfig: f.item.treeConfig,
        args: { ...cnftArgs(f.umi, f.item), root: new Uint8Array(32) },
      },
      refund: {
        gumballMachine: f.machine,
        index: 0,
        nonce: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        merkleTree: f.item.merkleTree,
        root: new Uint8Array(32),
        leaf: null,
      },
      proof: [],
    }),
    { message: /absent recorded leaf slot/ }
  );
  t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, f.price);
});

for (const kind of [...recreatedTreeKinds, 'admin-v2'] as const) {
  for (const sold of [false, true]) {
    test(`${kind === 'admin-v2' ? 'R21-01' : 'R20-01'}: ${kind} replacement ${sold ? 'drawn' : 'unsold'} collab inventory preserves the other seller's proceeds`, async (t) => {
      const f = await fixture('sol', true, 2);
      const invited = await createCnftUmi(createUmi);
      const keys = [f.umi.identity.publicKey, invited.identity.publicKey];
      const settings = (await fetchGumballMachine(f.umi, f.machine)).settings;
      await updateSettings(f.umi, {
        gumballMachine: f.machine,
        settings: {
          ...settings,
          sellersMerkleRoot: some(getSellerMerkleRoot(keys)),
        },
      }).sendAndConfirm(f.umi);
      const item = await mintCnft(invited);
      await addCnftV2(invited, {
        gumballMachine: f.machine,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        leafDelegate: item.owner,
        args: cnftArgs(invited, item),
        addItemArgs: {
          sellerProofPath: some(getSellerMerkleProof(keys, keys[1])),
        },
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(invited, item).proof))
        .sendAndConfirm(invited);
      item.owner = f.escrow;
      await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(
        f.umi
      );
      await f.drawItem();
      if (sold) await f.drawItem();
      if (!sold)
        await endSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(
          f.umi
        );
      const state = await fetchGumballMachine(f.umi, f.machine);
      // Whichever item remained undrawn is the closed-tree target in that case.
      const targetIndex = sold
        ? 1
        : state.items.find((entry) => !entry.isDrawn)!.index;
      const target = targetIndex === 1 ? item : f.item;
      const seller = keys[targetIndex];
      const otherIndex = 1 - targetIndex;
      const other = otherIndex === 0 ? f.item : item;
      const sellerUmi = targetIndex === 1 ? invited : f.umi;
      await setPermanentCollection(sellerUmi, target, 'PermanentBurnDelegate');
      await burnV2(sellerUmi, mutationArgs(sellerUmi, target)).sendAndConfirm(
        sellerUmi
      );
      await recreateClosedTree({ ...f, umi: sellerUmi, item: target }, kind);
      const history = findSellerHistoryPda(f.umi, {
        gumballMachine: f.machine,
        seller,
      })[0];
      const rent = getSvm().getAccount(publicKeyBytes(history))!.lamports();
      const beforeSeller = await lamports(f.umi, seller);
      const beforeBuyer = await f.balance();
      await (kind === 'spl' || kind === 'admin-v2' ? f.adminRefund : f.refund)(
        null,
        new Uint8Array(32),
        [],
        {
          index: targetIndex,
          seller,
          merkleTree: target.merkleTree,
          buyer: sold ? f.buyer.identity.publicKey : null,
          payer: sold
            ? f.caller.identity
            : targetIndex === 1
              ? invited.identity
              : f.umi.identity,
        }
      ).sendAndConfirm(f.caller);
      t.is((await f.balance()) - beforeBuyer, sold ? f.price : 0n);
      if (!sold) {
        await claimRecoveryItem(
          f,
          other,
          otherIndex,
          keys[otherIndex]
        ).sendAndConfirm(f.caller);
        other.owner = f.buyer.identity.publicKey;
        let builder = settleRecovered(
          f,
          target,
          targetIndex,
          true,
          seller,
          defaultPublicKey(),
          true
        );
        if (kind === 'spl' || kind === 'admin-v2')
          builder = withMarketplaceEvidence(f, builder);
        await builder.sendAndConfirm(f.caller);
      }
      t.is(
        (await lamports(f.umi, seller)) - beforeSeller,
        rent + (sold ? 0n : f.price / 2n)
      );
      const otherRent = getSvm()
        .getAccount(
          publicKeyBytes(
            findSellerHistoryPda(f.umi, {
              gumballMachine: f.machine,
              seller: keys[otherIndex],
            })[0]
          )
        )!
        .lamports();
      const beforeOther = await lamports(f.umi, keys[otherIndex]);
      await settle(
        f,
        other,
        otherIndex,
        f.buyer.identity.publicKey,
        keys[0],
        keys[otherIndex]
      ).sendAndConfirm(f.caller);
      t.is(
        (await lamports(f.umi, keys[otherIndex])) - beforeOther,
        otherRent + (sold ? f.price : f.price / 2n)
      );
      const final = await fetchGumballMachine(f.umi, f.machine);
      t.is(final.itemsSettled, 2n);
      t.is(final.refundReserve, 0n);
      t.is(final.totalRevenue, f.price);
      t.is(final.totalProceedsSettled, f.price);
      await f.close();
      t.false(await f.umi.rpc.accountExists(f.machine));
    });
  }
}

test('R20-01: live v1 tree cannot authorize permissionless v2 missing-leaf exits', async (t) => {
  const f = await fixture('sol', true, 1, 5, { skipAdd: true, version: 6 });
  const item = await mintCnftV1(f.umi);
  await addCnft(f.umi, {
    gumballMachine: f.machine,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    leafDelegate: item.owner,
    args: cnftV1Args(f.umi, item),
    addItemArgs: {},
  })
    .addRemainingAccounts(proofAccounts(getCnftV1Proof(f.umi, item).proof))
    .sendAndConfirm(f.umi);
  item.owner = f.escrow;
  await startSale(f.umi, { gumballMachine: f.machine }).sendAndConfirm(f.umi);
  await f.drawItem();
  await t.throwsAsync(
    f
      .refund(null, new Uint8Array(32), [], { merkleTree: item.merkleTree })
      .sendAndConfirm(f.caller),
    { message: /Error Number: 6069/ }
  );
  const beforeRefund = await f.balance();
  await t.throwsAsync(
    prepareAdminRefundCnftSaleV2(f.caller, {
      authority: f.marketplace.identity,
      claim: {
        gumballMachine: f.machine,
        index: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: { ...cnftArgs(f.umi, f.item), root: new Uint8Array(32) },
      },
      refund: {
        gumballMachine: f.machine,
        index: 0,
        nonce: 0,
        seller: f.umi.identity.publicKey,
        buyer: f.buyer.identity.publicKey,
        merkleTree: item.merkleTree,
        root: new Uint8Array(32),
        leaf: null,
      },
      proof: [],
    }),
    { message: /absent recorded leaf slot/ }
  );
  t.is(await f.balance(), beforeRefund);
  t.is((await fetchGumballMachine(f.umi, f.machine)).refundReserve, f.price);
  const v1Proof = getCnftV1Proof(f.umi, item);
  await claimCnft(f.caller, {
    gumballMachine: f.machine,
    index: 0,
    seller: f.umi.identity.publicKey,
    buyer: f.buyer.identity.publicKey,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: cnftV1Args(f.umi, item),
  })
    .addRemainingAccounts(proofAccounts(v1Proof.proof))
    .sendAndConfirm(f.caller);
  await t.throwsAsync(
    settleRecovered(
      f,
      { ...item, depth: 5, canopyDepth: 0, flags: 0 },
      0,
      true,
      f.umi.identity.publicKey,
      f.buyer.identity.publicKey,
      true
    ).sendAndConfirm(f.caller),
    { message: /Error Number: 6037/ }
  );
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
});

for (const kind of [...recreatedTreeKinds, 'admin-v2'] as const) {
  for (const payment of ['spl', 'token2022']) {
    for (const sold of [false, true]) {
      test(`${kind === 'admin-v2' ? 'R21-01' : 'R20-01'}: ${kind} replacement ${payment} ${sold ? 'claimed' : 'unsold'} settlement releases escrow`, async (t) => {
        const f = await fixture(payment, sold, 1, 5, { leafIndex: 2 });
        if (sold) {
          await claimRecoveryItem(f).sendAndConfirm(f.caller);
          f.item.owner = f.buyer.identity.publicKey;
          await burnV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(
            f.buyer
          );
        } else {
          await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
          await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(
            f.umi
          );
        }
        await recreateClosedTree(f, kind);
        if (!sold)
          await (
            kind === 'spl' || kind === 'admin-v2' ? f.adminRefund : f.refund
          )(null, new Uint8Array(32), [], {
            payer: f.umi.identity,
          }).sendAndConfirm(f.caller);
        const sellerAta = findAssociatedTokenPda(f.tokenUmi, {
          mint: f.mint.publicKey,
          owner: f.umi.identity.publicKey,
          tokenProgramId: getSplTokenProgramId(f.tokenUmi),
        })[0];
        const settleInput = {
          gumballMachine: f.machine,
          index: 0,
          seller: f.umi.identity.publicKey,
          authority: f.umi.identity.publicKey,
          buyer: sold ? f.buyer.identity.publicKey : defaultPublicKey(),
          treeConfig: f.item.treeConfig,
          merkleTree: f.item.merkleTree,
          args: {
            ...cnftArgs(f.umi, f.item),
            root: new Uint8Array(32),
            flags: 255,
          },
          currentLeafOwner: defaultPublicKey(),
          currentLeafDelegate: defaultPublicKey(),
          paymentMint: f.mint.publicKey,
          authorityPdaPaymentAccount: f.treasury,
          sellerPaymentAccount: sellerAta,
          authorityPaymentAccount: sellerAta,
          feeAccount: f.feeAccount,
          feePaymentAccount: f.feeAta,
        };
        const builder =
          kind === 'admin-v2'
            ? await prepareAdminSettleMissingCnftSaleV2(f.caller, {
                authority: f.marketplace.identity,
                settle: settleInput,
                ...(payment === 'token2022'
                  ? { token2022Program: getSplTokenProgramId(f.tokenUmi) }
                  : {}),
              })
            : settleCnftSaleV2(f.caller, settleInput).addRemainingAccounts([
                ...(kind === 'spl' || kind === 'admin-v2'
                  ? [
                      { signer: f.marketplace.identity, isWritable: false },
                      {
                        pubkey: f.globalConfig,
                        isSigner: false,
                        isWritable: false,
                      },
                    ]
                  : []),
                ...(payment === 'token2022'
                  ? [
                      {
                        pubkey: getSplTokenProgramId(f.tokenUmi),
                        isSigner: false,
                        isWritable: false,
                      },
                    ]
                  : []),
              ]);
        await measureInstruction(f.caller, builder, t, 'settle_cnft_sale_v2');
        t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
        if (sold)
          t.is((await fetchToken(f.tokenUmi, sellerAta)).amount, f.price);
        await f.close();
        t.false(await f.umi.rpc.accountExists(f.machine));
      });
    }
  }
}

test('R20-01: re-created initialized tree retains current empty-leaf proof for a previously appended slot', async (t) => {
  const f = await fixture();
  await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  await recreateClosedTree(f, 'v2');
  const replacement = await mintCnft(f.umi, {
    merkleTree: f.item.merkleTreeSigner,
  });
  await t.throwsAsync(
    f.refund(null, new Uint8Array(32), []).sendAndConfirm(f.caller),
    { message: /Error Number: 6075/ }
  );
  await burnV2(f.umi, mutationArgs(f.umi, replacement)).sendAndConfirm(f.umi);
  await t.throwsAsync(
    f.refund(null, new Uint8Array(32), []).sendAndConfirm(f.caller),
    { message: /Error Number: 6075/ }
  );
  const empty = emptyProof(f.item);
  const before = await f.balance();
  await f.refund(null, empty.root, empty.proof).sendAndConfirm(f.caller);
  t.is((await f.balance()) - before, f.price);
  await f.close();
});

test('R21-06: replacement settlement requires the signed marketplace and canonical config', async (t) => {
  const f = await fixture('sol', true, 1, 5, { leafIndex: 2 });
  await claimRecoveryItem(f).sendAndConfirm(f.caller);
  f.item.owner = f.buyer.identity.publicKey;
  await burnV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(f.buyer);
  await recreateClosedTree(f, 'spl');
  const builder = settleRecovered(
    f,
    f.item,
    0,
    true,
    f.umi.identity.publicKey,
    f.buyer.identity.publicKey,
    true
  );
  const config = { pubkey: f.globalConfig, isSigner: false, isWritable: false };
  const marketplace = { signer: f.marketplace.identity, isWritable: false };
  const prefixes = [
    [{ signer: f.umi.identity, isWritable: false }, config],
    [
      {
        pubkey: f.marketplace.identity.publicKey,
        isSigner: false,
        isWritable: false,
      },
      config,
    ],
    [
      marketplace,
      { pubkey: f.umi.identity.publicKey, isSigner: false, isWritable: false },
    ],
    [config, marketplace],
  ];
  const before = await fetchGumballMachine(f.umi, f.machine);
  const beforeSeller = await lamports(f.umi);
  for (const prefix of prefixes) {
    await t.throwsAsync(
      builder.addRemainingAccounts(prefix).sendAndConfirm(f.caller),
      {
        message: /Error Number: 6037/,
      }
    );
    t.deepEqual(await fetchGumballMachine(f.umi, f.machine), before);
    t.is(await lamports(f.umi), beforeSeller);
  }
  await withMarketplaceEvidence(f, builder).sendAndConfirm(f.caller);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
  await f.close();
  t.false(await f.umi.rpc.accountExists(f.machine));
});

for (const leafIndex of [0, 2]) {
  for (const state of ['drawn', 'claimed', 'unsold']) {
    test(`R21-01: occupied foreign-authority replacement at ${leafIndex} exits ${state} and closes`, async (t) => {
      const sold = state !== 'unsold';
      const f = await fixture('sol', sold, 1, 5, { leafIndex });
      if (state === 'claimed') {
        await claimRecoveryItem(f).sendAndConfirm(f.caller);
        f.item.owner = f.buyer.identity.publicKey;
        await burnV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(
          f.buyer
        );
      } else {
        await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
        await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
      }
      await recreateClosedTree(f, 'admin-v2');
      const beforeBuyer = await f.balance();
      const beforeSeller = await lamports(f.umi);
      const rent = historyRent(f);
      if (state !== 'claimed') {
        await t.throwsAsync(
          f
            .refund(null, new Uint8Array(32), [], { payer: f.umi.identity })
            .sendAndConfirm(f.caller),
          {
            message: /Error Number: 6075/,
          }
        );
        await t.throwsAsync(
          f
            .adminRefund(null, new Uint8Array(32), [], {}, f.umi.identity)
            .sendAndConfirm(f.caller),
          {
            message: /Error Number: 6037/,
          }
        );
        await measureInstruction(
          f.caller,
          f.adminRefund(null, new Uint8Array(32), []),
          t,
          'admin_refund_cnft_sale_v2'
        );
        t.is((await f.balance()) - beforeBuyer, sold ? f.price : 0n);
      }
      if (state !== 'drawn') {
        const builder = settleRecovered(
          f,
          f.item,
          0,
          true,
          f.umi.identity.publicKey,
          sold ? f.buyer.identity.publicKey : defaultPublicKey(),
          true
        );
        await t.throwsAsync(builder.sendAndConfirm(f.caller));
        await t.throwsAsync(
          builder
            .addRemainingAccounts([
              { signer: f.umi.identity, isWritable: false },
              { pubkey: f.globalConfig, isSigner: false, isWritable: false },
            ])
            .sendAndConfirm(f.caller),
          { message: /Error Number: 6037/ }
        );
        t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
        await measureInstruction(
          f.caller,
          withMarketplaceEvidence(f, builder),
          t,
          'settle_cnft_sale_v2'
        );
      }
      t.is(
        (await lamports(f.umi)) - beforeSeller,
        rent + (state === 'claimed' ? f.price : 0n)
      );
      const final = await fetchGumballMachine(f.umi, f.machine);
      t.is(final.itemsSettled, 1n);
      t.is(final.outstandingDraws, 0n);
      t.is(final.refundReserve, 0n);
      await f.close();
      t.false(await f.umi.rpc.accountExists(f.machine));
    });
  }
}

test('R21-01: marketplace can close a retained receipt for an occupied replacement', async (t) => {
  const f = await fixture('sol', true, 1, 5, { leafIndex: 2 });
  await setPermanentCollection(f.umi, f.item, 'PermanentFreezeDelegate');
  await freezeV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 2;
  await f.refund().sendAndConfirm(f.caller);
  const rent = getSvm().getAccount(publicKeyBytes(f.recovery))!.lamports();
  await thawV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  f.item.flags = 0;
  await setPermanentCollection(f.umi, f.item, 'PermanentBurnDelegate');
  await burnV2(f.umi, mutationArgs(f.umi, f.item)).sendAndConfirm(f.umi);
  await recreateClosedTree(f, 'admin-v2');
  const builder = closeMissingCnftRecoveryV2(f.umi, {
    recovery: f.recovery,
    rentPayer: f.caller.identity.publicKey,
    merkleTree: f.item.merkleTree,
    root: new Uint8Array(32),
    leaf: null,
  });
  await t.throwsAsync(builder.sendAndConfirm(f.umi), {
    message: /Error Number: 6075/,
  });
  await t.throwsAsync(
    builder
      .addRemainingAccounts([
        { signer: f.umi.identity, isWritable: false },
        { pubkey: f.globalConfig, isSigner: false, isWritable: false },
      ])
      .sendAndConfirm(f.umi),
    { message: /Error Number: 6037/ }
  );
  t.true(await f.umi.rpc.accountExists(f.recovery));
  const before = await lamports(f.caller);
  const prepared = await prepareAdminCloseMissingCnftRecoveryV2(f.umi, {
    authority: f.marketplace.identity,
    close: {
      recovery: f.recovery,
      rentPayer: f.caller.identity.publicKey,
      merkleTree: f.item.merkleTree,
      root: new Uint8Array(32),
      leaf: null,
    },
  });
  await measureInstruction(
    f.umi,
    prepared,
    t,
    'close_missing_cnft_recovery_v2'
  );
  t.is((await lamports(f.caller)) - before, rent);
  t.false(await f.umi.rpc.accountExists(f.recovery));
  await f.close();
});

for (const shape of [
  { depth: 3, buffer: 8, canopy: 0, rightmost: 7 },
  { depth: 5, buffer: 8, canopy: 0, rightmost: 10 },
  { depth: 14, buffer: 64, canopy: 9, rightmost: 2 },
  { depth: 20, buffer: 1024, canopy: 15, rightmost: 2 },
]) {
  for (const leafIndex of [0, shape.rightmost]) {
    test(`R21-01: live ${shape.depth}/${shape.buffer} canopy ${shape.canopy} slot ${leafIndex} rejects proof-free exits`, async (t) => {
      const f = await fixture('sol', true, 1, shape.depth, {
        leafIndex,
        canopyDepth: shape.canopy,
        maxBufferSize: shape.buffer,
      });
      const before = await fetchGumballMachine(f.umi, f.machine);
      const beforeBuyer = await f.balance();
      await t.throwsAsync(
        f.refund(null, new Uint8Array(32), []).sendAndConfirm(f.caller),
        {
          message: /Error Number: 6075/,
        }
      );
      t.deepEqual(await fetchGumballMachine(f.umi, f.machine), before);
      t.is(await f.balance(), beforeBuyer);
      await claimRecoveryItem(f).sendAndConfirm(f.caller);
      f.item.owner = f.buyer.identity.publicKey;
      const claimed = await fetchGumballMachine(f.umi, f.machine);
      await t.throwsAsync(
        prepareAdminSettleMissingCnftSaleV2(f.caller, {
          authority: f.marketplace.identity,
          settle: {
            gumballMachine: f.machine,
            index: 0,
            seller: f.umi.identity.publicKey,
            authority: f.umi.identity.publicKey,
            buyer: f.buyer.identity.publicKey,
            treeConfig: f.item.treeConfig,
            merkleTree: f.item.merkleTree,
            args: {
              ...cnftArgs(f.umi, f.item),
              root: new Uint8Array(32),
              flags: 255,
            },
            currentLeafOwner: defaultPublicKey(),
            currentLeafDelegate: defaultPublicKey(),
          },
        }),
        { message: /independently verified missing delivery/ }
      );
      await t.throwsAsync(
        settleRecovered(
          f,
          f.item,
          0,
          true,
          f.umi.identity.publicKey,
          f.buyer.identity.publicKey,
          true
        ).sendAndConfirm(f.caller)
      );
      t.deepEqual(await fetchGumballMachine(f.umi, f.machine), claimed);
      await settleRecovered(
        f,
        f.item,
        0,
        false,
        f.umi.identity.publicKey,
        f.buyer.identity.publicKey
      ).sendAndConfirm(f.caller);
      t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 1n);
      await f.close();
    });
  }
}

test('R21-01: operator settlement verifies replacement evidence and the marketplace signer', async (t) => {
  const f = await fixture();
  await claimRecoveryItem(f).sendAndConfirm(f.caller);
  f.item.owner = f.buyer.identity.publicKey;
  const input = {
    authority: f.marketplace.identity,
    settle: {
      gumballMachine: f.machine,
      index: 0,
      seller: f.umi.identity.publicKey,
      authority: f.umi.identity.publicKey,
      buyer: f.buyer.identity.publicKey,
      treeConfig: f.item.treeConfig,
      merkleTree: f.item.merkleTree,
      args: {
        ...cnftArgs(f.umi, f.item),
        root: new Uint8Array(32),
        flags: 255,
      },
      currentLeafOwner: defaultPublicKey(),
      currentLeafDelegate: defaultPublicKey(),
    },
  };
  await t.throwsAsync(prepareAdminSettleMissingCnftSaleV2(f.caller, input), {
    message: /independently verified missing delivery/,
  });
  await burnV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(f.buyer);
  await recreateClosedTree(f, 'admin-v2');
  await t.throwsAsync(
    prepareAdminSettleMissingCnftSaleV2(f.caller, {
      ...input,
      authority: f.umi.identity,
    }),
    { message: /Error Number: 6037/ }
  );
  const builder = await prepareAdminSettleMissingCnftSaleV2(f.caller, input);
  t.is((await fetchGumballMachine(f.umi, f.machine)).itemsSettled, 0n);
  await builder.sendAndConfirm(f.caller);
  await f.close();
  t.false(await f.umi.rpc.accountExists(f.machine));
});

test('R21-01: admin replacement settlement pays curator and marketplace fees exactly', async (t) => {
  const f = await fixture('sol', true, 1, 5, {
    feeBps: 250,
    curatorFeeBps: 500,
  });
  await claimRecoveryItem(f).sendAndConfirm(f.caller);
  f.item.owner = f.buyer.identity.publicKey;
  await burnV2(f.buyer, mutationArgs(f.buyer, f.item)).sendAndConfirm(f.buyer);
  await recreateClosedTree(f, 'admin-v2');
  const beforeSeller = await lamports(f.umi);
  const beforeMarketplace = await lamports(f.umi, f.feeAccount);
  const rent = historyRent(f);
  await withMarketplaceEvidence(
    f,
    settleRecovered(
      f,
      f.item,
      0,
      true,
      f.umi.identity.publicKey,
      f.buyer.identity.publicKey,
      true
    )
  ).sendAndConfirm(f.caller);
  // Solo authority receives both its seller proceeds and curator fee.
  t.is((await lamports(f.umi)) - beforeSeller, (f.price * 975n) / 1000n + rent);
  t.is(
    (await lamports(f.umi, f.feeAccount)) - beforeMarketplace,
    (f.price * 25n) / 1000n
  );
  t.is(
    (await fetchGumballMachine(f.umi, f.machine)).totalProceedsSettled,
    f.price
  );
  await f.close();
});
