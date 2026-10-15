import { ruleSet } from '@metaplex-foundation/mpl-core';
import {
  createEmptyLut,
  createLutForTransactionBuilder,
  extendLut,
  fetchToken,
  findAssociatedTokenPda,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  publicKeyBytes,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import { writeFileSync } from 'node:fs';
import {
  approveAddItem,
  claimCnft,
  claimCnftV2,
  claimCoreAsset,
  closeGumballMachine,
  draw,
  fetchGumballMachine,
  findGumballGuardPda,
  findGumballMachineAuthorityPda,
  getMerkleRoot,
  recoverPayoutRent,
  requestAddCnft,
  requestAddCnftV2,
  requestAddCoreAsset,
  settleCnftSale,
  settleCnftSaleV2,
  settleCoreAssetSale,
  startSale,
  withdrawPayout,
} from '../src';
import * as v1 from './_cnftSetup';
import * as v2 from './_cnftV2Setup';
import { disableRentPayer, reassignTokenOwner } from './_round13Token';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createUmi,
} from './_setup';
import { getSvm } from './litesvm/svm';

const metrics: any[] = [];
test.after.always(() => {
  if (process.env.CNFT_V2_FIX12_METRICS_OUT)
    writeFileSync(
      process.env.CNFT_V2_FIX12_METRICS_OUT,
      `${JSON.stringify(metrics, null, 2)}\n`
    );
});
const measureAndSend = async (
  builder: any,
  umi: any,
  instruction: string,
  scenario: string
) => {
  const bareTx = await builder.buildAndSign(umi);
  const bareBytes = umi.transactions.serialize(bareTx).length;
  if (bareBytes > 1232) {
    builder = builder.useV0();
    const recentSlot = (await umi.rpc.getSlot()) - 1;
    const [, tables] = createLutForTransactionBuilder(umi, builder, recentSlot);
    for (const [tableIndex, table] of tables.entries()) {
      await createEmptyLut(umi, {
        recentSlot: recentSlot - tableIndex,
      }).sendAndConfirm(umi);
      for (let start = 0; start < table.addresses.length; start += 20)
        await extendLut(umi, {
          address: table.publicKey,
          addresses: table.addresses.slice(start, start + 20),
        }).sendAndConfirm(umi);
    }
    getSvm().warpToSlot(BigInt(await umi.rpc.getSlot()) + 1n);
    builder = builder.setAddressLookupTables(tables);
  }
  const tx = await builder.buildAndSign(umi);
  const sim = await umi.rpc.simulateTransaction(tx);
  if (sim.err) throw new Error(sim.logs.join('\n'));
  const row = {
    instruction,
    scenario,
    bareBytes,
    computeUnits: sim.unitsConsumed,
    serializedBytes: umi.transactions.serialize(tx).length,
  };
  if (row.computeUnits > 200000 || row.serializedBytes > 1232)
    throw new Error(`Payout budget exceeded: ${JSON.stringify(row)}`);
  metrics.push(row);
  return builder.sendAndConfirm(umi);
};
const token2022 = publicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const classic = publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const setup = async (
  standard: string,
  use2022: boolean,
  wrongDestination = false
) => {
  const cnft = standard === 'cnft-v2' ? v2 : v1;
  const authority = await cnft.createCnftUmi(createUmi);
  const seller = await cnft.createCnftUmi(createUmi);
  const buyer = await cnft.createCnftUmi(createUmi);
  const caller = await cnft.createCnftUmi(createUmi);
  const creator = await cnft.createCnftUmi(createUmi);
  const machine = generateSigner(authority);
  const escrow = findGumballMachineAuthorityPda(authority, {
    gumballMachine: machine.publicKey,
  })[0];
  const programs = authority.programs.clone();
  if (use2022) programs.bind('splToken', 'splToken2022');
  const tokenUmi = { ...authority, programs };
  const [mint, destinationAta, _buyerAta, authorityAta, creatorAta] =
    await createMintWithHolders(tokenUmi, {
      decimals: 0,
      holders: [
        {
          owner: wrongDestination
            ? generateSigner(authority).publicKey
            : escrow,
          amount: 0,
        },
        { owner: buyer.identity.publicKey, amount: 1000 },
        { owner: authority.identity.publicKey, amount: 0 },
        { owner: creator.identity.publicKey, amount: 0 },
      ],
    });
  await create(authority, {
    gumballMachine: machine,
    settings: {
      itemCapacity: 1,
      paymentMint: mint.publicKey,
      curatorFeeBps: 500,
      sellersMerkleRoot: some(getMerkleRoot([seller.identity.publicKey])),
    },
    disablePrimarySplit: true,
    guards: use2022
      ? {
          token2022Payment: {
            mint: mint.publicKey,
            destinationAta,
            amount: 1000,
          },
        }
      : { tokenPayment: { mint: mint.publicKey, amount: 1000 } },
  });
  const creators = [
    { address: creator.identity.publicKey, verified: false, share: 100 },
  ];
  let item: any;
  let asset: any;
  if (standard === 'core') {
    asset = await createCoreAsset(seller, {
      plugins: [
        {
          type: 'Royalties',
          basisPoints: 500,
          creators: [{ address: creator.identity.publicKey, percentage: 100 }],
          ruleSet: ruleSet('None'),
        },
      ],
    });
    await requestAddCoreAsset(seller, {
      gumballMachine: machine.publicKey,
      asset: asset.publicKey,
    }).sendAndConfirm(seller);
  } else {
    item = await cnft.mintCnft(seller, { creators, sellerFeeBasisPoints: 500 });
    await (standard === 'cnft-v2' ? requestAddCnftV2 : requestAddCnft)(seller, {
      gumballMachine: machine.publicKey,
      asset: item.assetId,
      merkleTree: item.merkleTree,
      treeConfig: item.treeConfig,
      leafDelegate: item.owner,
      args: cnft.cnftArgs(seller, item),
    } as any)
      .addRemainingAccounts(
        cnft.proofAccounts(cnft.getCnftProof(seller, item).proof)
      )
      .sendAndConfirm(seller);
    item.owner = escrow;
  }
  await approveAddItem(authority, {
    gumballMachine: machine.publicKey,
    seller: seller.identity.publicKey,
    asset: item?.assetId ?? asset.publicKey,
  }).sendAndConfirm(authority);
  await startSale(authority, {
    gumballMachine: machine.publicKey,
  }).sendAndConfirm(authority);
  const drawItem = () =>
    draw(buyer, {
      gumballMachine: machine.publicKey,
      mintArgs: use2022
        ? { token2022Payment: { mint: mint.publicKey, destinationAta } }
        : { tokenPayment: { mint: mint.publicKey } },
    }).sendAndConfirm(buyer);
  const common = {
    gumballMachine: machine.publicKey,
    index: 0,
    seller: seller.identity.publicKey,
    buyer: buyer.identity.publicKey,
  };
  const settle = () => {
    const params = {
      ...common,
      authority: authority.identity.publicKey,
      paymentMint: mint.publicKey,
    };
    if (standard === 'core') {
      // The hand-written builder derives classic ATAs, so supply payment-program-aware accounts.
      const tokenProgram = use2022 ? token2022 : classic;
      return settleCoreAssetSale(caller, {
        ...params,
        asset: asset.publicKey,
        authorityPaymentAccount: authorityAta,
        authorityPdaPaymentAccount: destinationAta,
        sellerPaymentAccount: findAssociatedTokenPda(caller, {
          mint: mint.publicKey,
          owner: seller.identity.publicKey,
          tokenProgramId: tokenProgram,
        })[0],
        creators: [creator.identity.publicKey],
        paymentTokenProgram: tokenProgram,
      });
    }
    const tokenProgram = use2022 ? token2022 : classic;
    return (standard === 'cnft-v2' ? settleCnftSaleV2 : settleCnftSale)(
      caller,
      {
        ...params,
        authorityPaymentAccount: authorityAta,
        authorityPdaPaymentAccount: destinationAta,
        sellerPaymentAccount: findAssociatedTokenPda(caller, {
          mint: mint.publicKey,
          owner: seller.identity.publicKey,
          tokenProgramId: tokenProgram,
        })[0],
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        currentLeafOwner: item.owner,
        currentLeafDelegate: item.owner,
        args: cnft.cnftArgs(caller, item),
      } as any
    ).addRemainingAccounts([
      ...(use2022
        ? [{ pubkey: token2022, isSigner: false, isWritable: false }]
        : []),
      { pubkey: creator.identity.publicKey, isSigner: false, isWritable: true },
      { pubkey: creatorAta, isSigner: false, isWritable: true },
      ...cnft.proofAccounts(cnft.getCnftProof(caller, item).proof),
    ]);
  };
  const claim = async () => {
    await (
      standard === 'core'
        ? claimCoreAsset(buyer, { ...common, asset: asset.publicKey })
        : (standard === 'cnft-v2' ? claimCnftV2 : claimCnft)(buyer, {
            ...common,
            treeConfig: item.treeConfig,
            merkleTree: item.merkleTree,
            args: cnft.cnftArgs(buyer, item),
          } as any).addRemainingAccounts(
            cnft.proofAccounts(cnft.getCnftProof(buyer, item).proof)
          )
    ).sendAndConfirm(buyer);
    if (item) item.owner = buyer.identity.publicKey;
  };
  return {
    authority,
    seller,
    buyer,
    caller,
    creator,
    machine: machine.publicKey,
    escrow,
    mint: mint.publicKey,
    authorityAta,
    creatorAta,
    destinationAta,
    drawItem,
    settle,
    claim,
    tokenUmi,
  };
};

