import {
  AccountState,
  decodeToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { none } from '@solana/kit';
import test from 'ava';
import {
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getCancelAddNftRequestInstructionAsync,
  getDeleteGumballMachineInstructionAsync,
  getRequestAddNftInstructionAsync,
} from '../src';
import {
  createNft,
  createUnwrappedGumballMachine,
  getAddItemRequest,
  getSellerHistory,
} from './_addSetup';
import {
  createClient,
  createGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

// NOTE: the umi suite includes "it can cancel a request to add a pnft" which
// requires programmable-NFT creation; omitted here (see report).

test('it can cancel a request to add an nft to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { mint } = await createNft(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddNftInstructionAsync({ gumballMachine, seller, mint }),
  ]);

  const [sellerHistory] = await findSellerHistoryPda({
    gumballMachine,
    seller: seller.address,
  });
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });

  await sendTransaction(client.svm, seller, [
    await getCancelAddNftRequestInstructionAsync({
      seller,
      mint,
      sellerHistory,
      authorityPda,
    }),
  ]);

  // The request is closed.
  t.is(await getAddItemRequest(client, mint), null);

  // The nft is unfrozen and revoked.
  const [ata] = await findAssociatedTokenPda({
    owner: seller.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const tokenAccount = decodeToken(client.svm.getAccount(ata) as never).data;
  t.is(tokenAccount.state, AccountState.Initialized);
  t.is(tokenAccount.owner, seller.address);
  t.deepEqual(tokenAccount.delegate, none());

  // Seller history should no longer exist.
  t.is(await getSellerHistory(client, gumballMachine, seller.address), null);
});

test('it can cancel a request to add an nft to a gumball machine after the gumball has closed', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createUnwrappedGumballMachine(client, {
    itemCapacity: 5,
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { mint } = await createNft(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddNftInstructionAsync({ gumballMachine, seller, mint }),
  ]);

  // Delete the gumball machine.
  await sendTransaction(client.svm, client.payer, [
    await getDeleteGumballMachineInstructionAsync({
      gumballMachine,
      authority: client.payer,
      mintAuthority: client.payer,
    }),
  ]);

  const [sellerHistory] = await findSellerHistoryPda({
    gumballMachine,
    seller: seller.address,
  });
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });

  await sendTransaction(client.svm, seller, [
    await getCancelAddNftRequestInstructionAsync({
      seller,
      mint,
      sellerHistory,
      authorityPda,
    }),
  ]);

  t.is(await getAddItemRequest(client, mint), null);

  const [ata] = await findAssociatedTokenPda({
    owner: seller.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const tokenAccount = decodeToken(client.svm.getAccount(ata) as never).data;
  t.is(tokenAccount.state, AccountState.Initialized);
  t.deepEqual(tokenAccount.delegate, none());

  t.is(await getSellerHistory(client, gumballMachine, seller.address), null);
});
