import { fetchAsset } from '@metaplex-foundation/mpl-core';
import {
  fetchToken,
  findAssociatedTokenPda,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  publicKeyBytes,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { writeFileSync } from 'fs';
import { Account } from 'litesvm/dist/internal';
import {
  approveAddItem,
  cancelAddCnftRequest,
  cancelAddCnftRequestV2,
  cancelAddCoreAssetRequest,
  cancelAddNftRequest,
  deleteGumballMachine,
  fetchAddItemRequest,
  fetchGumballMachine,
  findAddItemRequestPda,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getAddItemRequestStatus,
  getGumballMachineSizeForItemCount,
  getMerkleRoot,
  GUMBALL_MACHINE_SIZE,
  migrateAddItemRequests,
  MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
  rejectAddItemRequest,
  requestAddCnft,
  requestAddCnftV2,
  requestAddCoreAsset,
  requestAddNft,
  setMintAuthority,
  updateSettings,
  withRequestCancellationMachine,
} from '../src';
import {
  mintCnft as mintV1,
  cnftArgs as v1Args,
  proofAccounts as v1Nodes,
  getCnftProof as v1Proof,
  createCnftUmi as v1Umi,
} from './_cnftSetup';
import {
  mintCnft as mintV2,
  cnftArgs as v2Args,
  proofAccounts as v2Nodes,
  getCnftProof as v2Proof,
  createCnftUmi as v2Umi,
} from './_cnftV2Setup';
import {
  create,
  createCoreAsset,
  createNft,
  createProgrammableNft,
  createUmi,
  setupGlobalConfig,
} from './_setup';
import { getSvm } from './litesvm/svm';

const measurements: any[] = [];
const measure = async (
  umi: any,
  builder: any,
  instruction: string,
  scenario: string
) => {
  const tx = await builder.buildAndSign(umi);
  const simulation = await umi.rpc.simulateTransaction(tx);
  if (simulation.err) throw new Error(JSON.stringify(simulation));
  const row = {
    instruction,
    scenario,
    serializedBytes: umi.transactions.serialize(tx).length,
    computeUnits: simulation.unitsConsumed,
  };
  measurements.push(row);
  // Canonical PDA search charges 1,500 CU for every failed bump attempt.
  // Keep the execution budget fixed while accounting for random asset keys.
  let bumpSearchUnits = 0;
  for (const ix of builder.getInstructions()) {
    const requests =
      instruction === 'reject_add_item_request'
        ? [ix.keys[1]]
        : ix.keys.slice(5);
    for (const account of requests) {
      const request = await fetchAddItemRequest(umi, account.pubkey);
      const [, bump] = findAddItemRequestPda(umi, { asset: request.asset });
      bumpSearchUnits += (255 - bump) * 1500;
    }
  }
  if (row.serializedBytes > 1232 || row.computeUnits > 25000 + bumpSearchUnits)
    throw new Error(`Request admin budget exceeded: ${JSON.stringify(row)}`);
  return row;
};
test.after(() => {
  if (process.env.CNFT_V2_FIX9_METRICS_OUT)
    writeFileSync(
      process.env.CNFT_V2_FIX9_METRICS_OUT,
      `${JSON.stringify(measurements, null, 2)}\n`
    );
});

let marketplace: any;
test.before(async () => {
  marketplace = await createUmi();
  await setupGlobalConfig(marketplace, marketplace.identity);
});

const replaceData = (key: any, change: (data: Uint8Array) => Uint8Array) => {
  const bytes = publicKeyBytes(key);
  const account = getSvm().getAccount(bytes)!;
  getSvm().setAccount(
    bytes,
    new Account(
      account.lamports(),
      change(account.data()),
      account.owner(),
      false,
      0n
    )
  );
};

const legacyFixture = async (requestBump?: number) => {
  const curator = await createUmi();
  const seller = await createUmi();
  const machine = (
    await create(curator, {
      settings: { itemCapacity: 2, itemsPerSeller: 2, curatorFeeBps: 500 },
    })
  ).publicKey;
  let asset = generateSigner(seller);
  if (requestBump !== undefined) {
    while (
      findAddItemRequestPda(curator, { asset: asset.publicKey })[1] !==
      requestBump
    )
      asset = generateSigner(seller);
  }
  await createCoreAsset(seller, { asset });
  await requestAddCoreAsset(seller, {
    gumballMachine: machine,
    asset: asset.publicKey,
  }).sendAndConfirm(seller);
  const request = findAddItemRequestPda(curator, { asset: asset.publicKey })[0];
  const requestKey = publicKeyBytes(request);
  const legacy = getSvm().getAccount(requestKey)!;
  getSvm().setAccount(
    requestKey,
    new Account(
      (await curator.rpc.getRent(105)).basisPoints,
      legacy.data().slice(0, 105),
      legacy.owner(),
      false,
      0n
    )
  );
  replaceData(machine, (data) => {
    data.fill(0, GUMBALL_MACHINE_SIZE - 9, GUMBALL_MACHINE_SIZE);
    return data;
  });
  const current = await fetchGumballMachine(curator, machine);
  const update = (settings: any) =>
    updateSettings(curator, {
      gumballMachine: machine,
      settings: { ...current.settings, ...settings },
    });
  const migrate = (complete: boolean, requests = [request]) =>
    migrateAddItemRequests(marketplace, {
      gumballMachine: machine,
      complete,
    }).addRemainingAccounts(
      requests.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true }))
    );
  return { curator, seller, machine, asset, request, update, migrate };
};

