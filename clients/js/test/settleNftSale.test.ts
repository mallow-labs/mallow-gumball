import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { generateKeyPairSigner, some, type Address } from '@solana/kit';
import test, { type ExecutionContext } from 'ava';
import {
  draw,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getAddNftInstructionAsync,
  getClaimNftInstructionAsync,
  getEndSaleInstruction,
  getSettleNftSaleInstructionAsync,
  getStartSaleInstruction,
} from '../src';
import { createNft, createProgrammableNft } from './_nftKit';
import {
  fetchTokenAccount,
  getBalance,
  sellerHistoryExists,
} from './_settleSetup';
import {
  COMPUTE_UNITS,
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from './_setup';

/** mpl-token-auth-rules program id — required for ProgrammableNonFungible flows. */
const AUTH_RULES = 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address;
/** Sentinel buyer used when settling an item that was never sold. */
const UNSOLD_BUYER = '11111111111111111111111111111111' as Address;
/** SPL token account states. */
const INITIALIZED = 1;
const FROZEN = 2;

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

test('it can settle an nft sale', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
    disablePrimarySplit: true,
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

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      buyer: buyer.address,
      seller: client.payer.address,
      mint,
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
  t.is(item.isClaimed, true);
  t.is(item.buyer, buyer.address);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const tok = fetchTokenAccount(client, await ataFor(mint, buyer.address));
  t.is(tok.amount, 1n);
  t.is(tok.owner, buyer.address);
  t.is(tok.state, INITIALIZED);
});

test('it can settle a pnft sale', async (t) => {
  const client = await createClient();
  const { mint } = await createProgrammableNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      authRulesProgram: AUTH_RULES,
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

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      buyer: buyer.address,
      seller: client.payer.address,
      mint,
      creators: [client.payer.address],
      authRulesProgram: AUTH_RULES,
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  t.is(account.items[0].isSettled, true);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  // pNFT token account remains Frozen after settle.
  const tok = fetchTokenAccount(client, await ataFor(mint, buyer.address));
  t.is(tok.amount, 1n);
  t.is(tok.owner, buyer.address);
  t.is(tok.state, FROZEN);
});

