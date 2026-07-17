import {
  AccountState,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  generateKeyPairSigner,
  getAddressDecoder,
  isNone,
  some,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import test, { type ExecutionContext } from 'ava';
import {
  draw,
  findGumballMachineAuthorityPda,
  getAddCoreAssetInstructionAsync,
  getAddNftInstructionAsync,
  getAddTokensInstructionAsync,
  getCloseGumballMachineInstructionAsync,
  getDefaultBuyBackConfig,
  getManageBuyBackFundsInstructionAsync,
  getSellItemInstructionAsync,
  getSettleNftSaleInstructionAsync,
  getSettleTokensSaleClaimedInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
  type BuyBackConfigArgs,
} from '../src';
import { createCoreAsset, createNft, createProgrammableNft } from './_nftKit';
import {
  createMintWithHolders,
  fetchTokenAccount,
  getBalance,
} from './_settleSetup';
import {
  COMPUTE_UNITS,
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
  type Client,
} from './_setup';

const AUTH_RULES_PROGRAM =
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address;

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

const ataFor = async (mint: Address, owner: Address): Promise<Address> => {
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata;
};

/** Build an enabled buy-back config authorised by `oracleSigner`. */
const buyBack = (
  oracleSigner: TransactionSigner,
  overrides: Partial<BuyBackConfigArgs> = {}
): BuyBackConfigArgs => ({
  ...getDefaultBuyBackConfig(),
  oracleSigner: oracleSigner.address,
  enabled: true,
  ...overrides,
});

/** Deposit or withdraw buy-back funds as the machine authority. */
const manageFunds = async (
  client: Client,
  gumballMachine: Address,
  amount: number | bigint,
  isWithdraw: boolean,
  paymentMint?: Address
) =>
  sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount,
      isWithdraw,
      paymentMint,
    }),
  ]);

type ExpectedItem = {
  index: number;
  isDrawn: boolean;
  isClaimed: boolean;
  isSettled: boolean;
  mint: Address;
  seller: Address;
  buyer: Address;
  tokenStandard: TokenStandard;
  amount: number;
};

const expectItem = (
  t: ExecutionContext,
  item: {
    index: number;
    isDrawn: boolean;
    isClaimed: boolean;
    isSettled: boolean;
    mint: string;
    seller: string;
    buyer?: string;
    tokenStandard: TokenStandard;
    amount: number;
  },
  e: ExpectedItem
) => {
  t.is(item.index, e.index);
  t.is(item.isDrawn, e.isDrawn);
  t.is(item.isClaimed, e.isClaimed);
  t.is(item.isSettled, e.isSettled);
  t.is(item.mint, e.mint);
  t.is(item.seller, e.seller);
  t.is(item.buyer, e.buyer);
  t.is(item.tokenStandard, e.tokenStandard);
  t.is(item.amount, e.amount);
};

/** Read the on-chain owner of an mpl-core AssetV1 (key(1) + owner(32)). */
const coreAssetOwner = (client: Client, asset: Address): string => {
  const account = client.svm.getAccount(asset);
  if (!account.exists) throw new Error(`Core asset ${asset} not found`);
  return getAddressDecoder().decode(account.data.slice(1, 33));
};

test('it can sell an nft item', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const oracleSigner = await generateKeyPairSigner();

  const { gumballMachine } = await createGumballMachine(client, {
    guards: {},
    buyBackConfig: buyBack(oracleSigner, { cutoffPct: 0 }),
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const preDrawer = getBalance(client, drawer.address);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  // The drawer (current holder) receives the buy price.
  near(t, getBalance(client, drawer.address), preDrawer + sol(1), sol(0.001));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  expectItem(t, account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });

  // The NFT is now owned by the authority (the sell-back buyer).
  const token = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(token.state, AccountState.Initialized);
  t.is(token.owner, client.payer.address);
  t.true(isNone(token.delegate));
  t.is(token.amount, 1n);
});