test('R9-07: uncounted legacy requests lock economics before first touch, including atomic root and approval', async (t) => {
  const f = await legacyFixture();
  for (const settings of [
    { curatorFeeBps: 10000 },
    { paymentMint: generateSigner(f.curator).publicKey },
    { itemsPerSeller: 1 },
    { hideSoldItems: true },
  ]) {
    await t.throwsAsync(f.update(settings).sendAndConfirm(f.curator), {
      message: /Error Number: 6045/,
    });
  }
  await t.throwsAsync(
    transactionBuilder()
      .add(
        f.update({
          curatorFeeBps: 10000,
          sellersMerkleRoot: some(getMerkleRoot([f.seller.identity.publicKey])),
        })
      )
      .add(
        approveAddItem(f.curator, {
          gumballMachine: f.machine,
          seller: f.seller.identity.publicKey,
          asset: f.asset.publicKey,
        })
      )
      .sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
  await t.throwsAsync(
    setMintAuthority(f.curator, {
      gumballMachine: f.machine,
      mintAuthority: generateSigner(f.curator),
    }).sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
  t.is((await fetchGumballMachine(f.curator, f.machine)).itemsLoaded, 0);
});

test('R9-07: marketplace migration counts legacy requests once and cancellation releases the lock', async (t) => {
  const f = await legacyFixture();
  t.false(
    (await fetchGumballMachine(f.curator, f.machine)).addRequestsMigrated
  );
  await measure(
    marketplace,
    f.migrate(false),
    'migrate_add_item_requests',
    'legacy-rent-top-up'
  );
  await f.migrate(false).sendAndConfirm(marketplace);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    1n
  );
  await measure(
    marketplace,
    f.migrate(true, []),
    'migrate_add_item_requests',
    'final-attestation'
  );
  await f.migrate(true, [f.request, f.request]).sendAndConfirm(marketplace);
  t.true((await fetchGumballMachine(f.curator, f.machine)).addRequestsMigrated);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    1n
  );
  t.is(getSvm().getAccount(publicKeyBytes(f.request))!.data()[106], 1);
  await t.throwsAsync(
    f.update({ curatorFeeBps: 10000 }).sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
  await withRequestCancellationMachine(
    cancelAddCoreAssetRequest(f.seller, {
      asset: f.asset.publicKey,
      sellerHistory: findSellerHistoryPda(f.curator, {
        gumballMachine: f.machine,
        seller: f.seller.identity.publicKey,
      }),
      authorityPda: findGumballMachineAuthorityPda(f.curator, {
        gumballMachine: f.machine,
      }),
    }),
    f.machine
  ).sendAndConfirm(f.seller);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    0n
  );
  await f
    .update({
      curatorFeeBps: 10000,
      paymentMint: generateSigner(f.curator).publicKey,
    })
    .sendAndConfirm(f.curator);
  await t.throwsAsync(f.migrate(true, []).sendAndConfirm(marketplace), {
    message: /Error Number: 6045/,
  });
});

