import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  publicKeyBytes,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import {
  approveAddItem,
  cancelAddCoreAssetRequest,
  deleteGumballMachine,
  fetchGumballMachine,
  findAddItemRequestPda,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getMerkleRoot,
  GUMBALL_MACHINE_SIZE,
  requestAddCoreAsset,
  updateSettings,
} from '../src';
import { create, createCoreAsset, createUmi } from './_setup';
import { getSvm } from './litesvm/svm';

const setup = async (version = 5) => {
  const curator = await createUmi();
  const seller = await createUmi();
  const machine = await create(curator, {
    settings: { itemCapacity: 3, itemsPerSeller: 3, curatorFeeBps: 500 },
  });
  const key = publicKeyBytes(machine.publicKey);
  const account = getSvm().getAccount(key)!;
  const data = account.data();
  data[8] = version;
  getSvm().setAccount(
    key,
    new Account(account.lamports(), data, account.owner(), false, 0n)
  );
  const asset = await createCoreAsset(seller);
  await requestAddCoreAsset(seller, {
    gumballMachine: machine.publicKey,
    asset: asset.publicKey,
  }).sendAndConfirm(seller);
  const current = await fetchGumballMachine(curator, machine.publicKey);
  const update = (settings: any) =>
    updateSettings(curator, {
      gumballMachine: machine.publicKey,
      settings: { ...current.settings, ...settings },
    });
  const cancel = () =>
    cancelAddCoreAssetRequest(seller, {
      asset: asset.publicKey,
      sellerHistory: findSellerHistoryPda(curator, {
        gumballMachine: machine.publicKey,
        seller: seller.identity.publicKey,
      }),
      authorityPda: findGumballMachineAuthorityPda(curator, {
        gumballMachine: machine.publicKey,
      }),
    }).addRemainingAccounts([
      { pubkey: machine.publicKey, isSigner: false, isWritable: true },
    ]);
  return { curator, seller, machine, asset, current, update, cancel };
};

for (const version of [0, 1, 2, 3, 4, 5]) {
  test(`R8-01/R8-05/R8-21: v${version} uninvited pending request locks economics and cancellation releases the lock`, async (t) => {
    const f = await setup(version);
    t.is(f.current.pendingAddRequests, 1n);
    for (const settings of [
      { curatorFeeBps: 10000 },
      { itemsPerSeller: 2 },
      { hideSoldItems: !f.current.settings.hideSoldItems },
      { paymentMint: generateSigner(f.curator).publicKey },
    ]) {
      await t.throwsAsync(f.update(settings).sendAndConfirm(f.curator), {
        message: /Error Number: 6045/,
      });
    }
    await f.cancel().sendAndConfirm(f.seller);
    t.is(
      (await fetchGumballMachine(f.curator, f.machine.publicKey))
        .pendingAddRequests,
      0n
    );
    await f
      .update({
        curatorFeeBps: 1000,
        paymentMint: generateSigner(f.curator).publicKey,
      })
      .sendAndConfirm(f.curator);
    t.is(
      (await fetchGumballMachine(f.curator, f.machine.publicKey)).settings
        .curatorFeeBps,
      1000
    );
  });
}

test('R8-02/R8-21: approval requires a root and root-before-approval works atomically', async (t) => {
  const f = await setup();
  const approve = () =>
    approveAddItem(f.curator, {
      gumballMachine: f.machine.publicKey,
      seller: f.seller.identity.publicKey,
      asset: f.asset.publicKey,
    });
  await t.throwsAsync(approve().sendAndConfirm(f.curator), {
    message: /Error Number: 6036/,
  });
  const root = some(getMerkleRoot([f.seller.identity.publicKey]));
  await t.throwsAsync(
    transactionBuilder()
      .add(f.update({ sellersMerkleRoot: root, curatorFeeBps: 10000 }))
      .add(approve())
      .sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
  await transactionBuilder()
    .add(f.update({ sellersMerkleRoot: root }))
    .add(approve())
    .sendAndConfirm(f.curator);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine.publicKey)).itemsLoaded,
    1
  );
  t.is(
    (await fetchGumballMachine(f.curator, f.machine.publicKey))
      .pendingAddRequests,
    0n
  );
  await t.throwsAsync(
    f.update({ sellersMerkleRoot: none() }).sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
});

