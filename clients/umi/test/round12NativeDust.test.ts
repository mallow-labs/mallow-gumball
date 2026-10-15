import { ruleSet } from '@metaplex-foundation/mpl-core';
import { publicKey, publicKeyBytes, sol } from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import {
  addCnftV2,
  addCoreAsset,
  claimCnftV2,
  claimCoreAsset,
  claimTokens,
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  settleCnftSaleV2,
  settleCoreAssetSale,
  startSale,
  TokenStandard,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
} from './_cnftV2Setup';
import { measureInstruction } from './_round13Token';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createUmi,
} from './_setup';
import { getSvm } from './litesvm/svm';

const emptyWallet = (wallet: any) => {
  const key = publicKeyBytes(wallet);
  const account = getSvm().getAccount(key)!;
  getSvm().setAccount(
    key,
    new Account(0n, account.data(), account.owner(), false, 0n)
  );
};

test('R12-09: Core plugin cleanup leaves sub-rent refunds with the buyer', async (t) => {
  const seller = await createUmi();
  const buyer = await createUmi();
  const asset = await createCoreAsset(seller);
  const machine = (
    await create(seller, {
      guards: { solPayment: { lamports: sol(1) } },
      items: [{ id: asset.publicKey, tokenStandard: TokenStandard.Core }],
      startSale: true,
    })
  ).publicKey;
  await draw(buyer, {
    gumballMachine: machine,
    mintArgs: { solPayment: true },
  }).sendAndConfirm(buyer);
  emptyWallet(seller.identity.publicKey);
  await claimCoreAsset(buyer, {
    gumballMachine: machine,
    index: 0,
    seller: seller.identity.publicKey,
    asset: asset.publicKey,
  }).sendAndConfirm(buyer);
  t.is(
    (await seller.rpc.getBalance(seller.identity.publicKey)).basisPoints,
    0n
  );
  t.true((await fetchGumballMachine(buyer, machine)).items[0].isClaimed);
});