test('R9-07: curator cannot attest a request scan or migrate another machine request', async (t) => {
  const f = await legacyFixture();
  await t.throwsAsync(
    migrateAddItemRequests(f.curator, {
      gumballMachine: f.machine,
      complete: true,
    }).sendAndConfirm(f.curator),
    { message: /Error Number: 6037/ }
  );
  const other = await legacyFixture();
  await t.throwsAsync(
    f.migrate(true, [other.request]).sendAndConfirm(marketplace),
    { message: /Error Number: 6051/ }
  );
  await t.throwsAsync(
    migrateAddItemRequests(marketplace, {
      gumballMachine: f.machine,
      complete: true,
    })
      .addRemainingAccounts([
        { pubkey: f.request, isSigner: false, isWritable: false },
      ])
      .sendAndConfirm(marketplace),
    { message: /Error Number: 6051/ }
  );
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    0n
  );
});

test('request admin budget accounts for low canonical PDA bumps', async (t) => {
  const f = await legacyFixture(245);
  const row = await measure(
    f.curator,
    rejectAddItemRequest(f.curator, {
      gumballMachine: f.machine,
      addItemRequest: f.request,
    }),
    'reject_add_item_request',
    'low-bump-legacy-rent-top-up'
  );
  t.true(row.computeUnits > 25000);
});

test('R9-07/R9-08: legacy rejection remains cancellable and is excluded from migration', async (t) => {
  const f = await legacyFixture();
  await measure(
    f.curator,
    rejectAddItemRequest(f.curator, {
      gumballMachine: f.machine,
      addItemRequest: f.request,
    }),
    'reject_add_item_request',
    'legacy-rent-top-up'
  );
  await rejectAddItemRequest(f.curator, {
    gumballMachine: f.machine,
    addItemRequest: f.request,
  }).sendAndConfirm(f.curator);
  t.is(
    getAddItemRequestStatus(
      getSvm().getAccount(publicKeyBytes(f.request))!.data()
    ),
    'rejected'
  );
  await f.migrate(true).sendAndConfirm(marketplace);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    0n
  );
  await f.update({ curatorFeeBps: 10000 }).sendAndConfirm(f.curator);
  await cancelAddCoreAssetRequest(f.seller, {
    asset: f.asset.publicKey,
    sellerHistory: findSellerHistoryPda(f.curator, {
      gumballMachine: f.machine,
      seller: f.seller.identity.publicKey,
    }),
    authorityPda: findGumballMachineAuthorityPda(f.curator, {
      gumballMachine: f.machine,
    }),
  }).sendAndConfirm(f.seller);
  t.false(await f.curator.rpc.accountExists(f.request));
});

