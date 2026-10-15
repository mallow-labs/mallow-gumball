import {
  createCollection,
  ruleSet,
  updateCollectionPlugin,
} from '@metaplex-foundation/mpl-core';
import {
  createSignerFromKeypair,
  generateSigner,
  publicKey,
  publicKeyBytes,
  signerIdentity,
  sol,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  addCnftV2,
  approveAddItem,
  claimCnftV2,
  closeGumballMachine,
  draw,
  fetchGumballMachine,
  findGumballGuardPda,
  findGumballMachineAuthorityPda,
  getMerkleRoot,
  requestAddCnftV2,
  settleCnftSaleV2,
  startSale,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
  settleRemainingAccounts,
} from './_cnftV2Setup';
import { createUmi as baseCreateUmi, create } from './_setup';
import { getSvm } from './litesvm/svm';

let keyIndex = 0;
const createUmi = async () => {
  const umi = await baseCreateUmi();
  umi.eddsa.generateKeypair = () =>
    umi.eddsa.createKeypairFromSeed(
      createHash('sha256')
        .update(`gumball-round12-native-${keyIndex++}`)
        .digest()
    );
  umi.use(
    signerIdentity(createSignerFromKeypair(umi, umi.eddsa.generateKeypair()))
  );
  await umi.rpc.airdrop(umi.identity.publicKey, sol(100));
  return umi;
};
const metrics: any[] = [];
test.after(() => {
  if (process.env.CNFT_V2_FIX10_METRICS_OUT)
    writeFileSync(
      process.env.CNFT_V2_FIX10_METRICS_OUT,
      `${JSON.stringify(metrics, null, 2)}\n`
    );
});

