import {
  AccountState,
  decodeToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { getAddressDecoder, none, some, type Address } from '@solana/kit';
import test from 'ava';
import {
  draw,
  findGumballMachineAuthorityPda,
  getAddNftInstructionAsync,
  getAddTokensInstructionAsync,
  getMerkleProof,
  getMerkleRoot,
  getSettleTokensSaleInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
} from '../src';
import {
  createNft,
  createTokensForSeller,
  getSellerHistory,
} from './_addSetup';
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

const tokenAmount = (client: Client, ata: Address) =>
  decodeToken(client.svm.getAccount(ata) as never).data;

const authorityAta = async (
  gumballMachine: Address,
  mint: Address
): Promise<Address> => {
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const [ata] = await findAssociatedTokenPda({
    owner: authorityPda,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata as Address;
};

test('it can add tokens to a gumball machine as the authority', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint, sellerAta } = await createTokensForSeller(
    client,
    client.payer,
    100
  );

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    isDrawn: false,
    isClaimed: false,
    isSettled: false,
    mint,
    seller: client.payer.address,
    buyer: undefined,
    tokenStandard: TokenStandard.Fungible,
    amount: 100,
  });

  const seller = tokenAmount(client, sellerAta);
  t.is(seller.state, AccountState.Initialized);
  t.deepEqual(seller.delegate, none());
  t.is(seller.amount, 0n);

  const authority = tokenAmount(
    client,
    await authorityAta(gumballMachine, mint)
  );
  t.is(authority.amount, 100n);

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it can add multiple tokens items to a gumball machine as the authority', async (t) => {
  const quantity = 1000;
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: quantity },
  });
  const { mint, sellerAta } = await createTokensForSeller(
    client,
    client.payer,
    quantity
  );

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, quantity);
  t.is(account.items.length, quantity);
  t.like(account.items[0], {
    index: 0,
    mint,
    seller: client.payer.address,
    tokenStandard: TokenStandard.Fungible,
    amount: 1,
  });
  t.like(account.items[quantity - 1], { index: quantity - 1, amount: 1 });

  t.is(tokenAmount(client, sellerAta).amount, 0n);
  t.is(
    tokenAmount(client, await authorityAta(gumballMachine, mint)).amount,
    BigInt(quantity)
  );

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, BigInt(quantity));
});

test('it can add tokens to a gumball machine as allowlisted seller', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const { mint, sellerAta } = await createTokensForSeller(
    client,
    otherSeller,
    100
  );

  await sendTransaction(client.svm, otherSeller, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      mint,
      amount: 100,
      quantity: 1,
      args: {
        sellerProofPath: some(
          getMerkleProof([otherSeller.address], otherSeller.address)
        ),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    mint,
    seller: otherSeller.address,
    tokenStandard: TokenStandard.Fungible,
    amount: 100,
  });

  t.is(tokenAmount(client, sellerAta).amount, 0n);
  t.is(
    tokenAmount(client, await authorityAta(gumballMachine, mint)).amount,
    100n
  );

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    otherSeller.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it can add tokens to a gumball machine as allowlisted seller on allowlist of 10K addresses', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const addrDecoder = getAddressDecoder();
  const leaves = Array.from({ length: 10_000 }, () =>
    addrDecoder.decode(crypto.getRandomValues(new Uint8Array(32)))
  ) as string[];
  leaves.push(otherSeller.address);
  const sellersMerkleRoot = getMerkleRoot(leaves);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const { mint, sellerAta } = await createTokensForSeller(
    client,
    otherSeller,
    100
  );

  await sendTransaction(client.svm, otherSeller, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      mint,
      amount: 100,
      quantity: 1,
      args: {
        sellerProofPath: some(getMerkleProof(leaves, otherSeller.address)),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    mint,
    seller: otherSeller.address,
    tokenStandard: TokenStandard.Fungible,
    amount: 100,
  });
  t.is(tokenAmount(client, sellerAta).amount, 0n);
  t.is(
    tokenAmount(client, await authorityAta(gumballMachine, mint)).amount,
    100n
  );
});

test('it cannot add tokens as non gumball authority when there is no seller allowlist set', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createTokensForSeller(client, otherSeller, 100);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddTokensInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        mint,
        amount: 100,
        quantity: 1,
      }),
    ]),
    { message: /InvalidProofPath/ }
  );
});

test('it cannot add tokens as non-allowlisted seller when there is a seller allowlist set', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([client.payer.address]),
    },
  });
  const { mint } = await createTokensForSeller(client, otherSeller, 100);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddTokensInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        mint,
        amount: 100,
        quantity: 1,
      }),
    ]),
    { message: /InvalidProofPath/ }
  );
});

test('it can append additional tokens to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2 },
  });
  const { mint, sellerAta } = await createTokensForSeller(
    client,
    client.payer,
    200
  );

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
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 2);
  t.like(account.items[0], {
    index: 0,
    mint,
    amount: 100,
    tokenStandard: TokenStandard.Fungible,
  });
  t.like(account.items[1], {
    index: 1,
    mint,
    amount: 100,
    tokenStandard: TokenStandard.Fungible,
  });

  t.is(tokenAmount(client, sellerAta).amount, 0n);
  t.is(
    tokenAmount(client, await authorityAta(gumballMachine, mint)).amount,
    200n
  );

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, 2n);
});

