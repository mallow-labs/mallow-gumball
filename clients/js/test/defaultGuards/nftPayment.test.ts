import { generateKeyPairSigner, some, type Address } from '@solana/kit';
import type { ExecutionContext } from 'ava';
import test from 'ava';
import { draw, findAssociatedTokenPda, TokenStandard } from '../../src';
import {
  createCollectionNft,
  createMintWithNonAssociatedToken,
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
  assertBotTax,
  createLoadedGumballMachine,
  fetchTokenAmount,
  sendForLogs,
} from './_guardsBSetup';

const RULE_SET = 'eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9' as Address;

/** Assert the NFT `mint` now sits (amount 1) on `owner`'s associated account. */
const assertNftOwnedBy = async (
  t: ExecutionContext,
  client: Client,
  mint: Address,
  owner: Address
): Promise<void> => {
  const [ata] = await findAssociatedTokenPda({ mint, owner });
  t.is(fetchTokenAmount(client, ata), 1n);
};

test('it transfers an NFT from the payer to the destination', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftPayment: some({ requiredCollection, destination }) },
  });

  const { mint: nftToSend } = await createVerifiedNft(client, {
    tokenOwner: client.payer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftPayment: some({
          tokenStandard: TokenStandard.NonFungible,
          mint: nftToSend,
          destination,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
  await assertNftOwnedBy(t, client, nftToSend, destination);
});

test('nftPayment: it allows minting even when the payer is different from the buyer', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftPayment: some({ requiredCollection, destination }) },
  });

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const { mint: nftToSend } = await createVerifiedNft(client, {
    tokenOwner: buyer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: {
        nftPayment: some({
          tokenStandard: TokenStandard.NonFungible,
          mint: nftToSend,
          destination,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);
  await assertNftOwnedBy(t, client, nftToSend, destination);
});

test('it works when the provided NFT is not on an associated token account', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftPayment: some({ requiredCollection, destination }) },
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

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftPayment: some({
          tokenStandard: TokenStandard.NonFungible,
          mint: mint.address,
          destination,
          tokenAccount: token,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
  await assertNftOwnedBy(t, client, mint.address, destination);
});

test('it fails if the payer does not own the right NFT', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const { mint: requiredCollection } = await createCollectionNft(client);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftPayment: some({ requiredCollection, destination }) },
  });

  // An NFT that's not from the required collection.
  const { mint: wrongNft } = await createNft(client, {
    owner: client.payer.address,
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: {
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            mint: wrongNft,
            destination,
          }),
        },
      }),
    ]),
    { message: /InvalidNftCollection/ }
  );
});

test('it fails if the payer tries to provide an NFT from an unverified collection', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const { mint: requiredCollection } = await createCollectionNft(client);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftPayment: some({ requiredCollection, destination }) },
  });

  // An NFT with an unverified reference to the required collection.
  const { mint: unverifiedNftToSend } = await createNft(client, {
    owner: client.payer.address,
    collection: { key: requiredCollection, verified: false },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: {
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            mint: unverifiedNftToSend,
            destination,
          }),
        },
      }),
    ]),
    { message: /InvalidNftCollection/ }
  );
});

test('it charges a bot tax when trying to pay with the wrong NFT', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const { mint: requiredCollection } = await createCollectionNft(client);

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      nftPayment: some({ requiredCollection, destination }),
    },
  });

  // An NFT that's not from the required collection.
  const { mint: wrongNft } = await createNft(client, {
    owner: client.payer.address,
  });

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftPayment: some({
          tokenStandard: TokenStandard.NonFungible,
          mint: wrongNft,
          destination,
        }),
      },
    }),
  ]);

  assertBotTax(t, logs, /InvalidNftCollection/);
});

test('it transfers a Programmable NFT from the payer to the destination', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const collectionAuthority = await generateKeyPairSigner();
  const { mint: requiredCollection } = await createCollectionNft(client, {
    authority: collectionAuthority,
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: { nftPayment: some({ requiredCollection, destination }) },
  });

  const { mint: pnftToSend } = await createVerifiedProgrammableNft(client, {
    tokenOwner: client.payer.address,
    collectionMint: requiredCollection,
    collectionAuthority,
    ruleSet: RULE_SET,
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        nftPayment: some({
          tokenStandard: TokenStandard.ProgrammableNonFungible,
          mint: pnftToSend,
          destination,
          ruleSet: RULE_SET,
        }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);
  await assertNftOwnedBy(t, client, pnftToSend, destination);
});
