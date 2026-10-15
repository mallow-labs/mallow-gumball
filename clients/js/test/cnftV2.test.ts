/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */
import { createNoopSigner } from '@solana/kit';
import test from 'ava';
import {
  getAddCnftV2InstructionAsync,
  getCancelAddCnftRequestV2InstructionAsync,
  getClaimCnftV2InstructionAsync,
  getGumballMachineAccountDataDecoder,
  getReclaimCnftV2Instruction,
  getRefundCnftSaleV2InstructionAsync,
  getRemoveCnftV2InstructionAsync,
  getRequestAddCnftV2InstructionAsync,
  getSettleCnftSaleV2InstructionAsync,
} from '../src';

// Reuse the real Bubblegum fixtures; every gumball instruction below comes
// from Kit. The transport bridge only signs and sends Kit's wire instruction.
const fixturePath = '../../../umi/dist/test';
const setup = require(`${fixturePath}/_setup`);
const cnft = require(`${fixturePath}/_cnftV2Setup`);
const umiLib = require('../../../umi/node_modules/@metaplex-foundation/umi');
const bubblegum = require('../../../umi/node_modules/@metaplex-foundation/mpl-bubblegum');
const umiClient = require('../../../umi/dist/src');
const { getSvm } = require(`${fixturePath}/litesvm/svm`);

const signer = (umi: any) => createNoopSigner(umi.identity.publicKey);
const send = (
  umi: any,
  instruction: any,
  proof: any[] = [],
  signers = [umi.identity]
) =>
  umiLib
    .transactionBuilder()
    .add({
      instruction: {
        programId: instruction.programAddress,
        keys: [
          ...instruction.accounts.map((account: any) => ({
            pubkey: account.address,
            isWritable: (account.role & 1) !== 0,
            isSigner: (account.role & 2) !== 0,
          })),
          ...proof,
        ],
        data: instruction.data,
      },
      signers,
      bytesCreatedOnChain: 0,
    })
    .sendAndConfirm(umi);
const args = (umi: any, item: any) => ({
  ...cnft.cnftArgs(umi, item),
  assetDataHash: null,
});
const proof = (umi: any, item: any) =>
  cnft.proofAccounts(cnft.getCnftProof(umi, item).proof);
const decoded = (machine: any) =>
  getGumballMachineAccountDataDecoder().decode(
    getSvm().getAccount(umiLib.publicKeyBytes(machine)).data()
  );
const fixture = async (collab = false) => {
  const umi = await cnft.createCnftUmi(setup.createUmi);
  const machine = (
    await setup.create(umi, {
      settings: {
        itemCapacity: 1,
        curatorFeeBps: 0,
        sellersMerkleRoot: collab ? umiLib.some(new Uint8Array(32)) : null,
      },
      guards: { solPayment: { lamports: umiLib.sol(1) } },
      disablePrimarySplit: true,
    })
  ).publicKey;
  const escrow = umiClient.findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine,
  })[0];
  const item = await cnft.mintCnft(umi, { creators: [] });
  return { umi, machine, escrow, item };
};
const add = async (f: any) => {
  await send(
    f.umi,
    await getAddCnftV2InstructionAsync({
      gumballMachine: f.machine,
      seller: signer(f.umi),
      leafDelegate: f.item.owner,
      treeConfig: f.item.treeConfig,
      merkleTree: f.item.merkleTree,
      args: args(f.umi, f.item),
      addItemArgs: { sellerProofPath: null, index: null },
    } as any),
    proof(f.umi, f.item)
  );
  f.item.owner = f.escrow;
};

// Wire/decoder regressions execute all three custody families against LiteSVM.
test.serial(
  'R7-22: Kit v2 escrow entry/removal and v6 ledger decoder',
  async (t) => {
    const f = await fixture();
    await add(f);
    const account = decoded(f.machine);
    t.is(account.version, 6);
    t.is(account.itemsLoaded, 1);
    t.deepEqual(account.drawPayments, [0n]);
    t.deepEqual(account.itemProceedsPaid, [0n]);
    t.is(account.outstandingDraws, 0n);
    t.is(account.unfinalizedProceeds, 0n);
    await send(
      f.umi,
      await getRemoveCnftV2InstructionAsync({
        gumballMachine: f.machine,
        authority: signer(f.umi),
        seller: f.umi.identity.publicKey,
        index: 0,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        args: args(f.umi, f.item),
      } as any),
      proof(f.umi, f.item)
    );
    t.is(decoded(f.machine).itemsLoaded, 0);
    f.item.owner = f.umi.identity.publicKey;
    await add(f);
    t.is(decoded(f.machine).itemsLoaded, 1);
  }
);