for (const standard of ['Core', 'NFT', 'pNFT', 'v1', 'v2']) {
  test(`R9-08: rejecting a ${standard} request releases state-None lock, forbids approval, preserves seller cancellation`, async (t) => {
    const curator =
      standard === 'v1' ? await v1Umi(createUmi) : await v2Umi(createUmi);
    const seller =
      standard === 'v1' ? await v1Umi(createUmi) : await v2Umi(createUmi);
    const machine = (
      await create(curator, {
        settings: { itemCapacity: 2, itemsPerSeller: 2, curatorFeeBps: 500 },
      })
    ).publicKey;
    const item =
      standard === 'Core'
        ? await createCoreAsset(seller)
        : standard === 'NFT'
          ? await createNft(seller)
          : standard === 'pNFT'
            ? await createProgrammableNft(seller)
            : standard === 'v1'
              ? await mintV1(seller)
              : await mintV2(seller);
    const asset = (item as any).assetId ?? item.publicKey;
    if (standard === 'Core')
      await requestAddCoreAsset(seller, {
        gumballMachine: machine,
        asset,
      }).sendAndConfirm(seller);
    else if (standard === 'NFT' || standard === 'pNFT')
      await requestAddNft(seller, {
        gumballMachine: machine,
        mint: asset,
        authRulesProgram:
          standard === 'pNFT' ? MPL_TOKEN_AUTH_RULES_PROGRAM_ID : undefined,
      }).sendAndConfirm(seller);
    else {
      const v2 = standard === 'v2';
      await (v2 ? requestAddCnftV2 : requestAddCnft)(seller, {
        gumballMachine: machine,
        asset,
        treeConfig: (item as any).treeConfig,
        merkleTree: (item as any).merkleTree,
        leafDelegate: (item as any).owner,
        args: (v2 ? v2Args : v1Args)(seller, item as any),
      })
        .addRemainingAccounts(
          (v2 ? v2Nodes : v1Nodes)(
            (v2 ? v2Proof : v1Proof)(seller, item as any).proof
          )
        )
        .sendAndConfirm(seller);
      (item as any).owner = findGumballMachineAuthorityPda(curator, {
        gumballMachine: machine,
      })[0];
    }
    const request = findAddItemRequestPda(curator, { asset })[0];
    const outsider = await createUmi();
    await t.throwsAsync(
      rejectAddItemRequest(outsider, {
        gumballMachine: machine,
        addItemRequest: request,
      }).sendAndConfirm(outsider),
      { message: /Error Number: 6037/ }
    );
    const beforeSeller = (
      await seller.rpc.getBalance(seller.identity.publicKey)
    ).basisPoints;
    await measure(
      curator,
      rejectAddItemRequest(curator, {
        gumballMachine: machine,
        addItemRequest: request,
      }),
      'reject_add_item_request',
      standard
    );
    await rejectAddItemRequest(curator, {
      gumballMachine: machine,
      addItemRequest: request,
    }).sendAndConfirm(curator);
    t.is(
      (await seller.rpc.getBalance(seller.identity.publicKey)).basisPoints,
      beforeSeller
    );
    const current = await fetchGumballMachine(curator, machine);
    t.is(current.pendingAddRequests, 0n);
    t.is(current.state, 0);
    await updateSettings(curator, {
      gumballMachine: machine,
      settings: {
        ...current.settings,
        curatorFeeBps: 1000,
        paymentMint: generateSigner(curator).publicKey,
      },
    }).sendAndConfirm(curator);
    await updateSettings(curator, {
      gumballMachine: machine,
      settings: {
        ...current.settings,
        sellersMerkleRoot: some(getMerkleRoot([seller.identity.publicKey])),
      },
    }).sendAndConfirm(curator);
    await t.throwsAsync(
      approveAddItem(curator, {
        gumballMachine: machine,
        asset,
        seller: seller.identity.publicKey,
      }).sendAndConfirm(curator),
      { message: /Error Number: 6036/ }
    );
    await t.throwsAsync(
      rejectAddItemRequest(curator, {
        gumballMachine: machine,
        addItemRequest: request,
      }).sendAndConfirm(curator),
      { message: /Error Number: 6036/ }
    );
    const cancellation = {
      sellerHistory: findSellerHistoryPda(seller, {
        gumballMachine: machine,
        seller: seller.identity.publicKey,
      }),
      authorityPda: findGumballMachineAuthorityPda(seller, {
        gumballMachine: machine,
      }),
    };
    if (standard === 'Core') {
      await cancelAddCoreAssetRequest(seller, {
        asset,
        ...cancellation,
      }).sendAndConfirm(seller);
      const returned = await fetchAsset(seller, asset);
      t.is(returned.owner, seller.identity.publicKey);
      t.falsy(returned.freezeDelegate?.frozen);
    } else if (standard === 'NFT' || standard === 'pNFT') {
      await cancelAddNftRequest(seller, {
        mint: asset,
        authRulesProgram:
          standard === 'pNFT' ? MPL_TOKEN_AUTH_RULES_PROGRAM_ID : undefined,
        ...cancellation,
      }).sendAndConfirm(seller);
      const token = await fetchToken(
        seller,
        findAssociatedTokenPda(seller, {
          mint: asset,
          owner: seller.identity.publicKey,
        })
      );
      t.is(token.owner, seller.identity.publicKey);
      t.deepEqual(token.delegate, none());
      if (standard === 'NFT') t.is(token.state, TokenState.Initialized);
    } else {
      const v2 = standard === 'v2';
      await (v2 ? cancelAddCnftRequestV2 : cancelAddCnftRequest)(seller, {
        asset,
        ...cancellation,
        treeConfig: (item as any).treeConfig,
        merkleTree: (item as any).merkleTree,
        args: (v2 ? v2Args : v1Args)(seller, item as any),
      })
        .addRemainingAccounts(
          (v2 ? v2Nodes : v1Nodes)(
            (v2 ? v2Proof : v1Proof)(seller, item as any).proof
          )
        )
        .sendAndConfirm(seller);
      (item as any).owner = seller.identity.publicKey;
      // A new escrow proves the returned proof names the seller again.
      await (v2 ? requestAddCnftV2 : requestAddCnft)(seller, {
        gumballMachine: machine,
        asset,
        treeConfig: (item as any).treeConfig,
        merkleTree: (item as any).merkleTree,
        leafDelegate: (item as any).owner,
        args: (v2 ? v2Args : v1Args)(seller, item as any),
      })
        .addRemainingAccounts(
          (v2 ? v2Nodes : v1Nodes)(
            (v2 ? v2Proof : v1Proof)(seller, item as any).proof
          )
        )
        .sendAndConfirm(seller);
    }
    if (standard !== 'v1' && standard !== 'v2')
      t.false(await curator.rpc.accountExists(request));
  });
}