test('R12-09: partial primary dust folds into later seller payouts', async (t) => {
  const seller = await createCnftUmi(createUmi);
  const buyer = await createCnftUmi(createUmi);
  const caller = await createCnftUmi(createUmi);
  const creators = await Promise.all([createUmi(), createUmi(), createUmi()]);
  const plugins: any = [
    {
      type: 'Royalties',
      basisPoints: 10000,
      creators: creators.map((u, i) => ({
        address: u.identity.publicKey,
        percentage: [33, 33, 34][i],
      })),
      ruleSet: ruleSet('None'),
    },
  ];
  const assets = [
    await createCoreAsset(seller, { plugins }),
    await createCoreAsset(seller, { plugins }),
  ];
  const machine = (
    await create(seller, {
      settings: { itemCapacity: 3, curatorFeeBps: 0 },
      feeConfig: { feeAccount: caller.identity.publicKey, feeBps: 250 },
      guards: { solPayment: { lamports: sol(3.000000003) } },
    })
  ).publicKey;
  const escrow = findGumballMachineAuthorityPda(seller, {
    gumballMachine: machine,
  })[0];
  // A pending compressed draw keeps the Core proceeds unfinalized.
  const leaf = await mintCnft(seller, {
    creators: [],
    sellerFeeBasisPoints: 0,
  });
  await addCnftV2(seller, {
    gumballMachine: machine,
    merkleTree: leaf.merkleTree,
    treeConfig: leaf.treeConfig,
    leafDelegate: leaf.owner,
    addItemArgs: {},
    args: cnftArgs(seller, leaf),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(seller, leaf).proof))
    .sendAndConfirm(seller);
  leaf.owner = escrow;
  for (const asset of assets)
    await addCoreAsset(seller, {
      gumballMachine: machine,
      asset: asset.publicKey,
      args: {},
    }).sendAndConfirm(seller);
  await startSale(seller, { gumballMachine: machine }).sendAndConfirm(seller);
  for (let i = 0; i < 3; i++)
    await draw(buyer, {
      gumballMachine: machine,
      mintArgs: { solPayment: { feeAccounts: [caller.identity.publicKey] } },
    }).sendAndConfirm(buyer);
  emptyWallet(seller.identity.publicKey);
  const claim = (index: number) =>
    claimCoreAsset(buyer, {
      gumballMachine: machine,
      index: index + 1,
      seller: seller.identity.publicKey,
      asset: assets[index].publicKey,
    }).sendAndConfirm(buyer);
  const settle = (index: number) =>
    settleCoreAssetSale(caller, {
      gumballMachine: machine,
      index: index + 1,
      authority: seller.identity.publicKey,
      seller: seller.identity.publicKey,
      buyer: buyer.identity.publicKey,
      asset: assets[index].publicKey,
      feeAccount: caller.identity.publicKey,
      creators: creators.map((u) => u.identity.publicKey),
    }).sendAndConfirm(caller);
  await claim(0);
  await settle(0);
  t.is((await fetchGumballMachine(caller, machine)).itemsSettled, 0n);
  t.is(
    (await seller.rpc.getBalance(seller.identity.publicKey)).basisPoints,
    0n
  );
  const ledger = (await caller.rpc.getAccount(escrow))!;
  t.is(ledger.data.length, 112);
  const amount = new DataView(
    ledger.data.buffer,
    ledger.data.byteOffset
  ).getBigUint64(64, true);
  t.true(amount > 0n && amount < 890880n);
  await claim(1);
  await claimCnftV2(buyer, {
    seller: seller.identity.publicKey,
    gumballMachine: machine,
    index: 0,
    treeConfig: leaf.treeConfig,
    merkleTree: leaf.merkleTree,
    args: cnftArgs(buyer, leaf),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(buyer, leaf).proof))
    .sendAndConfirm(buyer);
  leaf.owner = buyer.identity.publicKey;
  const beforeLeafPayout = (
    await seller.rpc.getBalance(seller.identity.publicKey)
  ).basisPoints;
  await settleCnftSaleV2(caller, {
    gumballMachine: machine,
    index: 0,
    seller: seller.identity.publicKey,
    authority: seller.identity.publicKey,
    buyer: buyer.identity.publicKey,
    treeConfig: leaf.treeConfig,
    merkleTree: leaf.merkleTree,
    currentLeafOwner: leaf.owner,
    currentLeafDelegate: leaf.owner,
    feeAccount: caller.identity.publicKey,
    args: cnftArgs(caller, leaf),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(caller, leaf).proof))
    .sendAndConfirm(caller);
  t.is(
    (await seller.rpc.getBalance(seller.identity.publicKey)).basisPoints -
      beforeLeafPayout,
    2925000003n + amount
  );
  await settle(0);
  await settle(1);
  t.is((await fetchGumballMachine(caller, machine)).itemsSettled, 3n);
  const finalLedger = (await caller.rpc.getAccount(escrow))!;
  // R13-09: the later payable seller credit consumes previously parked dust.
  t.is(finalLedger.data.length, 0);
});

for (const standard of [TokenStandard.Core, TokenStandard.Fungible]) {
  test(`R12-03: a legacy reserved authority cannot trap a seller or token prize; standard=${standard}`, async (t) => {
    const seller = await createUmi();
    const buyer = await createUmi();
    const caller = await createUmi();
    const asset =
      standard === TokenStandard.Core
        ? await createCoreAsset(seller)
        : (
            await createMintWithHolders(seller, {
              decimals: 0,
              holders: [{ owner: seller.identity, amount: 1 }],
            })
          )[0];
    const machine = (
      await create(seller, {
        settings: { curatorFeeBps: 500 },
        items: [{ id: asset.publicKey, tokenStandard: standard, amount: 1 }],
        guards: { solPayment: { lamports: sol(1) } },
        startSale: true,
      })
    ).publicKey;
    await draw(buyer, {
      gumballMachine: machine,
      mintArgs: { solPayment: true },
    }).sendAndConfirm(buyer);
    const reserved = publicKey('Vote111111111111111111111111111111111111111');
    const key = publicKeyBytes(machine);
    const account = getSvm().getAccount(key)!;
    const data = account.data();
    data.set(publicKeyBytes(reserved), 9);
    getSvm().setAccount(
      key,
      new Account(account.lamports(), data, account.owner(), false, 0n)
    );
    if (standard === TokenStandard.Core) {
      await claimCoreAsset(buyer, {
        gumballMachine: machine,
        index: 0,
        seller: seller.identity.publicKey,
        asset: asset.publicKey,
      }).sendAndConfirm(buyer);
      await settleCoreAssetSale(caller, {
        gumballMachine: machine,
        index: 0,
        authority: reserved,
        seller: seller.identity.publicKey,
        buyer: buyer.identity.publicKey,
        asset: asset.publicKey,
        creators: [seller.identity.publicKey],
      }).sendAndConfirm(caller);
      t.is((await fetchGumballMachine(caller, machine)).itemsSettled, 1n);
      const escrow = findGumballMachineAuthorityPda(caller, {
        gumballMachine: machine,
      })[0];
      const ledger = (await caller.rpc.getAccount(escrow))!;
      t.is(
        new DataView(ledger.data.buffer, ledger.data.byteOffset).getBigUint64(
          64,
          true
        ),
        50000000n
      );
    } else {
      await claimTokens(buyer, {
        gumballMachine: machine,
        index: 0,
        authority: reserved,
        seller: seller.identity.publicKey,
        mint: asset.publicKey,
      }).sendAndConfirm(buyer);
      t.true((await fetchGumballMachine(buyer, machine)).items[0].isClaimed);
    }
  });
}

