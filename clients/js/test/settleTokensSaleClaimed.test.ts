import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { generateKeyPairSigner, some, type Address } from '@solana/kit';
import test, { type ExecutionContext } from 'ava';
import {
  draw,
  findGumballGuardPda,
  findGumballMachineAuthorityPda,
  getAddNftInstructionAsync,
  getAddTokensInstructionAsync,
  getClaimNftInstructionAsync,
  getClaimTokensInstructionAsync,
  getCloseGumballMachineInstructionAsync,
  getEndSaleInstruction,
  getMerkleProof,
  getMerkleRoot,
  getSettleTokensSaleClaimedInstructionAsync,
  getStartSaleInstruction,
} from '../src';
import { createNft } from './_nftKit';
import {
  createMintWithHolders,
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

test('it cannot settle an unclaimed token sale', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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

  // Then settling without a claim first fails.
  const promise = sendTransaction(client.svm, client.payer, [
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
  await t.throwsAsync(promise, { message: /InvalidBuyer/ });
});

test('it can settle a token sale after claim', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 0,
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

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

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 1n);
  const item = account.items[0];
  t.is(item.isSettled, true);
  t.is(item.buyer, buyer.address);
  t.is(item.amount, 100);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
});

test('it can settle a claimed tokens sale as a third party', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 0,
    }),
  ]);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const sellerPre = getBalance(client, client.payer.address);
  const authorityPdaPre = getBalance(client, authorityPda);

  // Settle as an unrelated third party.
  const other = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, other, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 0,
      gumballMachine,
      payer: other,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(1));
  near(t, getBalance(client, authorityPda), authorityPdaPre - sol(1));

  const buyerToken = fetchTokenAccount(
    client,
    await ataFor(mint, buyer.address)
  );
  t.is(buyerToken.amount, 100n);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );
});

test('it can settle a tokens item that was not sold', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 1000 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1000 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity: 1000,
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
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 999,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  near(t, getBalance(client, client.payer.address), sellerPre);
  t.is(getBalance(client, authorityPda), authorityPdaPre);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 0n);
  t.is(account.itemsSettled, 1000n);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const sellerToken = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(sellerToken.amount, 1000n);

  // Should now be able to close the machine.
  const [gumballGuard] = await findGumballGuardPda({ base: gumballMachine });
  await sendTransaction(client.svm, client.payer, [
    await getCloseGumballMachineInstructionAsync({
      machine: gumballMachine,
      gumballGuard,
      authority: client.payer,
    }),
  ]);
});

test('it can settle a tokens item that was not sold with proceeds from another sale with fee config', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const feeAccount = (await generateKeyPairSigner()).address;
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 0 },
    feeConfig: { feeAccount, feeBps: 500 },
    guards: { solPayment: some({ lamports: sol(1) }) },
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

  let account = fetchGumballMachine(client.svm, gumballMachine);
  const soldIndex = account.items.findIndex((i) => i.buyer != null);
  await sendTransaction(client.svm, buyer, [
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: soldIndex,
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

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 1,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, authorityPdaPre - getBalance(client, authorityPda), sol(0.95));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.95));
  near(t, getBalance(client, feeAccount), sol(0.05));

  account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 2n);

  t.false(
    await sellerHistoryExists(client, {
      gumballMachine,
      seller: client.payer.address,
    })
  );

  const sellerToken = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(sellerToken.amount, 50n);
});

test('it can settle a claimed tokens item with a marketplace config', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const feeAccount = (await generateKeyPairSigner()).address;
  const { gumballMachine } = await createGumballMachine(client, {
    feeConfig: { feeAccount, feeBps: 500 },
    guards: { solPayment: some({ lamports: sol(1) }) },
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
  await sendTransaction(client.svm, buyer, [
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 0,
    }),
  ]);

  const sellerPre = getBalance(client, client.payer.address);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 0,
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  near(t, getBalance(client, payer.address), sol(9), sol(0.1));
  near(t, getBalance(client, feeAccount), sol(0.05));
  near(t, getBalance(client, client.payer.address), sellerPre + sol(0.95));

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsSettled, 1n);

  const buyerToken = fetchTokenAccount(
    client,
    await ataFor(mint, buyer.address)
  );
  t.is(buyerToken.amount, 100n);
});

test('it cannot settle an nft sale', async (t) => {
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

  const promise = sendTransaction(client.svm, client.payer, [
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
  await t.throwsAsync(promise, { message: /InvalidTokenStandard/ });
});

test('it cannot settle an already settled tokens item', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 100 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity: 100,
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
  await sendTransaction(client.svm, client.payer, [
    getEndSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  const indexDrawn = account.items.findIndex((i) => i.buyer != null);

  await sendTransaction(client.svm, buyer, [
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: indexDrawn,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: indexDrawn,
      endIndex: indexDrawn,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  const promise = sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: indexDrawn,
      endIndex: indexDrawn,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);
  await t.throwsAsync(promise, { message: /ItemAlreadySettled/ });
});

test('it can reclaim varying token amounts', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 75,
      quantity: 1,
    }),
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 25,
      quantity: 1,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    getEndSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 1,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  const sellerToken = fetchTokenAccount(
    client,
    await ataFor(mint, client.payer.address)
  );
  t.is(sellerToken.amount, 100n);
});

test('it cannot settle when startIndex > endIndex', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 50,
      quantity: 1,
    }),
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 50,
      quantity: 1,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    getEndSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const promise = sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 1,
      endIndex: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);
  await t.throwsAsync(promise, { message: /InvalidInputLength/ });
});

test('it can settle with curator fees', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: otherSeller.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { curatorFeeBps: 1000, sellersMerkleRoot },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  await sendTransaction(client.svm, otherSeller, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      mint,
      amount: 100,
      quantity: 1,
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
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: otherSeller.address,
      buyer: buyer.address,
      mint,
      index: 0,
    }),
  ]);

  const sellerPre = getBalance(client, otherSeller.address);
  const authorityPre = getBalance(client, client.payer.address);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 0,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: otherSeller.address,
      mint,
    }),
  ]);

  // Seller gets 90%, curator (authority) gets 10%.
  near(t, getBalance(client, otherSeller.address), sellerPre + sol(0.9));
  near(t, getBalance(client, client.payer.address), authorityPre + sol(0.1));
});

test('it cannot settle index out of bounds', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 100 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
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
  await sendTransaction(client.svm, client.payer, [
    getEndSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const promise = sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 10,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);
  await t.throwsAsync(promise, { message: /IndexGreaterThanLength/ });
});

test('it can settle multiple items drawn and claimed', async (t) => {
  const client = await createClient();
  const { mint } = await createMintWithHolders(client, {
    holders: [{ owner: client.payer.address, amount: 200 }],
  });
  const { gumballMachine } = await createGumballMachine(client, {
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 50,
      quantity: 1,
    }),
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 50,
      quantity: 1,
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
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 0,
    }),
  ]);
  await sendTransaction(client.svm, buyer, [
    await getClaimTokensInstructionAsync({
      gumballMachine,
      payer: buyer,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 1,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleClaimedInstructionAsync({
      startIndex: 0,
      endIndex: 1,
      gumballMachine,
      payer: client.payer,
      authority: client.payer.address,
      seller: client.payer.address,
      mint,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 2n);
  t.is(account.itemsSettled, 2n);
  t.true(account.items[0].isSettled);
  t.true(account.items[1].isSettled);

  const buyerToken = fetchTokenAccount(
    client,
    await ataFor(mint, buyer.address)
  );
  t.is(buyerToken.amount, 100n);
});

// --- local ATA helpers ---
async function ataFor(mint: Address, owner: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata;
}