test('it splits proceeds for a primary nft sale with multiple creators after claim', async (t) => {
  const client = await createClient();
  const secondCreator = (await generateKeyPairSigner()).address;
  const { mint } = await createNft(client, {
    creators: [
      { address: client.payer.address, verified: false, share: 50 },
      { address: secondCreator, verified: false, share: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    await getClaimNftInstructionAsync({
      gumballMachine,
      payer: buyer,
      buyer: buyer.address,
      mint,
      seller: client.payer.address,
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
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [client.payer.address, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.5));
  near(t, getBalance(client, secondCreator), secondCreatorPre + sol(0.5));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it only splits royalty portion of proceeds for a primary nft sale with disablePrimarySplit set', async (t) => {
  const client = await createClient();
  const secondCreator = (await generateKeyPairSigner()).address;
  const { mint } = await createNft(client, {
    creators: [
      { address: client.payer.address, verified: false, share: 50 },
      { address: secondCreator, verified: false, share: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(1) }) },
    disablePrimarySplit: true,
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
    await getClaimNftInstructionAsync({
      gumballMachine,
      payer: buyer,
      buyer: buyer.address,
      mint,
      seller: client.payer.address,
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
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [client.payer.address, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  // Non-royalty (0.9) to the seller directly; royalty (0.1) split 50/50.
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.95));
  near(t, getBalance(client, secondCreator), secondCreatorPre + sol(0.05));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it splits proceeds for a primary nft sale with multiple creators before claim', async (t) => {
  const client = await createClient();
  const secondCreator = (await generateKeyPairSigner()).address;
  const { mint } = await createNft(client, {
    creators: [
      { address: client.payer.address, verified: false, share: 50 },
      { address: secondCreator, verified: false, share: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [client.payer.address, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.5));
  near(t, getBalance(client, secondCreator), secondCreatorPre + sol(0.5));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it splits proceeds for a secondary nft sale with multiple creators after claim', async (t) => {
  const client = await createClient();
  const firstCreator = (await generateKeyPairSigner()).address;
  const secondCreator = (await generateKeyPairSigner()).address;
  // Secondary sale: primary already happened, seller (payer) owns the nft.
  const { mint } = await createNft(client, {
    owner: client.payer.address,
    primarySaleHappened: true,
    creators: [
      { address: firstCreator, verified: false, share: 50 },
      { address: secondCreator, verified: false, share: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    await getClaimNftInstructionAsync({
      gumballMachine,
      payer: buyer,
      buyer: buyer.address,
      mint,
      seller: client.payer.address,
      index: 0,
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const [sellerHistory] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const firstCreatorPre = getBalance(client, firstCreator);
  const secondCreatorPre = getBalance(client, secondCreator);
  const authorityPdaPre = getBalance(client, authorityPda);
  const sellerHistoryRent = getBalance(client, sellerHistory);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [firstCreator, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  // Secondary sale: seller keeps 0.9 + reclaimed seller-history rent; 0.1 royalty split.
  near(
    t,
    getBalance(client, client.payer.address),
    sellerPre + sol(0.9) + sellerHistoryRent,
    sol(0.001)
  );
  near(
    t,
    getBalance(client, firstCreator),
    firstCreatorPre + sol(0.05),
    sol(0.001)
  );
  near(
    t,
    getBalance(client, secondCreator),
    secondCreatorPre + sol(0.05),
    sol(0.001)
  );
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it splits proceeds for a secondary nft sale with multiple creators before claim', async (t) => {
  const client = await createClient();
  const firstCreator = (await generateKeyPairSigner()).address;
  const secondCreator = (await generateKeyPairSigner()).address;
  const { mint } = await createNft(client, {
    owner: client.payer.address,
    primarySaleHappened: true,
    creators: [
      { address: firstCreator, verified: false, share: 50 },
      { address: secondCreator, verified: false, share: 50 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    seller: client.payer.address,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const firstCreatorPre = getBalance(client, firstCreator);
  const secondCreatorPre = getBalance(client, secondCreator);
  const authorityPdaPre = getBalance(client, authorityPda);
  const sellerHistoryRent = getBalance(client, sellerHistory);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [firstCreator, secondCreator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(
    t,
    getBalance(client, client.payer.address),
    sellerPre + sol(0.9) + sellerHistoryRent,
    sol(0.001)
  );
  near(
    t,
    getBalance(client, firstCreator),
    firstCreatorPre + sol(0.05),
    sol(0.001)
  );
  near(
    t,
    getBalance(client, secondCreator),
    secondCreatorPre + sol(0.05),
    sol(0.001)
  );
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
});

test('it can settle an nft sale as a third party', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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

  const other = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, other, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: other,
      authority: client.payer.address,
      buyer: buyer.address,
      seller: client.payer.address,
      mint,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  t.is(account.items[0].isSettled, true);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const tok = fetchTokenAccount(client, await ataFor(mint, buyer.address));
  t.is(tok.amount, 1n);
  t.is(tok.owner, buyer.address);
  t.is(tok.state, INITIALIZED);
});

test('it can settle a pnft sale as a third party', async (t) => {
  const client = await createClient();
  const { mint } = await createProgrammableNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      authRulesProgram: AUTH_RULES,
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

  const other = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, other, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: other,
      authority: client.payer.address,
      buyer: buyer.address,
      seller: client.payer.address,
      mint,
      creators: [client.payer.address],
      authRulesProgram: AUTH_RULES,
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsSettled, 1n);
  t.is(account.items[0].isSettled, true);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const tok = fetchTokenAccount(client, await ataFor(mint, buyer.address));
  t.is(tok.amount, 1n);
  t.is(tok.owner, buyer.address);
  t.is(tok.state, FROZEN);
});

test('it can settle an nft that was not sold', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: UNSOLD_BUYER,
      mint,
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

  // Unsold nft returns to the seller, unfrozen.
  const tok = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(tok.amount, 1n);
  t.is(tok.owner, client.payer.address);
  t.is(tok.state, INITIALIZED);
});

test('it can settle a pnft that was not sold', async (t) => {
  const client = await createClient();
  const { mint } = await createProgrammableNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      authRulesProgram: AUTH_RULES,
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
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: UNSOLD_BUYER,
      mint,
      creators: [client.payer.address],
      authRulesProgram: AUTH_RULES,
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

  const tok = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(tok.amount, 1n);
  t.is(tok.owner, client.payer.address);
  t.is(tok.state, FROZEN);
});

test('it can settle an nft that was not sold with proceeds from another sale', async (t) => {
  const client = await createClient();
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
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

  const unsold = fetchGumballMachine(client.svm, gumballMachine).items.find(
    (i) => i.buyer == null
  )!;

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: unsold.index,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: unsold.seller as Address,
      buyer: UNSOLD_BUYER,
      mint: unsold.mint as Address,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.5));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(0.5));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);

  // Seller history not yet closed (one item still unsettled).
  t.true(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const tok = fetchTokenAccount(
    client,
    await ataFor(unsold.mint as Address, client.payer.address)
  );
  t.is(tok.amount, 1n);
  t.is(tok.owner, client.payer.address);
  t.is(tok.state, INITIALIZED);
});

test('it can settle an nft that was not sold with proceeds from another sale with fee config', async (t) => {
  const client = await createClient();
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);
  const feeAccount = (await generateKeyPairSigner()).address;
  const { gumballMachine } = await createGumballMachine(client, {
    feeConfig: { feeAccount, feeBps: 500 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
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
      mintArgs: { solPayment: some({ feeAccounts: [feeAccount] }) },
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

  const unsold = fetchGumballMachine(client.svm, gumballMachine).items.find(
    (i) => i.buyer == null
  )!;

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: unsold.index,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: unsold.seller as Address,
      buyer: UNSOLD_BUYER,
      mint: unsold.mint as Address,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.475));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(0.475));
  near(t, getBalance(client, feeAccount), sol(0.05));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);

  t.true(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const tok = fetchTokenAccount(
    client,
    await ataFor(unsold.mint as Address, client.payer.address)
  );
  t.is(tok.amount, 1n);
  t.is(tok.state, INITIALIZED);
});

test('it cannot settle an nft to the wrong buyer', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const promise = sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: client.payer.address, // wrong buyer
      mint,
      creators: [client.payer.address],
    }),
  ]);
  await t.throwsAsync(promise, { message: /InvalidBuyer/ });
});

test('it can settle an nft sale where buyer is the seller', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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

  // Buyer, seller and authority are all the payer.
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
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: client.payer.address,
      mint,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const tok = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(tok.amount, 1n);
  t.is(tok.owner, client.payer.address);
  t.is(tok.state, INITIALIZED);
});

test('it can settle an nft sale for claimed nft', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    await getClaimNftInstructionAsync({
      gumballMachine,
      payer: buyer,
      buyer: buyer.address,
      mint,
      seller: client.payer.address,
      index: 0,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [client.payer.address],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  t.is(account.items[0].isSettled, true);
  t.is(account.items[0].buyer, buyer.address);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const tok = fetchTokenAccount(client, await ataFor(mint, buyer.address));
  t.is(tok.amount, 1n);
  t.is(tok.owner, buyer.address);
  t.is(tok.state, INITIALIZED);
});

test('it can settle an nft sale with a marketplace config', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const feeAccount = (await generateKeyPairSigner()).address;
  const { gumballMachine } = await createGumballMachine(client, {
    feeConfig: { feeAccount, feeBps: 500 },
    guards: { solPayment: some({ lamports: sol(1) }) },
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

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const payer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer,
      buyer,
      mintArgs: { solPayment: some({ feeAccounts: [feeAccount] }) },
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [client.payer.address],
      feeAccount,
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, feeAccount), sol(0.05));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.95));
  near(t, getBalance(client, authorityPda), sol(0));
});

test('it omits sending proceeds for a creator if the amount is too small to keep the account alive', async (t) => {
  const client = await createClient();
  const secondCreator = (await generateKeyPairSigner()).address;
  const { mint } = await createNft(client, {
    creators: [
      { address: client.payer.address, verified: false, share: 99 },
      { address: secondCreator, verified: false, share: 1 },
    ],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    guards: { solPayment: some({ lamports: sol(0.001) }) },
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
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [client.payer.address, secondCreator],
    }),
  ]);

  // The second creator's 1% share is too small to rent-exempt a fresh account.
  t.is(getBalance(client, secondCreator), 0n);
});

test('it can settle an nft sale with disableRoyalties', async (t) => {
  const client = await createClient();
  const creator = (await generateKeyPairSigner()).address;
  // Secondary sale (primary already happened) so royalties would normally apply.
  const { mint } = await createNft(client, {
    owner: client.payer.address,
    primarySaleHappened: true,
    creators: [{ address: creator, verified: false, share: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
    disablePrimarySplit: true,
    disableRoyalties: true,
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
  const creatorPre = getBalance(client, creator);
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      buyer: buyer.address,
      seller: client.payer.address,
      mint,
      creators: [creator],
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  // Royalties disabled: seller keeps the whole sol(1); creator gets nothing.
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));
  t.is(getBalance(client, creator), creatorPre);
});

// The umi test relies on mpl-token-metadata `burnNft` to burn the claimed nft
// before settling. There is no @solana/kit helper for burning an nft in this
// repo, and the settle behaviour it exercises for a claimed item is already
// covered by 'it can settle an nft sale for claimed nft'. Skipped per task
// guidance (burn helper cannot be reproduced).
test.skip('it can settle an nft sale after nft has been claimed and burnt', () => {});

test('it cannot settle an nft with the wrong metadata account', async (t) => {
  const client = await createClient();
  const { mint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const wrongMetadata = (await generateKeyPairSigner()).address;
  const promise = sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      creators: [client.payer.address],
      metadata: wrongMetadata,
    }),
  ]);
  await t.throwsAsync(promise, { message: /Invalid metadata PDA/ });
});