test('R9-08: rejection clears a capacity-700 legacy v5 request without enabling the v6 ledger', async (t) => {
  const curator = await v2Umi(createUmi);
  const seller = await v2Umi(createUmi);
  const machine = (
    await create(curator, {
      settings: {
        itemCapacity: 700,
        itemsPerSeller: 2,
        sellersMerkleRoot: some(
          getMerkleRoot([generateSigner(curator).publicKey])
        ),
      },
    })
  ).publicKey;
  replaceData(machine, (data) =>
    data.slice(0, getGumballMachineSizeForItemCount(700, 5))
  );
  const item = await mintV2(seller);
  await requestAddCnftV2(seller, {
    gumballMachine: machine,
    asset: item.assetId,
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    leafDelegate: item.owner,
    args: v2Args(seller, item),
  })
    .addRemainingAccounts(v2Nodes(v2Proof(seller, item).proof))
    .sendAndConfirm(seller);
  const request = findAddItemRequestPda(curator, { asset: item.assetId })[0];
  await t.throwsAsync(
    approveAddItem(curator, {
      gumballMachine: machine,
      asset: item.assetId,
      seller: seller.identity.publicKey,
    }).sendAndConfirm(curator),
    { message: /Error Number: 6078/ }
  );
  await rejectAddItemRequest(curator, {
    gumballMachine: machine,
    addItemRequest: request,
  }).sendAndConfirm(curator);
  const current = await fetchGumballMachine(curator, machine);
  t.is(current.pendingAddRequests, 0n);
  t.is(current.version, 5);
  await updateSettings(curator, {
    gumballMachine: machine,
    settings: { ...current.settings, sellersMerkleRoot: none() },
  }).sendAndConfirm(curator);
  item.owner = findGumballMachineAuthorityPda(curator, {
    gumballMachine: machine,
  })[0];
  await cancelAddCnftRequestV2(seller, {
    asset: item.assetId,
    sellerHistory: findSellerHistoryPda(seller, {
      gumballMachine: machine,
      seller: seller.identity.publicKey,
    }),
    authorityPda: findGumballMachineAuthorityPda(seller, {
      gumballMachine: machine,
    }),
    treeConfig: item.treeConfig,
    merkleTree: item.merkleTree,
    args: v2Args(seller, item),
  })
    .addRemainingAccounts(v2Nodes(v2Proof(seller, item).proof))
    .sendAndConfirm(seller);
  t.false(await curator.rpc.accountExists(request));
});

