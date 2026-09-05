import {
  AccountState,
  decodeToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { getAddressDecoder, some } from '@solana/kit';
import test from 'ava';
import {
  draw,
  findGumballMachineAuthorityPda,
  getAddNftInstructionAsync,
  getClaimNftInstructionAsync,
  getMerkleProof,
  getMerkleRoot,
  getSettleNftSaleInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
} from '../src';
import { createNft, getSellerHistory, transferNft } from './_addSetup';
import {
  COMPUTE_UNITS,
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from './_setup';

// NOTE: the umi `addNft` suite includes two pNFT variants ("it can add pnft…"
// and "it can re-add pnft…"). Those require hand-encoding programmable-NFT
// creation + auth-rules delegation, which is out of scope for this port; they
// are omitted here (see report).

test('it can add nft to a gumball machine as the authority', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
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
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });

  // The nft is frozen and delegated to the machine authority PDA.
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const [ata] = await findAssociatedTokenPda({
    owner: client.payer.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const tokenAccount = decodeToken(client.svm.getAccount(ata) as never).data;
  t.is(tokenAccount.state, AccountState.Frozen);
  t.is(tokenAccount.owner, client.payer.address);
  t.deepEqual(tokenAccount.delegate, some(authorityPda));

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it can add nft to a gumball machine as allowlisted seller', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const sellersMerkleRoot = getMerkleRoot([otherSeller.address]);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const { mint } = await createNft(client, otherSeller);

  await sendTransaction(client.svm, otherSeller, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      mint,
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
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });
});

test('it can add nft to a gumball machine as allowlisted seller on allowlist of 10K addresses', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  // Cheap random addresses (no keypairs needed) to fill the allowlist.
  const addrDecoder = getAddressDecoder();
  const leaves = Array.from({ length: 10_000 }, () =>
    addrDecoder.decode(crypto.getRandomValues(new Uint8Array(32)))
  ) as string[];
  leaves.push(otherSeller.address);
  const sellersMerkleRoot = getMerkleRoot(leaves);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const { mint } = await createNft(client, otherSeller);

  await sendTransaction(client.svm, otherSeller, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: otherSeller,
      mint,
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
    tokenStandard: TokenStandard.NonFungible,
  });
});

test('it cannot add nft as non gumball authority when there is no seller allowlist set', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createNft(client, otherSeller);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        mint,
      }),
    ]),
    { message: /InvalidProofPath/ }
  );
});

test('it cannot add nft as non-allowlisted seller when there is a seller allowlist set', async (t) => {
  const client = await createClient();
  const otherSeller = await generateKeyPairSignerWithSol(client.svm);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([client.payer.address]),
    },
  });
  const { mint } = await createNft(client, otherSeller);

  await t.throwsAsync(
    sendTransaction(client.svm, otherSeller, [
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: otherSeller,
        mint,
      }),
    ]),
    { message: /InvalidProofPath/ }
  );
});

test('it can append additional nfts to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 2 },
  });
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
  ]);
  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint1,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 2);
  t.like(account.items[0], {
    index: 0,
    mint: mint0,
    tokenStandard: TokenStandard.NonFungible,
  });
  t.like(account.items[1], {
    index: 1,
    mint: mint1,
    tokenStandard: TokenStandard.NonFungible,
  });
});

test('it cannot add nfts that would make the gumball machine exceed the maximum capacity', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
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
    ]),
    { message: /IndexGreaterThanLength/ }
  );
});

test('it cannot add nfts once the gumball machine is fully loaded', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 1 },
  });
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: client.payer,
        mint: mint1,
      }),
    ]),
    { message: /IndexGreaterThanLength/ }
  );
});

test('it cannot add more nfts than allowed per seller', async (t) => {
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

test('it can re-add nft to a gumball machine as the authority', async (t) => {
  const client = await createClient();
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);
  const mints = [mint0, mint1];

  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  await sendTransaction(client.svm, client.payer, [
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

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleNftSaleInstructionAsync({
      index: drawnIndex,
      payer: client.payer,
      gumballMachine,
      authority: client.payer.address,
      buyer: buyer.address,
      seller: client.payer.address,
      mint: mints[drawnIndex],
      creators: [client.payer.address],
    }),
  ]);

  // Transfer the nft back to the seller.
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await transferNft(mints[drawnIndex], buyer, client.payer.address),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mints[drawnIndex],
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
    tokenStandard: TokenStandard.NonFungible,
  });
  t.like(account.items[1], {
    index: 1,
    mint: mint1,
    tokenStandard: TokenStandard.NonFungible,
  });

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    client.payer.address
  );
  t.is(sellerHistory?.itemCount, 2n);
});

test('it cannot add nft without index to a live gumball machine', async (t) => {
  const client = await createClient();
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);

  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: client.payer,
        mint: mint1,
      }),
    ]),
    { message: /MissingItemIndex/ }
  );
});

test('it cannot re-add nft to index with an unclaimed item', async (t) => {
  const client = await createClient();
  const { mint: mint0 } = await createNft(client);

  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: mint0,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: client.payer,
        mint: mint0,
        args: { index: some(0) },
      }),
    ]),
    { message: /ItemNotClaimed/ }
  );
});

test('it cannot re-add nft to index with an unsettled item', async (t) => {
  const client = await createClient();
  const { mint: mint0 } = await createNft(client);
  const { mint: mint1 } = await createNft(client);
  const mints = [mint0, mint1];

  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });
  await sendTransaction(client.svm, client.payer, [
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
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  const drawnIndex = account.items.findIndex((i) => i.isDrawn);

  // Claim the item as the buyer (but do not settle).
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimNftInstructionAsync({
      index: drawnIndex,
      payer: buyer,
      gumballMachine,
      buyer: buyer.address,
      seller: client.payer.address,
      mint: mints[drawnIndex],
    }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getAddNftInstructionAsync({
        gumballMachine,
        seller: client.payer,
        mint: mints[drawnIndex],
        args: { index: some(drawnIndex) },
      }),
    ]),
    { message: /ItemNotSettled/ }
  );
});