test.serial(
  'R7-22: Kit v2 request/cancel and approved request/removal',
  async (t) => {
    const f = await fixture(true);
    const seller = await cnft.createCnftUmi(setup.createUmi);
    const item = await cnft.mintCnft(seller, { creators: [] });
    const request = async () =>
      send(
        seller,
        await getRequestAddCnftV2InstructionAsync({
          gumballMachine: f.machine,
          seller: signer(seller),
          asset: item.assetId,
          leafDelegate: item.owner,
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          args: args(seller, item),
        } as any),
        proof(seller, item)
      );
    await request();
    item.owner = f.escrow;
    t.is(decoded(f.machine).version, 5);
    t.is(decoded(f.machine).pendingAddRequests, 1n);
    await send(
      seller,
      await getCancelAddCnftRequestV2InstructionAsync({
        authorityPda: f.escrow,
        seller: signer(seller),
        asset: item.assetId,
        sellerHistory: umiClient.findSellerHistoryPda(seller, {
          gumballMachine: f.machine,
          seller: seller.identity.publicKey,
        })[0],
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: args(seller, item),
      } as any),
      [
        ...proof(seller, item),
        { pubkey: f.machine, isSigner: false, isWritable: true },
      ]
    );
    t.is(decoded(f.machine).pendingAddRequests, 0n);
    item.owner = seller.identity.publicKey;
    await request();
    item.owner = f.escrow;
    await umiClient
      .approveAddItem(f.umi, {
        gumballMachine: f.machine,
        seller: seller.identity.publicKey,
        asset: item.assetId,
      })
      .sendAndConfirm(f.umi);
    t.is(decoded(f.machine).version, 6);
    await send(
      f.umi,
      await getRemoveCnftV2InstructionAsync({
        gumballMachine: f.machine,
        authority: signer(f.umi),
        seller: seller.identity.publicKey,
        index: 0,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: args(seller, item),
      } as any),
      proof(seller, item)
    );
    t.is(decoded(f.machine).itemsLoaded, 0);
  }
);

const draw = async (f: any) => {
  const buyer = await cnft.createCnftUmi(setup.createUmi);
  await umiClient
    .startSale(f.umi, { gumballMachine: f.machine })
    .sendAndConfirm(f.umi);
  await umiClient
    .draw(buyer, {
      gumballMachine: f.machine,
      mintArgs: { solPayment: umiLib.some({ feeAccounts: [] }) },
    })
    .sendAndConfirm(buyer);
  return buyer;
};
test.serial(
  'R7-22: Kit v2 claim/settlement decode nonzero ledger fields',
  async (t) => {
    const f = await fixture();
    await add(f);
    const buyer = await draw(f);
    t.deepEqual(decoded(f.machine).drawPayments, [1_000_000_000n]);
    t.is(decoded(f.machine).refundReserve, 1_000_000_000n);
    t.is(decoded(f.machine).outstandingDraws, 1n);
    await send(
      f.umi,
      await getClaimCnftV2InstructionAsync({
        payer: signer(f.umi),
        gumballMachine: f.machine,
        index: 0,
        seller: f.umi.identity.publicKey,
        buyer: buyer.identity.publicKey,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        args: args(f.umi, f.item),
      } as any),
      proof(f.umi, f.item)
    );
    f.item.owner = buyer.identity.publicKey;
    await send(
      f.umi,
      await getSettleCnftSaleV2InstructionAsync({
        payer: signer(f.umi),
        gumballMachine: f.machine,
        index: 0,
        authority: f.umi.identity.publicKey,
        seller: f.umi.identity.publicKey,
        buyer: buyer.identity.publicKey,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        args: args(f.umi, f.item),
        currentLeafOwner: f.item.owner,
        currentLeafDelegate: f.item.owner,
      } as any),
      proof(f.umi, f.item)
    );
    const final = decoded(f.machine);
    t.is(final.itemsSettled, 1n);
    t.is(final.refundReserve, 0n);
    t.is(final.totalProceedsSettled, 1_000_000_000n);
    t.deepEqual(final.itemProceedsPaid, [1_000_000_000n]);
  }
);