test('R9-08: cancelled rejected requests do not consume another request count, and withdrawal survives closure', async (t) => {
  const f = await legacyFixture();
  await f.migrate(true).sendAndConfirm(marketplace);
  const second = await createCoreAsset(f.seller);
  await requestAddCoreAsset(f.seller, {
    gumballMachine: f.machine,
    asset: second.publicKey,
  }).sendAndConfirm(f.seller);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    2n
  );
  await rejectAddItemRequest(f.curator, {
    gumballMachine: f.machine,
    addItemRequest: f.request,
  }).sendAndConfirm(f.curator);
  const accounts = {
    sellerHistory: findSellerHistoryPda(f.seller, {
      gumballMachine: f.machine,
      seller: f.seller.identity.publicKey,
    }),
    authorityPda: findGumballMachineAuthorityPda(f.seller, {
      gumballMachine: f.machine,
    }),
  };
  await withRequestCancellationMachine(
    cancelAddCoreAssetRequest(f.seller, {
      asset: f.asset.publicKey,
      ...accounts,
    }),
    f.machine
  ).sendAndConfirm(f.seller);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    1n
  );
  await t.throwsAsync(
    f.update({ curatorFeeBps: 10000 }).sendAndConfirm(f.curator),
    { message: /Error Number: 6045/ }
  );
  const request = findAddItemRequestPda(f.curator, {
    asset: second.publicKey,
  })[0];
  await rejectAddItemRequest(f.curator, {
    gumballMachine: f.machine,
    addItemRequest: request,
  }).sendAndConfirm(f.curator);
  t.is(
    (await fetchGumballMachine(f.curator, f.machine)).pendingAddRequests,
    0n
  );
  await deleteGumballMachine(f.curator, {
    gumballMachine: f.machine,
  }).sendAndConfirm(f.curator);
  await cancelAddCoreAssetRequest(f.seller, {
    asset: second.publicKey,
    ...accounts,
  }).sendAndConfirm(f.seller);
  t.false(await f.curator.rpc.accountExists(request));
});

test('R10-05: reconciled header never approves an untracked legacy request; seller can cancel', async (t) => {
  const f = await legacyFixture();
  replaceData(f.machine, (data) => {
    data[410] = 1;
    return data;
  });
  await f
    .update({
      sellersMerkleRoot: some(getMerkleRoot([f.seller.identity.publicKey])),
    })
    .sendAndConfirm(f.curator);
  await t.throwsAsync(
    approveAddItem(f.curator, {
      gumballMachine: f.machine,
      seller: f.seller.identity.publicKey,
      asset: f.asset.publicKey,
    }).sendAndConfirm(f.curator),
    { message: /Error Number: 6036/ }
  );
  t.is((await fetchGumballMachine(f.curator, f.machine)).itemsLoaded, 0);
  await cancelAddCoreAssetRequest(f.seller, {
    asset: f.asset.publicKey,
    sellerHistory: findSellerHistoryPda(f.curator, {
      gumballMachine: f.machine,
      seller: f.seller.identity.publicKey,
    }),
    authorityPda: findGumballMachineAuthorityPda(f.curator, {
      gumballMachine: f.machine,
    }),
  }).sendAndConfirm(f.seller);
  t.false(await f.curator.rpc.accountExists(f.request));
});