test('it can sell a pnft item', async (t) => {
  const client = await createClient();
  const { mint } = await createProgrammableNft(client);
  const oracleSigner = await generateKeyPairSigner();

  const { gumballMachine } = await createGumballMachine(client, {
    guards: {},
    buyBackConfig: buyBack(oracleSigner),
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      authRulesProgram: AUTH_RULES_PROGRAM,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.ProgrammableNonFungible,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  expectItem(t, account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    amount: 1,
  });

  // The pNFT is owned by the authority and stays frozen after sell-back.
  const token = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(token.state, AccountState.Frozen);
  t.is(token.owner, client.payer.address);
  t.true(isNone(token.delegate));
  t.is(token.amount, 1n);

  // The asset can be re-added to a new gumball machine.
  const { gumballMachine: machine2 } = await createGumballMachine(client, {
    guards: {},
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine: machine2,
      seller: client.payer,
      mint,
      authRulesProgram: AUTH_RULES_PROGRAM,
    }),
    getStartSaleInstruction({
      gumballMachine: machine2,
      authority: client.payer,
    }),
  ]);
  t.pass();
});

test('it can sell a tokens item', async (t) => {
  const client = await createClient();
  const oracleSigner = await generateKeyPairSigner();
  const gmSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: gmSigner.address,
  });

  const { mint } = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 100 },
      { owner: authorityPda, amount: 0 },
    ],
  });

  const { gumballMachine } = await createGumballMachine(client, {
    gumballMachine: gmSigner,
    guards: {},
    buyBackConfig: buyBack(oracleSigner),
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 100,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.Fungible,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  expectItem(t, account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.Fungible,
    amount: 100,
  });

  // The tokens are owned by the authority (the sell-back buyer).
  const token = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(token.state, AccountState.Initialized);
  t.is(token.owner, client.payer.address);
  t.true(isNone(token.delegate));
  t.is(token.amount, 100n);

  // The tokens can be re-added to a new gumball machine.
  const gm2 = await generateKeyPairSigner();
  const [authorityPda2] = await findGumballMachineAuthorityPda({
    gumballMachine: gm2.address,
  });
  // The authority-pda ATA must exist before add (mirrors umi setup).
  await createMintWithHolders(client, {
    holders: [{ owner: authorityPda2, amount: 0 }],
    mint: await generateKeyPairSigner(),
  });
  const { gumballMachine: machine2 } = await createGumballMachine(client, {
    gumballMachine: gm2,
    guards: {},
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine: machine2,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
    getStartSaleInstruction({
      gumballMachine: machine2,
      authority: client.payer,
    }),
  ]);
  t.pass();
});

test('it can sell a core asset item', async (t) => {
  const client = await createClient();
  const { asset } = await createCoreAsset(client);
  const oracleSigner = await generateKeyPairSigner();

  const { gumballMachine } = await createGumballMachine(client, {
    guards: {},
    buyBackConfig: buyBack(oracleSigner),
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
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(1),
      mint: asset,
      tokenStandard: TokenStandard.Core,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  expectItem(t, account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint: asset,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.Core,
    amount: 1,
  });

  // The core asset is now owned by the authority (the sell-back buyer).
  t.is(coreAssetOwner(client, asset), client.payer.address);

  // The asset can be re-added to a new gumball machine.
  const { gumballMachine: machine2 } = await createGumballMachine(client, {
    guards: {},
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddCoreAssetInstructionAsync({
      gumballMachine: machine2,
      seller: client.payer,
      asset,
    }),
    getStartSaleInstruction({
      gumballMachine: machine2,
      authority: client.payer,
    }),
  ]);
  t.pass();
});

test('it can sell an item when cutoff pct has not been reached', async (t) => {
  const client = await createClient();
  const oracleSigner = await generateKeyPairSigner();
  const gmSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: gmSigner.address,
  });

  const { mint } = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 100 },
      { owner: authorityPda, amount: 0 },
    ],
  });

  const { gumballMachine } = await createGumballMachine(client, {
    gumballMachine: gmSigner,
    guards: {},
    buyBackConfig: buyBack(oracleSigner, { cutoffPct: 50 }),
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 30,
      quantity: 3,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const drawnIndex = fetchGumballMachine(
    client.svm,
    gumballMachine
  ).items.findIndex((item) => item.isDrawn);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: drawnIndex,
      amount: 30,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.Fungible,
    }),
  ]);

  t.pass();
});