const makeUnusable = (address: any, state: string, recipient: any) => {
  const key = publicKeyBytes(address);
  const account = getSvm().getAccount(key)!;
  let data = account.data();
  let owner = account.owner();
  if (state === 'owner') data.set(publicKeyBytes(recipient), 32);
  else if (state === 'frozen') data[108] = 2;
  else if (state === 'program') owner = publicKeyBytes(classic);
  else if (state === 'memo') {
    // Keep the existing ImmutableOwner TLV; append an enabled MemoTransfer.
    const extended = new Uint8Array(data.length + 5);
    extended.set(data);
    extended.set([8, 0, 1, 0, 1], data.length);
    data = extended;
  }
  getSvm().setAccount(
    key,
    new Account(account.lamports(), data, owner, false, 0n)
  );
  return account;
};

for (const standard of ['core', 'cnft-v1', 'cnft-v2']) {
  for (const state of ['owner', 'frozen', 'memo', 'program']) {
    test(`R12-05: ${standard} skips unusable token creator (${state})`, async (t) => {
      const use2022 = state === 'memo' || state === 'program';
      const f = await setup(standard, use2022);
      await f.drawItem();
      await f.claim();
      makeUnusable(f.creatorAta, state, f.buyer.identity.publicKey);
      await measureAndSend(
        f.settle(),
        f.caller,
        standard === 'core'
          ? 'settle_core_asset_sale'
          : standard === 'cnft-v1'
            ? 'settle_cnft_sale'
            : 'settle_cnft_sale_v2',
        `creator-${state}`
      );
      t.is((await fetchGumballMachine(f.caller, f.machine)).itemsSettled, 1n);
      const sellerAta = findAssociatedTokenPda(f.caller, {
        mint: f.mint,
        owner: f.seller.identity.publicKey,
        tokenProgramId: use2022 ? token2022 : classic,
      })[0];
      t.is((await fetchToken(f.caller, sellerAta)).amount, 950n);
      t.is((await fetchToken(f.caller, f.authorityAta)).amount, 50n);
    });
  }
  for (const state of ['owner', 'memo']) {
    test(`R12-04: ${standard} parks unusable curator fees (${state}) and recovers payer rent`, async (t) => {
      const use2022 = state === 'memo';
      const f = await setup(standard, use2022);
      await f.drawItem();
      await f.claim();
      const original = makeUnusable(
        f.authorityAta,
        state,
        f.buyer.identity.publicKey
      );
      await measureAndSend(
        f.settle(),
        f.caller,
        standard === 'core'
          ? 'settle_core_asset_sale'
          : standard === 'cnft-v1'
            ? 'settle_cnft_sale'
            : 'settle_cnft_sale_v2',
        `curator-${state}`
      );
      t.is((await fetchGumballMachine(f.caller, f.machine)).itemsSettled, 1n);
      const ledger = (await f.caller.rpc.getAccount(f.escrow))!;
      t.is(ledger.data.length, 112);
      t.is(
        new DataView(ledger.data.buffer, ledger.data.byteOffset).getBigUint64(
          64,
          true
        ),
        50n
      );
      const sellerAta = findAssociatedTokenPda(f.caller, {
        mint: f.mint,
        owner: f.seller.identity.publicKey,
        tokenProgramId: use2022 ? token2022 : classic,
      })[0];
      t.is((await fetchToken(f.caller, sellerAta)).amount, 903n);
      // Ownership, mint and rent payer are authenticated on withdrawal.
      const withdraw = (
        rentPayer = f.caller.identity.publicKey,
        recipient = f.authority.identity,
        destination = f.authorityAta
      ) =>
        measureAndSend(
          withdrawPayout(f.caller, {
            gumballMachine: f.machine,
            recipient,
            rentPayer,
            amount: 50,
            paymentMint: f.mint,
            tokenProgram: use2022 ? token2022 : classic,
            authorityPdaPaymentAccount: f.destinationAta,
            recipientPaymentAccount: destination,
          }),
          f.caller,
          'withdraw_payout',
          `${standard}-${state}`
        );
      await t.throwsAsync(withdraw(), { message: /InvalidAuthority/ });
      await t.throwsAsync(
        withdraw(
          f.caller.identity.publicKey,
          f.authority.identity,
          f.creatorAta
        ),
        { message: /InvalidAuthority/ }
      );
      await t.throwsAsync(withdraw(f.buyer.identity.publicKey), {
        message: /InvalidAuthority/,
      });
      await t.throwsAsync(
        withdraw(f.caller.identity.publicKey, f.buyer.identity),
        { message: /InsufficientFunds/ }
      );
      await t.throwsAsync(
        recoverPayoutRent(f.caller, {
          gumballMachine: f.machine,
          rentPayer: f.caller.identity,
          recipient: f.authority.identity.publicKey,
        }).sendAndConfirm(f.caller),
        { message: /NotAllSettled/ }
      );
      getSvm().setAccount(publicKeyBytes(f.authorityAta), original);
      const payerBefore = (
        await f.caller.rpc.getBalance(f.caller.identity.publicKey)
      ).basisPoints;
      await withdraw();
      t.is((await f.caller.rpc.getAccount(f.escrow))!.data.length, 0);
      t.is((await fetchToken(f.caller, f.authorityAta)).amount, 50n);
      t.true(
        (await f.caller.rpc.getBalance(f.caller.identity.publicKey))
          .basisPoints > payerBefore
      );
    });
  }
}

