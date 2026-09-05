import {
  AccountRole,
  generateKeyPairSigner,
  getAddressDecoder,
  some,
  type AccountSignerMeta,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import test, { type ExecutionContext } from 'ava';
import {
  draw,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getAddCoreAssetInstructionAsync,
  getClaimCoreAssetInstructionAsync,
  getEndSaleInstruction,
  getMerkleProof,
  getMerkleRoot,
  getSettleCoreAssetSaleInstructionAsync,
  getStartSaleInstruction,
} from '../src';
import { createCoreAsset } from './_nftKit';
import { getBalance, sellerHistoryExists } from './_settleSetup';
import {
  COMPUTE_UNITS,
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from './_setup';

/** Assert two lamport amounts are within `tol` of one another. */
const near = (
  t: ExecutionContext,
  actual: bigint,
  expected: bigint,
  tol: bigint = sol(0.01)
) => {
  const diff = actual > expected ? actual - expected : expected - actual;
  t.true(diff <= tol, `${actual} not within ${tol} of ${expected}`);
};

/** The system program id doubles as the "no buyer" sentinel for unsold items. */
const NO_BUYER = '11111111111111111111111111111111' as Address;

/** Read a core AssetV1's owner straight off the ledger (key byte + 32-byte owner). */
const coreAssetOwner = (
  client: Awaited<ReturnType<typeof createClient>>,
  asset: Address
): Address => {
  const account = client.svm.getAccount(asset);
  if (!account.exists) throw new Error(`Asset ${asset} not found`);
  return getAddressDecoder().decode(account.data.slice(1, 33));
};

/**
 * Hand-rolled mpl-core BurnV1 (disc 12, `compressionProof: None`). There is no
 * kit mpl-core client in this repo, so mirror the `_nftKit` approach and encode
 * the instruction directly. `payer` is the fee payer AND (with authority absent)
 * the burn authority, so it must be the current asset owner.
 */
const MPL_CORE_PROGRAM =
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address;
const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
const burnCoreAsset = (
  asset: Address,
  payer: TransactionSigner
): Instruction => ({
  programAddress: MPL_CORE_PROGRAM,
  accounts: [
    { address: asset, role: AccountRole.WRITABLE },
    { address: MPL_CORE_PROGRAM, role: AccountRole.READONLY }, // collection (absent)
    {
      address: payer.address,
      role: AccountRole.WRITABLE_SIGNER,
      signer: payer,
    } as AccountSignerMeta, // payer
    { address: MPL_CORE_PROGRAM, role: AccountRole.READONLY }, // authority (absent => payer)
    { address: SYSTEM_PROGRAM, role: AccountRole.READONLY }, // systemProgram
    { address: MPL_CORE_PROGRAM, role: AccountRole.READONLY }, // logWrapper (absent)
  ],
  data: new Uint8Array([12, 0]),
});

test('it can settle a core asset sale', async (t) => {
  const client = await createClient();
  const { asset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  const item = account.items[0];
  t.is(item.isDrawn, true);
  t.is(item.isClaimed, true);
  t.is(item.isSettled, true);
  t.is(item.mint, asset);
  t.is(item.seller, client.payer.address);
  t.is(item.buyer, buyer.address);
  t.is(item.amount, 1);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
  t.is(coreAssetOwner(client, asset), buyer.address);
});

test('it splits proceeds for a primary asset sale with multiple creators after claim', async (t) => {
  const client = await createClient();
  const secondCreator = (await generateKeyPairSigner()).address;
  const { asset } = await createCoreAsset(client, {
    royaltyBasisPoints: 1000,
    royaltyCreators: [
      { address: client.payer.address, percentage: 50 },
      { address: secondCreator, percentage: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimCoreAssetInstructionAsync({
      gumballMachine,
      payer: buyer,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      index: 0,
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const secondCreatorPre = getBalance(client, secondCreator);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      creators: [client.payer.address, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.5));
  near(t, getBalance(client, secondCreator), secondCreatorPre + sol(0.5));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it splits proceeds for a primary asset sale with multiple creators before claim', async (t) => {
  const client = await createClient();
  const secondCreator = (await generateKeyPairSigner()).address;
  const { asset } = await createCoreAsset(client, {
    royaltyBasisPoints: 1000,
    royaltyCreators: [
      { address: client.payer.address, percentage: 50 },
      { address: secondCreator, percentage: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const secondCreatorPre = getBalance(client, secondCreator);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      creators: [client.payer.address, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.5));
  near(t, getBalance(client, secondCreator), secondCreatorPre + sol(0.5));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it splits proceeds for a secondary asset sale with multiple creators after claim', async (t) => {
  // A secondary sale needs seller != asset update authority. `createCoreAsset`
  // always leaves the update authority as `client.payer`, so we sell as a
  // separate merkle-listed seller (mirrors the umi test's separate creator).
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const firstCreator = (await generateKeyPairSigner()).address;
  const secondCreator = (await generateKeyPairSigner()).address;
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { asset } = await createCoreAsset(client, {
    owner: otherSeller.address,
    royaltyBasisPoints: 1000,
    royaltyCreators: [
      { address: firstCreator, percentage: 50 },
      { address: secondCreator, percentage: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0, sellersMerkleRoot },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, otherSeller, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      asset,
      args: {
        sellerProofPath: getMerkleProof(
          [otherSeller.address],
          otherSeller.address
        ),
      },
    }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimCoreAssetInstructionAsync({
      gumballMachine,
      payer: buyer,
      seller: otherSeller.address,
      buyer: buyer.address,
      asset,
      index: 0,
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const [sellerHistory] = await findSellerHistoryPda({
    gumballMachine,
    seller: otherSeller.address,
  });
  const sellerHistoryRent = getBalance(client, sellerHistory);
  const sellerPre = getBalance(client, otherSeller.address);
  const firstCreatorPre = getBalance(client, firstCreator);
  const secondCreatorPre = getBalance(client, secondCreator);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: otherSeller.address,
      buyer: buyer.address,
      asset,
      creators: [firstCreator, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(
    t,
    getBalance(client, otherSeller.address),
    sellerPre + sol(0.9) + sellerHistoryRent
  );
  near(t, getBalance(client, firstCreator), firstCreatorPre + sol(0.05));
  near(t, getBalance(client, secondCreator), secondCreatorPre + sol(0.05));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it splits proceeds for a secondary asset sale with multiple creators before claim', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const firstCreator = (await generateKeyPairSigner()).address;
  const secondCreator = (await generateKeyPairSigner()).address;
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { asset } = await createCoreAsset(client, {
    owner: otherSeller.address,
    royaltyBasisPoints: 1000,
    royaltyCreators: [
      { address: firstCreator, percentage: 50 },
      { address: secondCreator, percentage: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0, sellersMerkleRoot },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, otherSeller, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      asset,
      args: {
        sellerProofPath: getMerkleProof(
          [otherSeller.address],
          otherSeller.address
        ),
      },
    }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const [sellerHistory] = await findSellerHistoryPda({
    gumballMachine,
    seller: otherSeller.address,
  });
  const sellerHistoryRent = getBalance(client, sellerHistory);
  const sellerPre = getBalance(client, otherSeller.address);
  const firstCreatorPre = getBalance(client, firstCreator);
  const secondCreatorPre = getBalance(client, secondCreator);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: otherSeller.address,
      buyer: buyer.address,
      asset,
      creators: [firstCreator, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(
    t,
    getBalance(client, otherSeller.address),
    sellerPre + sol(0.9) + sellerHistoryRent,
    sol(0.1)
  );
  near(t, getBalance(client, firstCreator), firstCreatorPre + sol(0.05));
  near(t, getBalance(client, secondCreator), secondCreatorPre + sol(0.05));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it can settle a core asset that was not sold', async (t) => {
  const client = await createClient();
  const { asset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    getEndSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: NO_BUYER,
      asset,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, client.payer.address), sellerPre);
  t.is(getBalance(client, authorityPda), authorityPdaPre);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 0n);
  t.is(account.itemsSettled, 1n);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
  t.is(coreAssetOwner(client, asset), client.payer.address);
});

test('it can settle a core asset that was not sold with proceeds from another sale', async (t) => {
  const client = await createClient();
  const assets = await Promise.all([
    createCoreAsset(client),
    createCoreAsset(client),
  ]);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: assets[0].asset,
    }),
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: assets[1].asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    getEndSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  let account = fetchGumballMachine(client.svm, gumballMachine);
  const unsold = account.items.find((i) => i.buyer == null)!;

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: unsold.index,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: unsold.seller as Address,
      buyer: NO_BUYER,
      asset: unsold.mint as Address,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.5));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(0.5));

  account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  t.is(account.itemsLoaded, 2);

  // Seller history should NOT be closed (the sold item is still unsettled).
  t.true(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
  t.is(coreAssetOwner(client, unsold.mint as Address), client.payer.address);
});

test('it cannot settle a core asset to the wrong buyer', async (t) => {
  const client = await createClient();
  const { asset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const promise = sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: client.payer.address, // wrong buyer
      asset,
      creators: [client.payer.address],
    }),
  ]);
  await t.throwsAsync(promise, { message: /InvalidBuyer/ });
});

test('it cannot settle a core asset sale twice', async (t) => {
  const client = await createClient();
  const assets = await Promise.all([
    createCoreAsset(client),
    createCoreAsset(client),
  ]);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: assets[0].asset,
    }),
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: assets[1].asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      asset: assets[0].asset,
      creators: [client.payer.address],
    }),
  ]);

  const promise = sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      asset: assets[0].asset,
      creators: [client.payer.address],
    }),
  ]);
  await t.throwsAsync(promise, { message: /ItemAlreadySettled/ });
});

test('it can settle a core asset sale where buyer is the seller', async (t) => {
  const client = await createClient();
  const { asset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: client.payer.address,
      asset,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
  t.is(coreAssetOwner(client, asset), client.payer.address);
});

test('it can settle a core asset sale for claimed core asset', async (t) => {
  const client = await createClient();
  const { asset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimCoreAssetInstructionAsync({
      gumballMachine,
      payer: buyer,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      index: 0,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  const item = account.items[0];
  t.is(item.isDrawn, true);
  t.is(item.isClaimed, true);
  t.is(item.isSettled, true);
  t.is(item.buyer, buyer.address);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
  t.is(coreAssetOwner(client, asset), buyer.address);
});

test('it can settle a core asset sale after asset has been claimed and burnt', async (t) => {
  const client = await createClient();
  const { asset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  // Claim then burn the asset (buyer owns it after claiming, so buyer can burn).
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimCoreAssetInstructionAsync({
      gumballMachine,
      payer: buyer,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      index: 0,
    }),
    burnCoreAsset(asset, buyer),
  ]);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleCoreAssetSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      asset,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  const item = account.items[0];
  t.is(item.isSettled, true);
  t.is(item.buyer, buyer.address);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
});