test('R13-09: same-wallet curator and seller payouts do not park a sub-rent fee', async (t) => {
  const seller = await createUmi();
  const buyer = await createUmi();
  const caller = await createUmi();
  const asset = await createCoreAsset(seller);
  const machine = (
    await create(seller, {
      settings: { curatorFeeBps: 500 },
      disablePrimarySplit: true,
      items: [{ id: asset.publicKey, tokenStandard: TokenStandard.Core }],
      guards: { solPayment: { lamports: sol(0.001) } },
      startSale: true,
    })
  ).publicKey;
  await draw(buyer, {
    gumballMachine: machine,
    mintArgs: { solPayment: true },
  }).sendAndConfirm(buyer);
  await claimCoreAsset(buyer, {
    gumballMachine: machine,
    index: 0,
    seller: seller.identity.publicKey,
    asset: asset.publicKey,
  }).sendAndConfirm(buyer);
  emptyWallet(seller.identity.publicKey);
  await measureInstruction(
    caller,
    settleCoreAssetSale(caller, {
      gumballMachine: machine,
      index: 0,
      authority: seller.identity.publicKey,
      seller: seller.identity.publicKey,
      buyer: buyer.identity.publicKey,
      asset: asset.publicKey,
      creators: [seller.identity.publicKey],
    }),
    t,
    'settle_core_asset_sale'
  );
  const escrow = findGumballMachineAuthorityPda(caller, {
    gumballMachine: machine,
  })[0];
  t.is((await caller.rpc.getAccount(escrow))!.data.length, 0);
  t.true(
    (await seller.rpc.getBalance(seller.identity.publicKey)).basisPoints >=
      1000000n
  );
  t.is((await fetchGumballMachine(caller, machine)).itemsSettled, 1n);
});

test('R13-09: buyer-settled Core sale returns plugin rent after seller proceeds', async (t) => {
  const seller = await createUmi();
  const buyer = await createUmi();
  const asset = await createCoreAsset(seller);
  const machine = (
    await create(seller, {
      disablePrimarySplit: true,
      items: [{ id: asset.publicKey, tokenStandard: TokenStandard.Core }],
      guards: { solPayment: { lamports: sol(0.1) } },
      startSale: true,
    })
  ).publicKey;
  await draw(buyer, {
    gumballMachine: machine,
    mintArgs: { solPayment: true },
  }).sendAndConfirm(buyer);
  emptyWallet(seller.identity.publicKey);
  const buyerBefore = (await buyer.rpc.getBalance(buyer.identity.publicKey))
    .basisPoints;
  await measureInstruction(
    buyer,
    settleCoreAssetSale(buyer, {
      gumballMachine: machine,
      index: 0,
      authority: seller.identity.publicKey,
      seller: seller.identity.publicKey,
      buyer: buyer.identity.publicKey,
      asset: asset.publicKey,
      creators: [seller.identity.publicKey],
    }),
    t,
    'settle_core_asset_sale'
  );
  t.is(
    (await buyer.rpc.getBalance(buyer.identity.publicKey)).basisPoints -
      buyerBefore,
    -5000n
  );
  t.is((await fetchGumballMachine(buyer, machine)).itemsSettled, 1n);
  t.true(
    (await seller.rpc.getBalance(seller.identity.publicKey)).basisPoints >
      100000000n
  );
});