for (const standard of ['core', 'cnft-v2']) {
  test(`R12-01: ${standard} rejects a non-escrow Token-2022 payment destination`, async (t) => {
    const f = await setup(standard, true, true);
    const audit = require(
      `${process.cwd()}/../../configs/program-scripts/check-token2022-escrows.cjs`
    );
    const guardData = (await f.caller.rpc.getAccount(
      findGumballGuardPda(f.caller, { base: f.machine })[0]
    ))!.data;
    const [configured] = audit.decodeGuardSets(guardData);
    t.is(configured.destinationAta, f.destinationAta);
    t.not(configured.destinationAta, audit.expectedAta(f.machine, f.mint));
    await t.throwsAsync(f.drawItem(), { message: /PublicKeyMismatch/ });
    const machine = await fetchGumballMachine(f.caller, f.machine);
    t.is(machine.totalRevenue, 0n);
    t.is(machine.itemsRedeemed, 0n);
    t.is((await fetchToken(f.caller, f.authorityAta)).amount, 0n);
  });
}

test('R13-04: fully paid entries return rent to the recipient when the original payer is empty', async (t) => {
  const f = await setup('core', false);
  await f.drawItem();
  await f.claim();
  await reassignTokenOwner(
    f.authority,
    f.authorityAta,
    f.buyer.identity.publicKey
  );
  await f.settle().sendAndConfirm(f.caller);
  await reassignTokenOwner(
    f.buyer,
    f.authorityAta,
    f.authority.identity.publicKey
  );
  await disableRentPayer(f.buyer, f.caller.identity, 'drain');
  const recipientBefore = (
    await f.buyer.rpc.getBalance(f.authority.identity.publicKey)
  ).basisPoints;
  await measureAndSend(
    withdrawPayout(f.buyer, {
      gumballMachine: f.machine,
      recipient: f.authority.identity,
      rentPayer: f.caller.identity.publicKey,
      amount: 50,
      paymentMint: f.mint,
      authorityPdaPaymentAccount: f.destinationAta,
      recipientPaymentAccount: f.authorityAta,
    }),
    f.buyer,
    'withdraw_payout',
    'empty-rent-payer-fallback'
  );
  t.is((await f.buyer.rpc.getAccount(f.escrow))!.data.length, 0);
  t.is((await fetchToken(f.buyer, f.authorityAta)).amount, 50n);
  t.is(
    (await f.buyer.rpc.getBalance(f.authority.identity.publicKey)).basisPoints -
      recipientBefore,
    779520n
  );
  await closeGumballMachine(f.authority, {
    machine: f.machine,
    gumballGuard: findGumballGuardPda(f.authority, { base: f.machine })[0],
    paymentMint: f.mint,
    authorityPdaPaymentAccount: f.destinationAta,
  }).sendAndConfirm(f.authority);
  t.false((await f.buyer.rpc.getAccount(f.machine)).exists);
});

