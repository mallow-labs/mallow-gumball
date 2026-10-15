import { ruleSet } from '@metaplex-foundation/mpl-core';
import { generateSigner, publicKeyBytes, sol } from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import {
  addCnftV2,
  addCoreAsset,
  claimCnftV2,
  claimCoreAsset,
  closeGumballMachine,
  draw,
  fetchGumballMachine,
  findGumballGuardPda,
  findGumballMachineAuthorityPda,
  settleCnftSaleV2,
  settleCoreAssetSale,
  startSale,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
} from './_cnftV2Setup';
import { create, createCoreAsset, createUmi } from './_setup';
import { getSvm } from './litesvm/svm';

const fixture = async (
  price: bigint,
  primary: boolean,
  percentages = [50, 50]
) => {
  const seller = await createCnftUmi(createUmi);
  const buyer = await createCnftUmi(createUmi);
  const caller = await createCnftUmi(createUmi);
  const creators = percentages.map(() => generateSigner(seller).publicKey);
  const core = await createCoreAsset(seller, {
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 1000,
        creators: creators.map((address, i) => ({
          address,
          percentage: percentages[i],
        })),
        ruleSet: ruleSet('None'),
      },
    ],
  });
  const leaf = await mintCnft(seller, {
    sellerFeeBasisPoints: 0,
    creators: [],
  });
  const machine = (
    await create(seller, {
      settings: { itemCapacity: 2, curatorFeeBps: 0 },
      disablePrimarySplit: !primary,
      guards: { solPayment: { lamports: sol(Number(price) / 1_000_000_000) } },
    })
  ).publicKey;
  await addCoreAsset(seller, {
    gumballMachine: machine,
    asset: core.publicKey,
  }).sendAndConfirm(seller);
  await addCnftV2(seller, {
    gumballMachine: machine,
    treeConfig: leaf.treeConfig,
    merkleTree: leaf.merkleTree,
    leafDelegate: leaf.owner,
    addItemArgs: {},
    args: cnftArgs(seller, leaf),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(seller, leaf).proof))
    .sendAndConfirm(seller);
  leaf.owner = findGumballMachineAuthorityPda(seller, {
    gumballMachine: machine,
  })[0];
  await startSale(seller, { gumballMachine: machine }).sendAndConfirm(seller);
  for (let i = 0; i < 2; i += 1)
    await draw(buyer, {
      gumballMachine: machine,
      mintArgs: { solPayment: true },
    }).sendAndConfirm(buyer);
  await claimCoreAsset(buyer, {
    gumballMachine: machine,
    index: 0,
    asset: core.publicKey,
    seller: seller.identity.publicKey,
    buyer: buyer.identity.publicKey,
  }).sendAndConfirm(buyer);
  const settleCore = () =>
    settleCoreAssetSale(caller, {
      gumballMachine: machine,
      index: 0,
      asset: core.publicKey,
      creators,
      seller: seller.identity.publicKey,
      authority: seller.identity.publicKey,
      buyer: buyer.identity.publicKey,
    }).sendAndConfirm(caller);
  const resolveLeaf = async () => {
    await claimCnftV2(buyer, {
      gumballMachine: machine,
      index: 1,
      seller: seller.identity.publicKey,
      buyer: buyer.identity.publicKey,
      treeConfig: leaf.treeConfig,
      merkleTree: leaf.merkleTree,
      args: cnftArgs(buyer, leaf),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(buyer, leaf).proof))
      .sendAndConfirm(buyer);
    leaf.owner = buyer.identity.publicKey;
  };
  const settleLeaf = () =>
    settleCnftSaleV2(caller, {
      gumballMachine: machine,
      index: 1,
      seller: seller.identity.publicKey,
      authority: seller.identity.publicKey,
      buyer: buyer.identity.publicKey,
      currentLeafOwner: leaf.owner,
      currentLeafDelegate: leaf.owner,
      treeConfig: leaf.treeConfig,
      merkleTree: leaf.merkleTree,
      args: cnftArgs(caller, leaf),
    })
      .addRemainingAccounts(proofAccounts(getCnftProof(caller, leaf).proof))
      .sendAndConfirm(caller);
  return {
    seller,
    buyer,
    caller,
    creators,
    machine,
    settleCore,
    settleLeaf,
    resolveLeaf,
  };
};

for (const primary of [true, false]) {
  for (const leafFirst of [true, false]) {
    test(`R11-03: odd cumulative royalties conserve proceeds and close; primary=${primary}, leaf-first=${leafFirst}`, async (t) => {
      const price = primary ? 1_000_000_002n : 10_000_000_020n;
      const f = await fixture(price, primary);
      await f.settleCore();
      for (const creator of f.creators)
        t.is(
          (await f.seller.rpc.getBalance(creator)).basisPoints,
          250_000_000n
        );
      const partial = await fetchGumballMachine(f.seller, f.machine);
      t.is(partial.itemsSettled, 0n);
      t.is(partial.refundReserve, price);
      await f.resolveLeaf();
      if (leafFirst) await f.settleLeaf();
      await f.settleCore();
      if (!leafFirst) await f.settleLeaf();
      const paid = await Promise.all(
        f.creators.map(
          async (key) => (await f.seller.rpc.getBalance(key)).basisPoints
        )
      );
      t.deepEqual(paid, [500_000_001n, 500_000_000n]);
      const settled = await fetchGumballMachine(f.seller, f.machine);
      t.is(settled.itemsSettled, 2n);
      t.is(settled.totalProceedsSettled, 2n * price);
      await closeGumballMachine(f.seller, {
        machine: f.machine,
        gumballGuard: findGumballGuardPda(f.seller, { base: f.machine }),
      }).sendAndConfirm(f.seller);
      t.false(await f.seller.rpc.accountExists(f.machine));
    });
  }
}

test('R11-07: a partial native payout reserves the empty seller wallet rent before creator top-ups', async (t) => {
  const f = await fixture(2_000_000n, false, [100]);
  const key = publicKeyBytes(f.seller.identity.publicKey);
  const original = getSvm().getAccount(key)!;
  getSvm().setAccount(
    key,
    new Account(0n, original.data(), original.owner(), false, 0n)
  );
  await f.settleCore();
  t.is((await f.seller.rpc.getBalance(f.creators[0])).basisPoints, 0n);
  t.is(
    (await f.seller.rpc.getBalance(f.seller.identity.publicKey)).basisPoints,
    1_000_000n
  );
  t.is((await fetchGumballMachine(f.seller, f.machine)).itemsSettled, 0n);
  await f.resolveLeaf();
  await f.settleCore();
  await f.settleLeaf();
  t.is((await fetchGumballMachine(f.seller, f.machine)).itemsSettled, 2n);
});