test('it can sell using spl token buy back funds', async (t) => {
  const client = await createClient();
  const { mint: nftMint } = await createNft(client);
  const oracleSigner = await generateKeyPairSigner();
  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));

  const { mint: tokenMint } = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 100 },
      { owner: drawer.address, amount: 50 },
    ],
  });

  const sellerBalance = getBalance(client, client.payer.address);

  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    settings: { paymentMint: tokenMint },
    guards: { tokenPayment: { mint: tokenMint, amount: 50 } },
    buyBackConfig: buyBack(oracleSigner, { cutoffPct: 0 }),
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: nftMint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, 100, false, tokenMint);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: drawer,
      buyer: drawer,
      mintArgs: { tokenPayment: { mint: tokenMint } },
    }),
  ]);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: 40,
      mint: nftMint,
      paymentMint: tokenMint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  // The drawer paid 50 for the draw then received 40 for the sell-back.
  t.is(
    fetchTokenAccount(client, await ataFor(tokenMint, drawer.address)).amount,
    40n
  );

  await manageFunds(client, gumballMachine, 60, true, tokenMint);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      payer: client.payer,
      gumballMachine,
      index: 0,
      authority: client.payer.address,
      buyer: drawer.address,
      seller: client.payer.address,
      mint: nftMint,
      paymentMint: tokenMint,
      creators: [client.payer.address],
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  await sendTransaction(client.svm, client.payer, [
    await getCloseGumballMachineInstructionAsync({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
      paymentMint: tokenMint,
      authorityPdaPaymentAccount: await ataFor(tokenMint, authorityPda),
    }),
  ]);

  // 60 from buy-back funds withdrawn + 50 from the settled sale.
  t.is(
    fetchTokenAccount(client, await ataFor(tokenMint, client.payer.address))
      .amount,
    110n
  );

  // All rent is returned; only tx fees separate the two balances.
  near(t, getBalance(client, client.payer.address), sellerBalance, sol(0.001));
});

test('it can settle and close a gumball after selling a token item back', async (t) => {
  const client = await createClient();
  const oracleSigner = await generateKeyPairSigner();
  const gmSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: gmSigner.address,
  });

  const { mint } = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 100 },
      { owner: authorityPda, amount: 0 },
    ],
  });

  const sellerBalance = getBalance(client, client.payer.address);

  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    gumballMachine: gmSigner,
    guards: {},
    buyBackConfig: buyBack(oracleSigner),
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 100,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.Fungible,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getCloseGumballMachineInstructionAsync({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
    }),
  ]);

  // 100 tokens bought back land with the seller.
  t.is(
    fetchTokenAccount(client, await ataFor(mint, client.payer.address)).amount,
    100n
  );

  // Seller is down the 1 SOL of buy-back funds paid out to the drawer.
  near(
    t,
    sellerBalance,
    getBalance(client, client.payer.address) + sol(1),
    sol(0.002)
  );
});

