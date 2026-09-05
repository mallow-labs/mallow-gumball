import { getCreateAccountInstruction } from '@solana-program/system';
import {
  fetchMaybeToken,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  generateKeyPairSigner,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import test from 'ava';
import {
  fetchMaybeSellerHistory,
  fetchSellerHistory,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getAddTokensInstructionAsync,
  getMerkleProof,
  getMerkleRoot,
  getRemoveTokensSpanInstructionAsync,
} from '../src';
import {
  COMPUTE_UNITS,
  createClient,
  createFungibleMint,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  type Client,
} from './_setup';

const ata = async (mint: string, owner: string) =>
  (
    await findAssociatedTokenPda({
      mint: mint as any,
      owner: owner as any,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })
  )[0];

/** Create a fresh SPL mint and mint `amount` tokens to `owner`'s ATA. */
const createFungibleMintFor = async (
  client: Client,
  owner: TransactionSigner,
  amount: number | bigint
): Promise<{ mint: Address }> => {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = client.svm.minimumBalanceForRentExemption(space);
  const [ownerAta] = await findAssociatedTokenPda({
    owner: owner.address,
    mint: mint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await sendTransaction(client.svm, owner, [
    getCreateAccountInstruction({
      payer: owner,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 0,
      mintAuthority: owner.address,
    }),
    await getCreateAssociatedTokenInstructionAsync({
      payer: owner,
      owner: owner.address,
      mint: mint.address,
    }),
    getMintToInstruction({
      mint: mint.address,
      token: ownerAta,
      mintAuthority: owner,
      amount,
    }),
  ]);
  return { mint: mint.address };
};

test('it can remove tokens from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
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

  await sendTransaction(client.svm, client.payer, [
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint,
      startIndex: 0,
      endIndex: 0,
      amount: 100,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);
  t.deepEqual(account.items, []);

  const token = await fetchToken(
    client.rpc,
    await ata(mint, client.payer.address)
  );
  t.is(token.data.amount, 100n);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const maybeAuthorityToken = await fetchMaybeToken(
    client.rpc,
    await ata(mint, authorityPda)
  );
  t.false(maybeAuthorityToken.exists);

  const [sellerHistoryPda] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerHistory = await fetchMaybeSellerHistory(
    client.rpc,
    sellerHistoryPda
  );
  t.false(sellerHistory.exists);
});

test('it can remove tokens at a lower index than last from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint: mint1 } = await createFungibleMint(client, { amount: 100 });
  const { mint: mint2 } = await createFungibleMint(client, { amount: 100 });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
      amount: 100,
      quantity: 1,
    }),
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint2,
      amount: 100,
      quantity: 1,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint: mint1,
      startIndex: 0,
      endIndex: 0,
      amount: 100,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    isDrawn: false,
    isClaimed: false,
    isSettled: false,
    mint: mint2,
    seller: client.payer.address,
    amount: 100,
  });

  const token = await fetchToken(
    client.rpc,
    await ata(mint1, client.payer.address)
  );
  t.is(token.data.amount, 100n);
});

test('it can remove additional tokens from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2 },
  });
  const { mint: mint1 } = await createFungibleMint(client, { amount: 100 });
  const { mint: mint2 } = await createFungibleMint(client, { amount: 100 });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
      amount: 100,
      quantity: 1,
    }),
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint2,
      amount: 100,
      quantity: 1,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint: mint1,
      startIndex: 0,
      endIndex: 0,
      amount: 100,
    }),
  ]);

  const [sellerHistoryPda] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerHistory = await fetchSellerHistory(client.rpc, sellerHistoryPda);
  t.is(sellerHistory.data.itemCount, 1n);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint: mint2,
      startIndex: 0,
      endIndex: 0,
      amount: 100,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);
  t.deepEqual(account.items, []);
});

test('it cannot remove tokens when the machine is empty', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { mint } = await createFungibleMint(client, { amount: 100 });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getRemoveTokensSpanInstructionAsync({
        gumballMachine,
        authority: client.payer,
        seller: client.payer.address,
        mint,
        startIndex: 0,
        endIndex: 0,
        amount: 100,
      }),
    ]),
    { message: /AccountNotInitialized/ }
  );
});