test('it cannot add tokens that would make the gumball machine exceed the maximum capacity', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { mint, sellerAta } = await createTokensForSeller(
    client,
    client.payer,
    200
  );

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getAddTokensInstructionAsync({
        gumballMachine,
        seller: client.payer,
        mint,
        amount: 100,
        quantity: 2,
      }),
    ]),
    { message: /IndexGreaterThanLength/ }
  );

  t.is(tokenAmount(client, sellerAta).amount, 200n);
});

test('it cannot add tokens once the gumball machine is fully loaded', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { mint } = await createTokensForSeller(client, client.payer, 200);

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getAddTokensInstructionAsync({
        gumballMachine,
        seller: client.payer,
        mint,
        amount: 100,
        quantity: 1,
      }),
    ]),
    { message: /IndexGreaterThanLength/ }
  );

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], { index: 0, mint, amount: 100 });
});

test('it cannot add more tokens than allowed per seller', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2, itemsPerSeller: 1, sellersMerkleRoot },
  });
  const { mint: mint0 } = await createNft(client, otherSeller);
  const { mint: mint1 } = await createNft(client, otherSeller);
  const proof = some(
    getMerkleProof([otherSeller.address], otherSeller.address)
  );

  await sendTransaction(client.svm, otherSeller, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      mint: mint0,
      args: { sellerProofPath: proof },
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        mint: mint1,
        args: { sellerProofPath: proof },
      }),
    ]),
    { message: /SellerTooManyItems/ }
  );
});

test('it can re-add tokens to a gumball machine as the authority', async (t) => {
  const client = await createClient();
  const { mint: mint0 } = await createTokensForSeller(
    client,
    client.payer,
    100
  );
  const { mint: mint1 } = await createTokensForSeller(
    client,
    client.payer,
    100
  );
  const mints = [mint0, mint1];

  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
      amount: 1,
      quantity: 1,
    }),
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
      amount: 1,
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

  let account = fetchGumballMachine(client.svm, gumballMachine);
  const drawnIndex = account.items.findIndex((i) => i.isDrawn);

  const [receiverTokenAccount] = await findAssociatedTokenPda({
    owner: buyer.address,
    mint: mints[drawnIndex],
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleInstructionAsync({
      index: drawnIndex,
      payer: client.payer,
      gumballMachine,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint: mints[drawnIndex],
      receiverTokenAccount,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mints[drawnIndex],
      amount: 1,
      quantity: 1,
      args: { index: some(drawnIndex) },
    }),
  ]);

  account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 2);
  t.is(account.itemsRedeemed, 0n);
  t.is(account.itemsSettled, 0n);
  t.is(account.totalProceedsSettled, sol(0.5));
  t.like(account.items[0], {
    index: 0,
    mint: mint0,
    tokenStandard: TokenStandard.Fungible,
  });
  t.like(account.items[1], {
    index: 1,
    mint: mint1,
    tokenStandard: TokenStandard.Fungible,
  });

  t.is(
    tokenAmount(client, await authorityAta(gumballMachine, mints[drawnIndex]))
      .amount,
    1n
  );

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, 2n);
});

test('it can re-add a span of tokens to a gumball machine', async (t) => {
  const client = await createClient();
  const { mint, sellerAta } = await createTokensForSeller(
    client,
    client.payer,
    100
  );

  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity: 4,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
    await draw({ gumballMachine, payer: buyer, buyer }),
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  let account = fetchGumballMachine(client.svm, gumballMachine);
  const drawnIndices = account.items
    .filter((i) => i.isDrawn)
    .map((i) => i.index);

  const getConsecutiveStartIndex = (indices: number[]) => {
    for (let i = 0; i < indices.length - 1; i += 1) {
      if (indices[i] + 1 === indices[i + 1]) return indices[i];
    }
    return undefined;
  };
  const startIndex = getConsecutiveStartIndex(drawnIndices)!;

  const [receiverTokenAccount] = await findAssociatedTokenPda({
    owner: buyer.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleInstructionAsync({
      index: startIndex,
      payer: client.payer,
      gumballMachine,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      receiverTokenAccount,
    }),
    await getSettleTokensSaleInstructionAsync({
      index: startIndex + 1,
      payer: client.payer,
      gumballMachine,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      receiverTokenAccount,
    }),
  ]);

  const balanceBefore = tokenAmount(client, sellerAta).amount;

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity: 2,
      args: { index: some(startIndex) },
    }),
  ]);

  const balanceAfter = tokenAmount(client, sellerAta).amount;
  t.is(balanceAfter, balanceBefore - 2n);

  account = fetchGumballMachine(client.svm, gumballMachine);
  t.false(account.items[startIndex].isDrawn);
  t.false(account.items[startIndex + 1].isDrawn);
});