for (const closeFirst of [false, true]) {
  test(`R13-04/R13-08: assigned rent payer cannot pin recovery; closeFirst=${closeFirst}`, async (t) => {
    const f = await setup('core', false);
    await f.drawItem();
    await f.claim();
    await reassignTokenOwner(
      f.authority,
      f.authorityAta,
      f.buyer.identity.publicKey
    );
    await f.settle().sendAndConfirm(f.caller);
    await reassignTokenOwner(
      f.buyer,
      f.authorityAta,
      f.authority.identity.publicKey
    );
    await disableRentPayer(f.buyer, f.caller.identity, 'assign');
    const close = () =>
      closeGumballMachine(f.authority, {
        machine: f.machine,
        gumballGuard: findGumballGuardPda(f.authority, { base: f.machine })[0],
        paymentMint: f.mint,
        authorityPdaPaymentAccount: f.destinationAta,
      }).sendAndConfirm(f.authority);
    if (closeFirst) await close();
    await measureAndSend(
      withdrawPayout(f.buyer, {
        gumballMachine: f.machine,
        recipient: f.authority.identity,
        rentPayer: f.caller.identity.publicKey,
        amount: 50,
        paymentMint: f.mint,
        authorityPdaPaymentAccount: f.destinationAta,
        recipientPaymentAccount: f.authorityAta,
      }),
      f.buyer,
      'withdraw_payout',
      closeFirst ? 'after-close' : 'assigned-rent-payer'
    );
    t.is((await f.buyer.rpc.getAccount(f.escrow))!.data.length, 0);
    t.is((await fetchToken(f.buyer, f.authorityAta)).amount, 50n);
    if (!closeFirst) await close();
    t.false((await f.buyer.rpc.getAccount(f.machine)).exists);
  });
}