test('it cannot remove tokens as a different seller', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
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

  const other = await generateKeyPairSignerWithSol(client.svm);
  await t.throwsAsync(
    sendTransaction(client.svm, other, [
      await getRemoveTokensSpanInstructionAsync({
        gumballMachine,
        authority: other,
        seller: client.payer.address,
        mint,
        startIndex: 0,
        endIndex: 0,
        amount: 100,
      }),
    ]),
    { message: /InvalidAuthority/ }
  );
});

test('it can remove another seller tokens as the gumball authority', async (t) => {
  const client = await createClient();
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 1,
      sellersMerkleRoot: getMerkleRoot([seller.address]),
    },
  });
  const { mint } = await createFungibleMintFor(client, seller, 100);

  await sendTransaction(client.svm, seller, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller,
      mint,
      amount: 100,
      quantity: 1,
      args: {
        sellerProofPath: getMerkleProof([seller.address], seller.address),
      },
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: seller.address,
      mint,
      startIndex: 0,
      endIndex: 0,
      amount: 100,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);

  const token = await fetchToken(client.rpc, await ata(mint, seller.address));
  t.is(token.data.amount, 100n);
});

test('it can remove own tokens as non gumball authority', async (t) => {
  const client = await createClient();
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 1,
      sellersMerkleRoot: getMerkleRoot([seller.address]),
    },
  });
  const { mint } = await createFungibleMintFor(client, seller, 100);

  await sendTransaction(client.svm, seller, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller,
      mint,
      amount: 100,
      quantity: 1,
      args: {
        sellerProofPath: getMerkleProof([seller.address], seller.address),
      },
    }),
  ]);

  await sendTransaction(client.svm, seller, [
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: seller,
      seller: seller.address,
      mint,
      startIndex: 0,
      endIndex: 0,
      amount: 100,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);

  const token = await fetchToken(client.rpc, await ata(mint, seller.address));
  t.is(token.data.amount, 100n);
});

test('it does not close the authority pda token account when there are tokens remaining', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createFungibleMint(client, { amount: 200 });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 2,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint,
      startIndex: 0,
      endIndex: 0,
      amount: 100,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], { index: 0, amount: 100, mint });

  const sellerToken = await fetchToken(
    client.rpc,
    await ata(mint, client.payer.address)
  );
  t.is(sellerToken.data.amount, 100n);

  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const authorityToken = await fetchToken(
    client.rpc,
    await ata(mint, authorityPda)
  );
  t.is(authorityToken.data.amount, 100n);

  const [sellerHistoryPda] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerHistory = await fetchSellerHistory(client.rpc, sellerHistoryPda);
  t.is(sellerHistory.data.itemCount, 1n);
});

test('it cannot remove one of another token amount from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 100 },
  });
  const { mint } = await createFungibleMint(client, { amount: 100 });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 10,
      quantity: 1,
    }),
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 20,
      quantity: 1,
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getRemoveTokensSpanInstructionAsync({
        gumballMachine,
        authority: client.payer,
        seller: client.payer.address,
        mint,
        startIndex: 0,
        endIndex: 1,
        amount: 10,
      }),
    ]),
    { message: /InvalidAmount/ }
  );
});

test('it can remove 1000 tokens at once from a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1000 },
  });
  const { mint } = await createFungibleMint(client, { amount: 1000 });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity: 1000,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getRemoveTokensSpanInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: client.payer.address,
      mint,
      startIndex: 0,
      endIndex: 999,
      amount: 1,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 0);

  const token = await fetchToken(
    client.rpc,
    await ata(mint, client.payer.address)
  );
  t.is(token.data.amount, 1000n);

  const [sellerHistoryPda] = await findSellerHistoryPda({
    gumballMachine,
    seller: client.payer.address,
  });
  const sellerHistory = await fetchMaybeSellerHistory(
    client.rpc,
    sellerHistoryPda
  );
  t.false(sellerHistory.exists);
});