test('it can sell an item with a marketplace fee', async (t) => {
  const client = await createClient();
  const feeAccount = (await generateKeyPairSigner()).address;
  const { mint } = await createNft(client);
  const oracleSigner = await generateKeyPairSigner();

  const { gumballMachine } = await createGumballMachine(client, {
    guards: {},
    feeConfig: { feeAccount, feeBps: 0 },
    buyBackConfig: buyBack(oracleSigner, {
      cutoffPct: 0,
      marketplaceFeeBps: 1000,
    }),
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  // Deposit 1.1 SOL: 1 SOL to the drawer + 0.1 SOL marketplace fee.
  await manageFunds(client, gumballMachine, sol(1.1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const preDrawer = getBalance(client, drawer.address);
  const preFee = getBalance(client, feeAccount);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(1),
      mint,
      feeAccount,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  near(t, getBalance(client, drawer.address), preDrawer + sol(1), sol(0.001));
  t.is(getBalance(client, feeAccount), preFee + sol(0.1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  expectItem(t, account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });
  // All buy-back funds are spent (1 SOL + 10% marketplace fee).
  t.is(account.buyBackFundsAvailable, 0n);
});

test('it can sell an item with a marketplace fee using a payment mint', async (t) => {
  const client = await createClient();
  const feeAccount = (await generateKeyPairSigner()).address;
  const { mint: nftMint } = await createNft(client);
  const oracleSigner = await generateKeyPairSigner();
  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));

  const { mint: paymentMint, atas } = await createMintWithHolders(client, {
    holders: [
      { owner: drawer.address, amount: 100 },
      { owner: feeAccount, amount: 0 },
      { owner: client.payer.address, amount: 110 },
    ],
  });
  const [buyerTokenAccount, feeTokenAccount] = atas;

  const { gumballMachine } = await createGumballMachine(client, {
    guards: { tokenPayment: { mint: paymentMint, amount: 100 } },
    feeConfig: { feeAccount, feeBps: 0 },
    buyBackConfig: buyBack(oracleSigner, {
      cutoffPct: 0,
      marketplaceFeeBps: 1000,
    }),
    settings: { paymentMint },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: nftMint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, 110, false, paymentMint);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: drawer,
      buyer: drawer,
      mintArgs: {
        tokenPayment: { mint: paymentMint, feeAccounts: [feeAccount] },
      },
    }),
  ]);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: 100,
      mint: nftMint,
      feeAccount,
      paymentMint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  t.is(fetchTokenAccount(client, buyerTokenAccount).amount, 100n);
  t.is(fetchTokenAccount(client, feeTokenAccount).amount, 10n);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  expectItem(t, account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint: nftMint,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });
  t.is(account.buyBackFundsAvailable, 0n);
});

test('it cannot sell an item with invalid oracle signer', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);

  // The configured oracle is the authority itself.
  const { gumballMachine } = await createGumballMachine(client, {
    guards: {},
    buyBackConfig: {
      ...getDefaultBuyBackConfig(),
      enabled: true,
      oracleSigner: client.payer.address,
    },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const invalidOracleSigner = await generateKeyPairSigner();
  const promise = sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner: invalidOracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  await t.throwsAsync(promise, { message: /InvalidOracleSigner/ });
});

test('it cannot sell an item with insufficient buy back funds', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const oracleSigner = await generateKeyPairSigner();

  const { gumballMachine } = await createGumballMachine(client, {
    guards: {},
    buyBackConfig: buyBack(oracleSigner),
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  // Deposit one lamport less than the buy price.
  await manageFunds(client, gumballMachine, sol(1) - 1n, false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const promise = sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  await t.throwsAsync(promise, { message: /InsufficientFunds/ });
});

test('it cannot sell to a gumball without buyback enabled', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const oracleSigner = await generateKeyPairSigner();

  const { gumballMachine } = await createGumballMachine(client, { guards: {} });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const promise = sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  await t.throwsAsync(promise, { message: /BuyBackNotEnabled/ });
});

test('it cannot sell to a gumball with cutoff pct reached', async (t) => {
  const client = await createClient();
  const oracleSigner = await generateKeyPairSigner();
  const gmSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: gmSigner.address,
  });

  const { mint } = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 100 },
      { owner: authorityPda, amount: 0 },
    ],
  });

  const { gumballMachine } = await createGumballMachine(client, {
    gumballMachine: gmSigner,
    guards: {},
    buyBackConfig: buyBack(oracleSigner, { cutoffPct: 50 }),
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 50,
      quantity: 2,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  // Draw both items so 100% >= the 50% cutoff.
  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const promise = sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 100,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.Fungible,
    }),
  ]);

  await t.throwsAsync(promise, { message: /BuyBackCutoffReached/ });
});

