import {
  getCreateAssociatedTokenInstructionAsync,
  getTransferInstruction,
} from '@solana-program/token';
import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import { draw, findAssociatedTokenPda, TokenStandard } from '../../src';
import {
  createCollectionNft,
  createCoreAsset,
  createCoreCollection,
  createMintWithNonAssociatedToken,
  createNft,
  createVerifiedNft,
} from '../_nftKit';
import {
  COMPUTE_UNITS,
  createClient,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from '../_setup';
import {
  assertBotTax,
  createLoadedGumballMachine,
  sendForLogs,
} from './_guardsBSetup';

test('it allows minting when the payer owns an NFT from a certain collection', async (t) => {
  const client = await createClient();
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });
  const { mint: nftToVerify } = await createVerifiedNft(client, {
    tokenOwner: client.payer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { nftGate: some({ mint: nftToVerify }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
});

test('nftGate: it allows minting even when the payer is different from the buyer', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });
  const { mint: nftToVerify } = await createVerifiedNft(client, {
    tokenOwner: buyer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: { nftGate: some({ mint: nftToVerify }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
});

test('it allows minting when the NFT is not on an associated token account', async (t) => {
  const client = await createClient();
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });

  // A payer that owns the NFT on a non-associated token account.
  const { mint, token } = await createMintWithNonAssociatedToken(
    client,
    client.payer.address
  );
  await createVerifiedNft(client, {
    mint,
    token,
    tokenOwner: client.payer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftGate: some({ mint: mint.address, tokenAccount: token }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
});

test('it forbids minting when the payer does not own an NFT from a certain collection', async (t) => {
  const client = await createClient();
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });
  const { mint: nftToVerify } = await createVerifiedNft(client, {
    tokenOwner: client.payer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  // But sent their NFT to another wallet, leaving an empty token account.
  const destination = (await generateKeyPairSigner()).address;
  const [source] = await findAssociatedTokenPda({
    mint: nftToVerify,
    owner: client.payer.address,
  });
  const [destinationAta] = await findAssociatedTokenPda({
    mint: nftToVerify,
    owner: destination,
  });
  await sendTransaction(client.svm, client.payer, [
    await getCreateAssociatedTokenInstructionAsync({
      payer: client.payer,
      owner: destination,
      mint: nftToVerify,
    }),
    getTransferInstruction({
      source,
      destination: destinationAta,
      authority: client.payer,
      amount: 1,
    }),
  ]);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { nftGate: some({ mint: nftToVerify }) },
      }),
    ]),
    { message: /MissingNft/ }
  );
});

test('it forbids minting when the payer tries to provide an NFT from the wrong collection', async (t) => {
  const client = await createClient();
  const collectionAuthorityA = await generateKeyPairSigner();
  const { mint: requiredCollectionA } = await createCollectionNft(client, {
    authority: collectionAuthorityA,
  });
  const { mint: nftToVerify } = await createVerifiedNft(client, {
    tokenOwner: client.payer.address,
    collectionMint: requiredCollectionA,
    collectionAuthority: collectionAuthorityA,
  });

  // A gumball machine gated on a different collection B.
  const collectionAuthorityB = await generateKeyPairSigner();
  const { mint: requiredCollectionB } = await createCollectionNft(client, {
    authority: collectionAuthorityB,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection: requiredCollectionB }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { nftGate: some({ mint: nftToVerify }) },
      }),
    ]),
    { message: /InvalidNftCollection/ }
  );
});

test('it forbids minting when the payer tries to provide an NFT from an unverified collection', async (t) => {
  const client = await createClient();
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });
  // A plain NFT with no collection reference (thus unverified).
  const { mint: nftToVerify } = await createNft(client, {
    owner: client.payer.address,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { nftGate: some({ mint: nftToVerify }) },
      }),
    ]),
    { message: /InvalidNftCollection/ }
  );
});

test('it charges a bot tax when trying to mint without owning the right NFT', async (t) => {
  const client = await createClient();
  const { mint: requiredCollection } = await createCollectionNft(client);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      nftGate: some({ requiredCollection }),
    },
  });

  // Any NFT that's not from the required collection.
  const { mint: wrongNft } = await createNft(client);

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { nftGate: some({ mint: wrongNft }) },
    }),
  ]);

  assertBotTax(t, logs, /InvalidNftCollection/);
});

test('it allows minting when the payer owns an NFT from a core collection', async (t) => {
  const client = await createClient();
  const { collection: requiredCollection } = await createCoreCollection(client);
  const { asset: nftToVerify } = await createCoreAsset(client, {
    collection: requiredCollection,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftGate: some({
          mint: nftToVerify,
          tokenStandard: TokenStandard.Core,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
});

test('it forbids minting when the payer does not own a core asset from a certain collection', async (t) => {
  const client = await createClient();
  const { collection: requiredCollection } = await createCoreCollection(client);
  const otherOwner = (await generateKeyPairSigner()).address;
  const { asset: nftToVerify } = await createCoreAsset(client, {
    owner: otherOwner,
    collection: requiredCollection,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: {
          nftGate: some({
            mint: nftToVerify,
            tokenStandard: TokenStandard.Core,
          }),
        },
      }),
    ]),
    { message: /MissingNft/ }
  );
});

test('it forbids minting when the payer tries to provide a core asset from the wrong collection', async (t) => {
  const client = await createClient();
  const { collection: requiredCollection } = await createCoreCollection(client);
  const otherOwner = (await generateKeyPairSigner()).address;
  const { asset: nftToVerify } = await createCoreAsset(client, {
    owner: otherOwner,
    collection: requiredCollection,
  });

  const { collection: requiredCollectionB } =
    await createCoreCollection(client);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftGate: some({ requiredCollection: requiredCollectionB }) },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: {
          nftGate: some({
            mint: nftToVerify,
            tokenStandard: TokenStandard.Core,
          }),
        },
      }),
    ]),
    { message: /InvalidNftCollection/ }
  );
});