test('R8-05: cancellation of the last uninvited request permits removing the last collaborator', async (t) => {
  const f = await setup();
  await f
    .update({
      sellersMerkleRoot: some(
        getMerkleRoot([generateSigner(f.curator).publicKey])
      ),
    })
    .sendAndConfirm(f.curator);
  await t.throwsAsync(
    f.update({ sellersMerkleRoot: none() }).sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
  const other = await createCoreAsset(f.seller);
  await requestAddCoreAsset(f.seller, {
    gumballMachine: f.machine.publicKey,
    asset: other.publicKey,
  }).sendAndConfirm(f.seller);
  await f.cancel().sendAndConfirm(f.seller);
  await t.throwsAsync(
    f.update({ sellersMerkleRoot: none() }).sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
  await cancelAddCoreAssetRequest(f.seller, {
    asset: other.publicKey,
    sellerHistory: findSellerHistoryPda(f.curator, {
      gumballMachine: f.machine.publicKey,
      seller: f.seller.identity.publicKey,
    }),
    authorityPda: findGumballMachineAuthorityPda(f.curator, {
      gumballMachine: f.machine.publicKey,
    }),
  })
    .addRemainingAccounts([
      { pubkey: f.machine.publicKey, isSigner: false, isWritable: true },
    ])
    .sendAndConfirm(f.seller);
  await f.update({ sellersMerkleRoot: none() }).sendAndConfirm(f.curator);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine.publicKey)).settings
      .sellersMerkleRoot.__option,
    'None'
  );
});

test('R8-05: a tracked cancellation requires the correct writable machine', async (t) => {
  const f = await setup();
  const cancel = cancelAddCoreAssetRequest(f.seller, {
    asset: f.asset.publicKey,
    sellerHistory: findSellerHistoryPda(f.curator, {
      gumballMachine: f.machine.publicKey,
      seller: f.seller.identity.publicKey,
    }),
    authorityPda: findGumballMachineAuthorityPda(f.curator, {
      gumballMachine: f.machine.publicKey,
    }),
  });
  for (const builder of [
    cancel,
    cancel.addRemainingAccounts([
      { pubkey: f.machine.publicKey, isSigner: false, isWritable: false },
    ]),
    cancel.addRemainingAccounts([
      { pubkey: f.asset.publicKey, isSigner: false, isWritable: true },
    ]),
  ]) {
    await t.throwsAsync(builder.sendAndConfirm(f.seller), {
      message: /Error Number: 6051/,
    });
    t.is(
      (await fetchGumballMachine(f.curator, f.machine.publicKey))
        .pendingAddRequests,
      1n
    );
  }
  await f.cancel().sendAndConfirm(f.seller);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine.publicKey))
      .pendingAddRequests,
    0n
  );
});

test('R8-05: pre-upgrade requests cancel with their original account list', async (t) => {
  const f = await setup();
  const key = publicKeyBytes(
    findAddItemRequestPda(f.seller, { asset: f.asset.publicKey })[0]
  );
  const request = getSvm().getAccount(key)!;
  getSvm().setAccount(
    key,
    new Account(
      request.lamports(),
      request.data().slice(0, 105),
      request.owner(),
      false,
      0n
    )
  );
  const machineKey = publicKeyBytes(f.machine.publicKey);
  const machine = getSvm().getAccount(machineKey)!;
  const data = machine.data();
  data.fill(0, GUMBALL_MACHINE_SIZE - 8, GUMBALL_MACHINE_SIZE);
  getSvm().setAccount(
    machineKey,
    new Account(machine.lamports(), data, machine.owner(), false, 0n)
  );
  await cancelAddCoreAssetRequest(f.seller, {
    asset: f.asset.publicKey,
    sellerHistory: findSellerHistoryPda(f.curator, {
      gumballMachine: f.machine.publicKey,
      seller: f.seller.identity.publicKey,
    }),
    authorityPda: findGumballMachineAuthorityPda(f.curator, {
      gumballMachine: f.machine.publicKey,
    }),
  }).sendAndConfirm(f.seller);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine.publicKey))
      .pendingAddRequests,
    0n
  );
});

test('R8-01: the longest valid URI preserves live accounting and oversized edits fail', async (t) => {
  const f = await setup();
  await f
    .update({
      uri: 'x'.repeat(195),
      sellersMerkleRoot: some(getMerkleRoot([f.seller.identity.publicKey])),
    })
    .sendAndConfirm(f.curator);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine.publicKey))
      .pendingAddRequests,
    1n
  );
  await t.throwsAsync(
    f.update({ uri: 'x'.repeat(196) }).sendAndConfirm(f.curator),
    { message: /UriTooLong/ }
  );
  await f.cancel().sendAndConfirm(f.seller);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine.publicKey))
      .pendingAddRequests,
    0n
  );
});

test('R8-05: cancelling a request survives closure and program-owned address reuse', async (t) => {
  const f = await setup();
  await deleteGumballMachine(f.curator, {
    gumballMachine: f.machine.publicKey,
  }).sendAndConfirm(f.curator);
  await createAccount(f.curator, {
    newAccount: f.machine,
    space: 1,
    lamports: await f.curator.rpc.getRent(1),
    programId: f.curator.programs.get('mallowGumball').publicKey,
  }).sendAndConfirm(f.curator);
  await f.cancel().sendAndConfirm(f.seller);
  t.false(
    await f.seller.rpc.accountExists(
      findAddItemRequestPda(f.seller, { asset: f.asset.publicKey })[0]
    )
  );
  t.is(
    getSvm().getAccount(publicKeyBytes(f.machine.publicKey))!.data().length,
    1
  );
});