test('it cannot sell a tokens item with a different amount', async (t) => {
  const client = await createClient();
  const oracleSigner = await generateKeyPairSigner();
  const gmSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: gmSigner.address,
  });

  const { mint } = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 100 },
      { owner: authorityPda, amount: 0 },
    ],
  });

  const { gumballMachine } = await createGumballMachine(client, {
    gumballMachine: gmSigner,
    guards: {},
    buyBackConfig: buyBack(oracleSigner),
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: drawer, buyer: drawer, mintArgs: {} }),
  ]);

  const promise = sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1000,
      buyPrice: sol(1),
      mint,
      tokenStandard: TokenStandard.Fungible,
    }),
  ]);

  await t.throwsAsync(promise, { message: /InvalidAmount/ });
});

test('it can sell an nft item, re-add it, and sell it again', async (t) => {
  const client = await createClient();
  const nfts = [await createNft(client), await createNft(client)];
  const oracleSigner = await generateKeyPairSigner();

  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
    buyBackConfig: buyBack(oracleSigner, { cutoffPct: 0 }),
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: nfts[0].mint,
    }),
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: nfts[1].mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await manageFunds(client, gumballMachine, sol(1), false);

  const drawer = await generateKeyPairSignerWithSol(client.svm, sol(100));
  const preBuyer = getBalance(client, drawer.address);
  const preSeller = getBalance(client, client.payer.address);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: drawer,
      buyer: drawer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const drawnIndex = fetchGumballMachine(
    client.svm,
    gumballMachine
  ).items.findIndex((item) => item.isDrawn);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: drawnIndex,
      amount: 1,
      buyPrice: sol(0.5),
      mint: nfts[drawnIndex].mint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      payer: client.payer,
      index: drawnIndex,
      gumballMachine,
      authority: client.payer.address,
      buyer: drawer.address,
      seller: client.payer.address,
      mint: nfts[drawnIndex].mint,
      creators: [client.payer.address],
    }),
  ]);

  // Re-add the settled NFT back into its slot.
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: nfts[drawnIndex].mint,
      args: { index: some(drawnIndex) },
    }),
  ]);

  // Draw all items.
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: drawer,
      buyer: drawer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);
  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: drawer,
      buyer: drawer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  await sendTransaction(client.svm, drawer, [
    COMPUTE_UNITS,
    await getSellItemInstructionAsync({
      gumballMachine,
      payer: drawer,
      oracleSigner,
      seller: drawer.address,
      buyer: client.payer.address,
      index: 0,
      amount: 1,
      buyPrice: sol(0.5),
      mint: nfts[0].mint,
      tokenStandard: TokenStandard.NonFungible,
    }),
  ]);

  // 3 draws @ 1 SOL, 2 sell-backs @ 0.5 SOL => 2 SOL spent by the drawer.
  near(t, getBalance(client, drawer.address), preBuyer - sol(2), sol(0.001));

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      payer: client.payer,
      index: 0,
      gumballMachine,
      authority: client.payer.address,
      buyer: drawer.address,
      seller: client.payer.address,
      mint: nfts[0].mint,
      creators: [client.payer.address],
    }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      payer: client.payer,
      index: 1,
      gumballMachine,
      authority: client.payer.address,
      buyer: drawer.address,
      seller: client.payer.address,
      mint: nfts[1].mint,
      creators: [client.payer.address],
    }),
  ]);

  // 3 draws @ 1 SOL all settle to the seller.
  near(
    t,
    getBalance(client, client.payer.address),
    preSeller + sol(3),
    sol(0.001)
  );

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 2);
  t.is(account.itemsRedeemed, 2n);
  t.is(account.itemsSettled, 2n);
  t.is(account.totalProceedsSettled, sol(3));
  t.is(account.buyBackFundsAvailable, 0n);
  expectItem(t, account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: true,
    mint: nfts[0].mint,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });
  expectItem(t, account.items[1], {
    index: 1,
    isDrawn: true,
    isClaimed: true,
    isSettled: true,
    mint: nfts[1].mint,
    seller: client.payer.address,
    buyer: drawer.address,
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getCloseGumballMachineInstructionAsync({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
    }),
  ]);
  t.pass();
});