const fixture = async (
  creator: any,
  price: bigint,
  inherited = false,
  claimed = false,
  curatorFeeBps = 0,
  sellerFeeBasisPoints = 500,
  options: { invited?: boolean; feeBps?: number; creators?: any[] } = {}
) => {
  const seller = await createCnftUmi(createUmi);
  const buyer = await createCnftUmi(createUmi);
  const caller = await createCnftUmi(createUmi);
  const authority = options.invited ? await createCnftUmi(createUmi) : seller;
  let collection: any;
  const payout = creator ?? generateSigner(seller).publicKey;
  if (inherited) {
    const key = generateSigner(seller);
    await createCollection(seller, {
      collection: key,
      name: 'Royalties',
      uri: '',
      plugins: [
        { type: 'BubblegumV2' },
        {
          type: 'Royalties',
          basisPoints: sellerFeeBasisPoints,
          creators: [{ address: seller.identity.publicKey, percentage: 100 }],
          ruleSet: ruleSet('None'),
        },
      ],
    }).sendAndConfirm(seller);
    collection = key.publicKey;
  }
  const creators = options.creators ?? [
    { address: payout, share: 100, verified: false },
  ];
  const item = await mintCnft(seller, {
    collection,
    creators: inherited ? [] : creators,
    sellerFeeBasisPoints: inherited ? 65535 : sellerFeeBasisPoints,
  });
  const machine = (
    await create(authority, {
      settings: {
        itemCapacity: 1,
        curatorFeeBps,
        ...(options.invited
          ? {
              sellersMerkleRoot: some(
                getMerkleRoot([seller.identity.publicKey])
              ),
            }
          : {}),
      },
      feeConfig: options.feeBps
        ? { feeAccount: caller.identity.publicKey, feeBps: options.feeBps }
        : null,
      disablePrimarySplit: true,
      guards: { solPayment: { lamports: sol(Number(price) / 1_000_000_000) } },
    })
  ).publicKey;
  if (options.invited) {
    await requestAddCnftV2(seller, {
      gumballMachine: machine,
      asset: item.assetId,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      coreCollection: collection,
      leafDelegate: item.owner,
      args: cnftArgs(seller, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(seller, item).proof))
      .sendAndConfirm(seller);
    await approveAddItem(authority, {
      gumballMachine: machine,
      seller: seller.identity.publicKey,
      asset: item.assetId,
    }).sendAndConfirm(authority);
  } else {
    await addCnftV2(seller, {
      gumballMachine: machine,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      coreCollection: collection,
      addItemArgs: {},
      leafDelegate: item.owner,
      args: cnftArgs(seller, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(seller, item).proof))
      .sendAndConfirm(seller);
  }
  item.owner = findGumballMachineAuthorityPda(seller, {
    gumballMachine: machine,
  })[0];
  await startSale(authority, { gumballMachine: machine }).sendAndConfirm(
    authority
  );
  await draw(buyer, {
    gumballMachine: machine,
    mintArgs: {
      solPayment: options.feeBps
        ? { feeAccounts: [caller.identity.publicKey] }
        : true,
    },
  }).sendAndConfirm(buyer);
  // Authenticate the current plugin, including a payout change after escrow.
  if (inherited)
    await updateCollectionPlugin(seller, {
      collection,
      plugin: {
        type: 'Royalties',
        basisPoints: sellerFeeBasisPoints,
        creators: [{ address: payout, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
    }).sendAndConfirm(seller);
  if (claimed) {
    await claimCnftV2(buyer, {
      gumballMachine: machine,
      index: 0,
      seller: seller.identity.publicKey,
      buyer: buyer.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      coreCollection: collection,
      args: cnftArgs(buyer, item),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(buyer, item).proof))
      .sendAndConfirm(buyer);
    item.owner = buyer.identity.publicKey;
  }
  const settle = (writable = true) =>
    settleCnftSaleV2(caller, {
      gumballMachine: machine,
      index: 0,
      seller: seller.identity.publicKey,
      authority: authority.identity.publicKey,
      feeAccount: options.feeBps ? caller.identity.publicKey : undefined,
      buyer: buyer.identity.publicKey,
      treeConfig: item.treeConfig,
      merkleTree: item.merkleTree,
      coreCollection: collection,
      currentLeafOwner: item.owner,
      currentLeafDelegate: item.owner,
      args: cnftArgs(caller, item),
    }).addRemainingAccounts(
      settleRemainingAccounts(creators, getCnftProof(caller, item).proof).map(
        (a, index) => (index === 0 ? { ...a, isWritable: writable } : a)
      )
    );
  const settleAndMeasure = async (scenario: string) => {
    const tx = await settle().buildAndSign(caller);
    const sim = await caller.rpc.simulateTransaction(tx);
    if (sim.err) throw new Error(JSON.stringify(sim));
    const row = {
      instruction: 'settle_cnft_sale_v2',
      scenario,
      computeUnits: sim.unitsConsumed,
      serializedBytes: caller.transactions.serialize(tx).length,
    };
    if (row.serializedBytes > 1232 || row.computeUnits > 200_000)
      throw new Error(`Native payout budget exceeded: ${JSON.stringify(row)}`);
    metrics.push(row);
    await settle().sendAndConfirm(caller);
  };
  return {
    seller,
    buyer,
    caller,
    authority,
    payout,
    machine,
    settle,
    settleAndMeasure,
  };
};

for (const claimed of [false, true]) {
  for (const inherited of [false, true]) {
    for (const key of [
      '11111111111111111111111111111111',
      'SysvarRent111111111111111111111111111111111',
      'NativeLoader1111111111111111111111111111111',
      'Sysvar1111111111111111111111111111111111111',
      'LoaderV411111111111111111111111111111111111',
      'ZkTokenProof1111111111111111111111111111111',
      'StakeConfig11111111111111111111111111111111',
    ]) {
      test.serial(
        `R10-02: reserved creator settles and closes; claimed=${claimed}, inherited=${inherited}, key=${key}`,
        async (t) => {
          const f = await fixture(
            publicKey(key),
            1_000_000_000n,
            inherited,
            claimed
          );
          const before = (
            await f.seller.rpc.getBalance(f.seller.identity.publicKey)
          ).basisPoints;
          const reserved = (await f.seller.rpc.getBalance(f.payout))
            .basisPoints;
          const tx = await f.settle(false).buildAndSign(f.caller);
          const sim = await f.caller.rpc.simulateTransaction(tx);
          t.is(sim.err, null);
          await f.settleAndMeasure(
            `reserved-${key}-${inherited ? 'collection' : 'leaf'}-${claimed ? 'claimed' : 'transfer'}`
          );
          t.is((await f.seller.rpc.getBalance(f.payout)).basisPoints, reserved);
          t.is(
            (await f.seller.rpc.getBalance(f.seller.identity.publicKey))
              .basisPoints - before,
            1_001_447_680n
          );
          t.is(
            (await fetchGumballMachine(f.seller, f.machine)).itemsSettled,
            1n
          );
          await closeGumballMachine(f.seller, {
            machine: f.machine,
            gumballGuard: findGumballGuardPda(f.seller, { base: f.machine }),
          }).sendAndConfirm(f.seller);
          t.false(await f.seller.rpc.accountExists(f.machine));
        }
      );
    }
  }
}

for (const claimed of [false, true]) {
  for (const scenario of [
    { name: 'payable share', price: 30_000_000n, creator: 1_500_000n },
    { name: 'seller-funded top-up', price: 10_000_000n, creator: 890_880n },
    { name: 'insufficient seller proceeds', price: 500_000n, creator: 0n },
  ]) {
    test.serial(`R10-12: ${scenario.name}; claimed=${claimed}`, async (t) => {
      const f = await fixture(null, scenario.price, false, claimed);
      const before = (
        await f.seller.rpc.getBalance(f.seller.identity.publicKey)
      ).basisPoints;
      const buyerBefore = (
        await f.buyer.rpc.getBalance(f.buyer.identity.publicKey)
      ).basisPoints;
      await f.settleAndMeasure(
        `${scenario.name}-${claimed ? 'claimed' : 'transfer'}`
      );
      t.is(
        (await f.seller.rpc.getBalance(f.payout)).basisPoints,
        scenario.creator
      );
      t.is(
        (await f.seller.rpc.getBalance(f.seller.identity.publicKey))
          .basisPoints - before,
        scenario.price - scenario.creator + 1_447_680n
      );
      t.is(
        (await f.buyer.rpc.getBalance(f.buyer.identity.publicKey)).basisPoints,
        buyerBefore
      );
    });
  }
}

test.serial(
  'R10-02: ordinary writable creator cannot be diverted by passing read-only',
  async (t) => {
    const f = await fixture(null, 30_000_000n);
    await t.throwsAsync(f.settle(false).sendAndConfirm(f.caller), {
      message: /Error Number: 6045/,
    });
    t.is((await fetchGumballMachine(f.seller, f.machine)).itemsSettled, 0n);
    await f.settle().sendAndConfirm(f.caller);
    t.is((await f.seller.rpc.getBalance(f.payout)).basisPoints, 1_500_000n);
  }
);

for (const fees of ['curator', 'marketplace']) {
  test.serial(
    `R10-12: invited seller rent budget excludes ${fees} fees`,
    async (t) => {
      const f = await fixture(
        null,
        1_000_000n,
        false,
        true,
        fees === 'curator' ? 5000 : 0,
        5000,
        { invited: true, feeBps: fees === 'marketplace' ? 5000 : 0 }
      );
      const before = (
        await f.seller.rpc.getBalance(f.seller.identity.publicKey)
      ).basisPoints;
      const feeBefore = (
        await f.authority.rpc.getBalance(f.authority.identity.publicKey)
      ).basisPoints;
      await f.settleAndMeasure(`invited-seller-${fees}-fee`);
      t.is((await f.seller.rpc.getBalance(f.payout)).basisPoints, 0n);
      t.is(
        (await f.seller.rpc.getBalance(f.seller.identity.publicKey))
          .basisPoints - before,
        500_000n + 1_447_680n
      );
      if (fees === 'curator')
        t.is(
          (await f.authority.rpc.getBalance(f.authority.identity.publicKey))
            .basisPoints - feeBefore,
          500_000n
        );
    }
  );
}

test.serial(
  'R10-12: skipped reserved creator share never funds another creator rent',
  async (t) => {
    const context = await createUmi();
    const wallet = generateSigner(context).publicKey;
    const f = await fixture(wallet, 1_000_000n, false, true, 0, 10000, {
      creators: [
        {
          address: publicKey('11111111111111111111111111111111'),
          verified: false,
          share: 50,
        },
        { address: wallet, verified: false, share: 50 },
      ],
    });
    await f.settleAndMeasure('skipped-share-no-cross-subsidy');
    t.is((await f.seller.rpc.getBalance(wallet)).basisPoints, 0n);
  }
);

for (const claimed of [false, true]) {
  test.serial(
    `R11-07: final settlement can use the seller history close rent; claimed=${claimed}`,
    async (t) => {
      const f = await fixture(null, 1_000_000n, false, claimed, 0, 1000);
      const key = publicKeyBytes(f.seller.identity.publicKey);
      const account = getSvm().getAccount(key)!;
      getSvm().setAccount(
        key,
        new Account(0n, account.data(), account.owner(), false, 0n)
      );
      await f.settleAndMeasure(
        `empty-seller-history-refund-${claimed ? 'claimed' : 'transfer'}`
      );
      t.is((await f.seller.rpc.getBalance(f.payout)).basisPoints, 890_880n);
      t.is(
        (await f.seller.rpc.getBalance(f.seller.identity.publicKey))
          .basisPoints,
        1_556_800n
      );
    }
  );
}
