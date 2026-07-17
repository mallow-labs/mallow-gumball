import { generateKeyPairSigner, some, type Address } from '@solana/kit';
import type { ExecutionContext } from 'ava';
import test from 'ava';
import {
  draw,
  findAssociatedTokenPda,
  findMasterEditionPda,
  findMetadataPda,
  TokenStandard,
} from '../../src';
import {
  createCollectionNft,
  createNft,
  createVerifiedNft,
  createVerifiedProgrammableNft,
} from '../_nftKit';
import {
  COMPUTE_UNITS,
  createClient,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
  type Client,
} from '../_setup';
import {
  accountExists,
  assertBotTax,
  createLoadedGumballMachine,
  sendForLogs,
} from './_guardsBSetup';

/** Assert the NFT `mint` owned by `owner` was burned (token + edition closed). */
const assertBurnedNft = async (
  t: ExecutionContext,
  client: Client,
  mint: Address,
  owner: Address
): Promise<void> => {
  const [tokenAccount] = await findAssociatedTokenPda({ mint, owner });
  const [metadata] = await findMetadataPda({ mint });
  const [edition] = await findMasterEditionPda({ mint });

  // The metadata account is not closed (it retains fees) but is shrunk to 1 byte.
  const metadataAccount = client.svm.getAccount(metadata);
  if (!metadataAccount.exists) throw new Error('Metadata account not found');
  t.is((metadataAccount.data as Uint8Array).length, 1);

  t.false(accountExists(client, tokenAccount));
  t.false(accountExists(client, edition));
};

test('it burns a specific NFT to allow minting', async (t) => {
  const client = await createClient();
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });
  const { mint: nftToBurn } = await createVerifiedNft(client, {
    tokenOwner: client.payer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftBurn: some({ requiredCollection }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftBurn: some({
          tokenStandard: TokenStandard.NonFungible,
          requiredCollection,
          mint: nftToBurn,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  await assertBurnedNft(t, client, nftToBurn, client.payer.address);
});

test('nftBurn: it allows minting even when the payer is different from the buyer', async (t) => {
  const client = await createClient();
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });
  const { mint: nftToBurn } = await createVerifiedNft(client, {
    tokenOwner: buyer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftBurn: some({ requiredCollection }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: {
        nftBurn: some({
          tokenStandard: TokenStandard.NonFungible,
          requiredCollection,
          mint: nftToBurn,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);

  await assertBurnedNft(t, client, nftToBurn, buyer.address);
});

test('it fails if there is not valid NFT to burn', async (t) => {
  const client = await createClient();
  const { mint: requiredCollection } = await createCollectionNft(client);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftBurn: some({ requiredCollection }) },
  });

  // An NFT that's not part of the required collection.
  const { mint: nftToBurn } = await createNft(client);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: {
          nftBurn: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn,
          }),
        },
      }),
    ]),
    { message: /InvalidNftCollection/ }
  );
});

test('it charges a bot tax when trying to mint using the wrong NFT', async (t) => {
  const client = await createClient();
  const { mint: requiredCollection } = await createCollectionNft(client);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      nftBurn: some({ requiredCollection }),
    },
  });

  // An NFT that's not part of the required collection.
  const { mint: nftToBurn } = await createNft(client);

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftBurn: some({
          tokenStandard: TokenStandard.NonFungible,
          requiredCollection,
          mint: nftToBurn,
        }),
      },
    }),
  ]);

  assertBotTax(t, logs, /InvalidNftCollection/);
});

test('it burns a specific Programmable NFT to allow minting', async (t) => {
  const client = await createClient();
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });
  const { mint: pnftToBurn } = await createVerifiedProgrammableNft(client, {
    tokenOwner: client.payer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftBurn: some({ requiredCollection }) },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftBurn: some({
          tokenStandard: TokenStandard.ProgrammableNonFungible,
          requiredCollection,
          mint: pnftToBurn,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  await assertBurnedNft(t, client, pnftToBurn, client.payer.address);
});
