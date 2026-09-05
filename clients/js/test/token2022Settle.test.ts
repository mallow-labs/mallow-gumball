import {
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';
import { generateKeyPairSigner, some, type Address } from '@solana/kit';
import test from 'ava';
import {
  draw,
  findGumballMachineAuthorityPda,
  getAddNftInstructionAsync,
  getCloseGumballMachineInstructionAsync,
  getSettleNftSaleInstructionAsync,
  getStartSaleInstruction,
} from '../src';
import { createNft } from './_nftKit';
import {
  COMPUTE_UNITS,
  createClient,
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

/**
 * Token-2022 payment, drawn **and settled** (TOKEN22_PLAN §4).
 *
 * The existing `defaultGuards/token2022Payment.test.ts` stops at the draw, so
 * nothing covered the settle half — which is where the money actually reaches
 * the seller and where every §D5 slot-0 / program-aware-ATA mistake shows up as
 * a wrong payee rather than a failed transaction.
 */

const ata22 = async (mint: Address, owner: Address): Promise<Address> =>
  (
    await findAssociatedTokenPda({
      mint,
      owner,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    })
  )[0];

test('a Token-2022 gumball can be drawn and settled — proceeds reach the seller', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const seller = client.payer;

  const machineSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: machineSigner.address,
  });

  // The guard reads the destination ATA's data, so it has to exist before the
  // draw — the real client prepends an idempotent create for exactly this.
  const [mint, , destinationAta] = await createMintWithHolders(client, {
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    holders: [
      { owner: buyer.address, amount: 100 },
      { owner: authorityPda, amount: 0 },
    ],
  });

  const { gumballMachine } = await createGumballMachine(client, {
    gumballMachine: machineSigner,
    settings: { paymentMint: mint, itemCapacity: 1 },
    guards: { token2022Payment: { mint, amount: 50, destinationAta } },
  });

  const { mint: nftMint } = await createNft(client);
  await sendTransaction(client.svm, seller, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({ gumballMachine, seller, mint: nftMint }),
    getStartSaleInstruction({ gumballMachine, authority: seller }),
  ]);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { token2022Payment: some({ mint, destinationAta }) },
    }),
  ]);

  // Proceeds sit in the machine authority PDA's Token-2022 ATA until settle.
  t.is(fetchTokenAmount(client, destinationAta), 50n);
  t.is(fetchGumballMachine(client.svm, gumballMachine).totalRevenue, 50n);

  const sellerAta = await ata22(mint, seller.address);
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
      paymentMint: mint,
      // §D3: without this the wrapper derives classic-seed creator ATAs and
      // omits the §D5 slot-0 program account, and the settle CPI fails.
      paymentTokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      creators: [seller.address],
    }),
  ]);

  // The whole draw price reaches the seller: nothing is skimmed (§D2 rejects
  // transfer-fee mints) and nothing is stranded in the escrow.
  t.is(fetchTokenAmount(client, sellerAta), 50n);
  t.is(fetchTokenAmount(client, destinationAta), 0n);
});

test('closing a settled Token-2022 gumball reclaims the escrow ATA', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const seller = client.payer;

  const machineSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: machineSigner.address,
  });

  // The guard reads the destination ATA's data, so it has to exist before the
  // draw — the real client prepends an idempotent create for exactly this.
  const [mint, , destinationAta] = await createMintWithHolders(client, {
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    holders: [
      { owner: buyer.address, amount: 100 },
      { owner: authorityPda, amount: 0 },
    ],
  });

  const { gumballMachine, gumballGuard } = await createGumballMachine(client, {
    gumballMachine: machineSigner,
    settings: { paymentMint: mint, itemCapacity: 1 },
    guards: { token2022Payment: { mint, amount: 50, destinationAta } },
  });

  const { mint: nftMint } = await createNft(client);
  await sendTransaction(client.svm, seller, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({ gumballMachine, seller, mint: nftMint }),
    getStartSaleInstruction({ gumballMachine, authority: seller }),
  ]);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { token2022Payment: some({ mint, destinationAta }) },
    }),
  ]);

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
      paymentMint: mint,
      paymentTokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      creators: [seller.address],
    }),
  ]);

  // The close path both derives the escrow ATA and *closes* it, and only the
  // Token-2022 program can close a Token-2022 account — §D5 slot 4 is what
  // carries it.
  await sendTransaction(client.svm, seller, [
    COMPUTE_UNITS,
    await getCloseGumballMachineInstructionAsync({
      machine: gumballMachine,
      gumballGuard,
      authority: seller,
      paymentMint: mint,
      paymentTokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      authorityPdaPaymentAccount: destinationAta,
    }),
  ]);

  t.false(client.svm.getAccount(destinationAta).exists);
});

test('a Token-2022 draw fails when the guard mint is not the machine payment mint', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));

  const [mint] = await createMintWithHolders(client, {
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    holders: [{ owner: buyer.address, amount: 100 }],
  });
  const otherMint = (await generateKeyPairSigner()).address;

  const machineSigner = await generateKeyPairSigner();
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine: machineSigner.address,
  });
  const destinationAta = await ata22(mint, authorityPda);

  const { gumballMachine } = await createGumballMachine(client, {
    gumballMachine: machineSigner,
    settings: { paymentMint: otherMint, itemCapacity: 1 },
    guards: { token2022Payment: { mint, amount: 50, destinationAta } },
  });

  const { mint: nftMint } = await createNft(client);
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: nftMint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, buyer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: buyer,
        buyer,
        mintArgs: { token2022Payment: some({ mint, destinationAta }) },
      }),
    ])
  );
});