// Model a zero-debt entry created by the pre-fix withdrawal implementation.
test('R13-08: legacy zero-debt rent recovery survives machine close', async (t) => {
  const f = await setup('core', false);
  await f.drawItem();
  await f.claim();
  makeUnusable(f.authorityAta, 'owner', f.buyer.identity.publicKey);
  await f.settle().sendAndConfirm(f.caller);
  const key = publicKeyBytes(f.escrow);
  const account = getSvm().getAccount(key)!;
  const data = account.data();
  data.fill(0, 64, 72);
  getSvm().setAccount(
    key,
    new Account(account.lamports(), data, account.owner(), false, 0n)
  );
  // Zero debt now releases the vault's surplus to the authority on close.
  await reassignTokenOwner(
    f.buyer,
    f.authorityAta,
    f.authority.identity.publicKey
  );
  await closeGumballMachine(f.authority, {
    machine: f.machine,
    gumballGuard: findGumballGuardPda(f.authority, { base: f.machine })[0],
    paymentMint: f.mint,
    authorityPdaPaymentAccount: f.destinationAta,
  }).sendAndConfirm(f.authority);
  await recoverPayoutRent(f.buyer, {
    gumballMachine: f.machine,
    rentPayer: f.caller.identity,
    recipient: f.authority.identity.publicKey,
  }).sendAndConfirm(f.buyer);
  t.is((await f.buyer.rpc.getAccount(f.escrow))!.data.length, 0);
});