test.serial(
  'R7-22: Kit v2 evidence refund and marketplace reclaim',
  async (t) => {
    const f = await fixture();
    await add(f);
    const buyer = await draw(f);
    // The owner can freeze its escrowed leaf through a collection permanent delegate.
    const core = require('../../../umi/node_modules/@metaplex-foundation/mpl-core');
    const collection = umiLib.generateSigner(f.umi);
    await core
      .createCollection(f.umi, {
        collection,
        name: 'Kit recovery',
        uri: '',
        plugins: [
          { type: 'BubblegumV2' },
          { type: 'PermanentFreezeDelegate', frozen: false },
        ],
      })
      .sendAndConfirm(f.umi);
    const mutation = () => ({
      merkleTree: f.item.merkleTree,
      leafOwner: f.item.owner,
      leafDelegate: f.item.owner,
      coreCollection: f.item.collection,
      root: umiLib.publicKeyBytes(cnft.getCnftProof(f.umi, f.item).root),
      dataHash: bubblegum.hashMetadataV2(f.item.metadata),
      creatorHash: bubblegum.hashMetadataCreators(f.item.creators),
      flags: umiLib.some(f.item.flags),
      nonce: 0,
      index: 0,
      proof: cnft.getCnftProof(f.umi, f.item).proof,
    });
    await bubblegum
      .setCollectionV2(f.umi, {
        ...mutation(),
        metadata: f.item.metadata,
        newCoreCollection: collection.publicKey,
      })
      .sendAndConfirm(f.umi);
    f.item.collection = collection.publicKey;
    f.item.metadata = {
      ...f.item.metadata,
      collection: umiLib.some(collection.publicKey),
    };
    f.item.metaHash = bubblegum.hash(
      bubblegum.getMetadataArgsV2Serializer().serialize(f.item.metadata)
    );
    await bubblegum.freezeV2(f.umi, mutation()).sendAndConfirm(f.umi);
    f.item.flags = 2;
    const balance = (await buyer.rpc.getBalance(buyer.identity.publicKey))
      .basisPoints;
    const recovery = umiClient.findCnftRecoveryPda(f.umi, {
      gumballMachine: f.machine,
      merkleTree: f.item.merkleTree,
      nonce: 0,
    })[0];
    await send(
      f.umi,
      await getRefundCnftSaleV2InstructionAsync({
        payer: signer(f.umi),
        gumballMachine: f.machine,
        index: 0,
        nonce: 0,
        seller: f.umi.identity.publicKey,
        buyer: buyer.identity.publicKey,
        merkleTree: f.item.merkleTree,
        root: mutation().root,
        leaf: {
          owner: f.item.owner,
          delegate: f.item.owner,
          dataHash: mutation().dataHash,
          creatorHash: mutation().creatorHash,
          collectionHash: bubblegum.hashCollection(collection.publicKey),
          assetDataHash: bubblegum.hashAssetData(null),
          flags: 2,
        },
      } as any),
      proof(f.umi, f.item)
    );
    t.is(
      (await buyer.rpc.getBalance(buyer.identity.publicKey)).basisPoints -
        balance,
      1_000_000_000n
    );
    t.is(decoded(f.machine).itemsRefunded, 1n);
    await bubblegum.thawV2(f.umi, mutation()).sendAndConfirm(f.umi);
    f.item.flags = 0;
    const admin = setup.getTestAuthority(f.umi);
    await setup.setupGlobalConfig(f.umi, admin);
    await send(
      f.umi,
      getReclaimCnftV2Instruction({
        authority: createNoopSigner(admin.publicKey),
        recovery,
        authorityPda: f.escrow,
        seller: f.umi.identity.publicKey,
        rentPayer: f.umi.identity.publicKey,
        gumballMachine: f.machine,
        treeConfig: f.item.treeConfig,
        merkleTree: f.item.merkleTree,
        coreCollection: collection.publicKey,
        args: args(f.umi, f.item),
      } as any),
      [
        {
          pubkey: umiClient.findGlobalConfigPda(f.umi)[0],
          isSigner: false,
          isWritable: false,
        },
        ...proof(f.umi, f.item),
      ],
      [f.umi.identity, admin]
    );
    t.false(await f.umi.rpc.accountExists(recovery));
  }
);
