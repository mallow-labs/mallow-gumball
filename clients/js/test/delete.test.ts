import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { generateKeyPairSigner, some, type Address } from '@solana/kit';
import test from 'ava';
import { LiteSVM } from 'litesvm';
import {
  draw,
  findGumballMachineAuthorityPda,
  getAddNftInstructionAsync,
  getAddTokensInstructionAsync,
  getCloseGumballMachineInstructionAsync,
  getDefaultBuyBackConfig,
  getDeleteGumballMachineInstructionAsync,
  getManageBuyBackFundsInstructionAsync,
  getSettleNftSaleInstructionAsync,
  getSettleTokensSaleInstructionAsync,
  getStartSaleInstruction,
} from '../src';
import { createMachineNoGuard } from './_lifecycleSetup';
import { createNft } from './_nftKit';
import {
  COMPUTE_UNITS,
  createClient,
  createFungibleMint,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from './_setup';
import {
  createMintWithHolders,
  fetchTokenAmount,
} from './defaultGuards/_guardsBSetup';

const accountGone = (svm: LiteSVM, addr: Address): boolean => {
  const account = svm.getAccount(addr);
  return account == null || account.exists === false;
};

test('it can delete an empty gumball machine', async (t) => {
  const client = await createClient();

  // Given an existing gumball machine (no guard).
  const { gumballMachine } = await createMachineNoGuard(client);

  // When we delete it.
  await sendTransaction(client.svm, client.payer, [
    await getDeleteGumballMachineInstructionAsync({
      gumballMachine,
      authority: client.payer,
      mintAuthority: client.payer,
    }),
  ]);

  // Then the gumball machine account no longer exists.
  t.true(accountGone(client.svm, gumballMachine));
});

test('it can delete an empty gumball machine with guard', async (t) => {
  const client = await createClient();

  // Given an existing gumball machine wrapped with a guard.
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    guards: {},
  });

  // When we close it.
  await sendTransaction(client.svm, client.payer, [
    await getCloseGumballMachineInstructionAsync({
      gumballGuard,
      authority: client.payer,
      machine: gumballMachine,
    }),
  ]);

  // Then the gumball machine and guard accounts no longer exist.
  t.true(accountGone(client.svm, gumballMachine));
  t.true(accountGone(client.svm, gumballGuard));
});

test('it can delete a settled gumball machine with native token', async (t) => {
  const client = await createClient();

  // Given a gumball machine with a solPayment guard and a single loaded item.
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  const { mint } = await createFungibleMint(client, { amount: 100 });
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

  // And a buyer draws the item.
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

  // And the sale is settled.
  const [receiverTokenAccount] = await findAssociatedTokenPda({
    owner: buyer.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleInstructionAsync({
      payer: client.payer,
      gumballMachine,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      receiverTokenAccount,
      index: 0,
    }),
  ]);

  // When we close it.
  await sendTransaction(client.svm, client.payer, [
    await getCloseGumballMachineInstructionAsync({
      gumballGuard,
      authority: client.payer,
      machine: gumballMachine,
    }),
  ]);

  // Then the gumball machine account no longer exists.
  t.true(accountGone(client.svm, gumballMachine));
});

