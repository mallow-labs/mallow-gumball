import {
  createAssociatedToken,
  createMint,
  createMintWithSingleToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-essentials';
import { findCollectionAuthorityRecordPda } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  isEqualToAmount,
  none,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  mintV2,
} from '../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV1,
  createV2,
  tomorrow,
  yesterday,
} from './_setup';

test('it can mint from a candy guard with no guards', async (t) => {
  // Given a candy machine with a candy guard that has no guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
    groups: [],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint whilst creating the mint and token accounts beforehand', async (t) => {
  // Given a candy machine with a candy guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we create a new mint and token account before minting.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(createMint(umi, { mint }))
    .add(
      createAssociatedToken(umi, {
        mint: mint.publicKey,
        owner: minter.publicKey,
      })
    )
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint whilst creating only the mint account beforehand', async (t) => {
  // Given a candy machine with a candy guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we create a new mint account before minting.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(createMint(umi, { mint }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard attached to a candy machine v1', async (t) => {
  // Given a candy machine v1 with a candy guard that has no guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from it.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(createMintWithSingleToken(umi, { mint, owner: minter.publicKey }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        // We have to explicitly provide the collection authority record
        // because v2 defaults to the new way of deriving delegate records.
        collectionDelegateRecord: findCollectionAuthorityRecordPda(umi, {
          mint: collectionMint,
          collectionAuthority: findCandyMachineAuthorityPda(umi, {
            candyMachine,
          }),
        }),
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard with guards', async (t) => {
  // Given a candy machine with some guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2), destination }),
    },
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        payer,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          solPayment: some({ destination }),
        },
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.1)));

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard with groups', async (t) => {
  // Given a candy machine with guard groups.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2), destination }),
    },
    groups: [
      { label: 'GROUP1', guards: { startDate: some({ date: yesterday() }) } },
      { label: 'GROUP2', guards: { startDate: some({ date: tomorrow() }) } },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from it using GROUP1.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
        group: some('GROUP1'),
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });
});

test('it cannot mint using the default guards if the candy guard has groups', async (t) => {
  // Given a candy machine with guard groups.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: { solPayment: some({ lamports: sol(2), destination }) },
    groups: [
      { label: 'GROUP1', guards: { startDate: some({ date: yesterday() }) } },
      { label: 'GROUP2', guards: { startDate: some({ date: tomorrow() }) } },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint using the default guards.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
        group: none(),
      })
    )
    .sendAndConfirm();

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /RequiredGroupLabelNotFound/ });
});

test('it cannot mint from a group if the provided group label does not exist', async (t) => {
  // Given a candy machine with no guard groups.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: { solPayment: some({ lamports: sol(2), destination }) },
    groups: [
      { label: 'GROUP1', guards: { startDate: some({ date: yesterday() }) } },
    ],
  });

  // When we try to mint using a group that does not exist.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
        group: some('GROUPX'),
      })
    )
    .sendAndConfirm();

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /GroupNotFound/ });
});

test('it can mint using an explicit payer', async (t) => {
  // Given a candy machine with guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: { solPayment: some({ lamports: sol(2), destination }) },
  });

  // And an explicit payer with 10 SOL.
  const payer = await generateSignerWithSol(umi, sol(10));

  // When we mint from it using that payer.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        payer,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.1)));
});

test('it cannot mint from an empty candy machine', async (t) => {
  // Given an empty candy machine.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [],
    guards: {},
  });

  // When we try to mint from it.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /CandyMachineEmpty/ });
});

test('it cannot mint from a candy machine that is not fully loaded', async (t) => {
  // Given a candy machine that is 50% loaded.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    itemsAvailable: 2,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });

  // When we try to mint from it.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /NotFullyLoaded/ });
});

test('it cannot mint from a candy machine that has been fully minted', async (t) => {
  // Given a candy machine that has been fully minted.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });
  const mint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // When we try to mint from it again.
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: generateSigner(umi),
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /CandyMachineEmpty/ });
});

test('it can mint from a candy machine using hidden settings', async (t) => {
  // Given a candy machine with hidden settings.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    itemsAvailable: 100,
    configLineSettings: none(),
    hiddenSettings: some({
      name: 'Degen #$ID+1$',
      uri: 'https://example.com/degen/$ID+1$',
      hash: new Uint8Array(32),
    }),
    guards: {},
  });

  // When we mint from it.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, {
    mint,
    owner: minter,
    name: 'Degen #1',
    uri: 'https://example.com/degen/1',
  });
});

test('it can mint from a candy machine sequentially', async (t) => {
  // Given a candy machine with sequential config line settings.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
      { name: 'Degen #3', uri: 'https://example.com/degen/3' },
    ],
    configLineSettings: some({
      prefixName: '',
      nameLength: 32,
      prefixUri: '',
      uriLength: 200,
      isSequential: true,
    }),
    guards: {},
  });

  // When we mint from it.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful and we got the first item.
  await assertSuccessfulMint(t, umi, {
    mint,
    owner: minter,
    name: 'Degen #1',
    uri: 'https://example.com/degen/1',
  });
});

test('it can mint from a candy machine in a random order', async (t) => {
  // Given a candy machine with non-sequential config line settings.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
      { name: 'Degen #3', uri: 'https://example.com/degen/3' },
    ],
    configLineSettings: some({
      prefixName: '',
      nameLength: 32,
      prefixUri: '',
      uriLength: 200,
      isSequential: false,
    }),
    guards: {},
  });

  // When we mint from it.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful and we got any item.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });
});