test('it can delete a settled gumball machine with payment token', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const seller = client.payer;

  // Given an SPL payment mint where the buyer holds 12 tokens and the machine
  // authority PDA already has its (empty) payment account.
  const machineSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: machineSigner.address,
  });
  const [tokenMint, , authorityPdaPaymentAccount] = await createMintWithHolders(
    client,
    {
      holders: [
        { owner: buyer.address, amount: 12 },
        { owner: authorityPda, amount: 0 },
      ],
    }
  );

  // And a machine priced in that mint with a single loaded nft.
  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    gumballMachine: machineSigner,
    settings: { paymentMint: tokenMint, itemCapacity: 1 },
    guards: { tokenPayment: { mint: tokenMint, amount: 1 } },
  });
  const { mint: nftMint } = await createNft(client);
  await sendTransaction(client.svm, seller, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({ gumballMachine, seller, mint: nftMint }),
    getStartSaleInstruction({ gumballMachine, authority: seller }),
  ]);

  // When the buyer draws, the payment sits in the authority PDA's account.
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { tokenPayment: some({ mint: tokenMint }) },
    }),
  ]);
  const machine = fetchGumballMachine(client.svm, gumballMachine);
  t.is(machine.items[0].buyer, buyer.address);
  t.is(fetchTokenAmount(client, authorityPdaPaymentAccount), 1n);

  // And the sale is settled in the payment mint.
  await sendTransaction(client.svm, seller, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      payer: seller,
      gumballMachine,
      index: 0,
      authority: seller.address,
      buyer: buyer.address,
      seller: seller.address,
      mint: nftMint,
      paymentMint: tokenMint,
      creators: [seller.address],
    }),
  ]);

  // When we close it, the escrow payment account must go with it.
  await sendTransaction(client.svm, seller, [
    COMPUTE_UNITS,
    await getCloseGumballMachineInstructionAsync({
      gumballGuard,
      authority: seller,
      machine: gumballMachine,
      paymentMint: tokenMint,
      authorityPdaPaymentAccount,
    }),
  ]);

  // Then the machine and the escrow token account no longer exist, and the
  // seller holds the one token the buyer paid.
  t.true(accountGone(client.svm, gumballMachine));
  t.true(accountGone(client.svm, authorityPdaPaymentAccount));
  const [sellerAta] = await findAssociatedTokenPda({
    owner: seller.address,
    mint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  t.is(fetchTokenAmount(client, sellerAta), 1n);
});

test('it cannot delete a gumball machine that has not been fully settled', async (t) => {
  const client = await createClient();

  // Given a gumball machine with a loaded (undrawn, unsettled) item.
  const { gumballMachine } = await createMachineNoGuard(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createFungibleMint(client, { amount: 100 });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
  ]);

  // When we try to delete it, then it fails.
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getDeleteGumballMachineInstructionAsync({
        gumballMachine,
        authority: client.payer,
        mintAuthority: client.payer,
      }),
    ]),
    { message: /NotAllSettled/ }
  );
});

test('it cannot delete a gumball machine that has buy back funds remaining', async (t) => {
  const client = await createClient();

  // Given a gumball machine with buy back enabled and deposited funds.
  const { gumballMachine } = await createMachineNoGuard(client, {
    buyBackConfig: { ...getDefaultBuyBackConfig(), enabled: true },
  });
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: sol(1),
      isWithdraw: false,
    }),
  ]);

  // When we try to delete it, then it fails.
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getDeleteGumballMachineInstructionAsync({
        gumballMachine,
        authority: client.payer,
        mintAuthority: client.payer,
      }),
    ]),
    { message: /BuyBackFundsNotZero/ }
  );
});

test('it can delete a gumball machine that has no buy back funds remaining', async (t) => {
  const client = await createClient();

  // Given a gumball machine with buy back enabled.
  const { gumballMachine } = await createMachineNoGuard(client, {
    buyBackConfig: { ...getDefaultBuyBackConfig(), enabled: true },
  });

  // Deposit and then withdraw all buy back funds.
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: 1,
      isWithdraw: false,
    }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    await getManageBuyBackFundsInstructionAsync({
      gumballMachine,
      authority: client.payer,
      amount: 1,
      isWithdraw: true,
    }),
  ]);

  // When we delete it.
  await sendTransaction(client.svm, client.payer, [
    await getDeleteGumballMachineInstructionAsync({
      gumballMachine,
      authority: client.payer,
      mintAuthority: client.payer,
    }),
  ]);

  // Then the gumball machine account no longer exists.
  t.true(accountGone(client.svm, gumballMachine));
});
