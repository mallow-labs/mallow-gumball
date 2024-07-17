/* eslint-disable no-await-in-loop */
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  isEqualToAmount,
  none,
  PublicKey,
  sol,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  addNft,
  CandyMachine,
  draw,
  fetchCandyMachine,
  startSale,
  TokenStandard,
} from '../src';
import {
  assertItemBought,
  create,
  createNft,
  createUmi,
  tomorrow,
  yesterday,
} from './_setup';

test('it can mint from a candy guard with no guards', async (t) => {
  // Given a candy machine with a candy guard that has no guards.
  const umi = await createUmi();

  const candyMachineSigner = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
    groups: [],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        buyer,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { candyMachine, buyer: buyer.publicKey });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard with guards', async (t) => {
  // Given a candy machine with some guards.
  const umi = await createUmi();

  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(2), destination },
    },
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const buyer = generateSigner(umi);
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: { destination },
        },
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { candyMachine, buyer: buyer.publicKey });

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

  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(2), destination },
    },
    groups: [
      { label: 'GROUP1', guards: { startDate: { date: yesterday() } } },
      { label: 'GROUP2', guards: { startDate: { date: tomorrow() } } },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from it using GROUP1.
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        buyer,
        mintArgs: { solPayment: { destination } },
        group: 'GROUP1',
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { candyMachine, buyer: buyer.publicKey });
});

test('it cannot mint using the default guards if the candy guard has groups', async (t) => {
  // Given a candy machine with guard groups.
  const umi = await createUmi();

  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: { solPayment: { lamports: sol(2), destination } },
    groups: [
      { label: 'GROUP1', guards: { startDate: { date: yesterday() } } },
      { label: 'GROUP2', guards: { startDate: { date: tomorrow() } } },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint using the default guards.
  const buyer = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        buyer,
        mintArgs: { solPayment: { destination } },
        group: none(),
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /RequiredGroupLabelNotFound/ });
});

test('it cannot mint from a group if the provided group label does not exist', async (t) => {
  // Given a candy machine with no guard groups.
  const umi = await createUmi();

  const destination = generateSigner(umi).publicKey;
  const { publicKey: candyMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: { solPayment: { lamports: sol(2), destination } },
    groups: [{ label: 'GROUP1', guards: { startDate: { date: yesterday() } } }],
  });

  // When we try to mint using a group that does not exist.
  const buyer = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        buyer,
        mintArgs: { solPayment: { destination } },
        group: 'GROUPX',
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /GroupNotFound/ });
});

test('it can mint using an explicit payer', async (t) => {
  // Given a candy machine with guards.
  const umi = await createUmi();

  const destination = generateSigner(umi).publicKey;
  const { publicKey: candyMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: { solPayment: { lamports: sol(2), destination } },
  });

  // And an explicit payer with 10 SOL.
  const payer = await generateSignerWithSol(umi, sol(10));

  // When we mint from it using that payer.
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        buyer,
        payer,
        mintArgs: { solPayment: { destination } },
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { candyMachine, buyer: buyer.publicKey });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.1)));
});

test('it cannot mint from a candy machine not in sale started state', async (t) => {
  // Given an empty candy machine.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    guards: {},
  });

  // When we try to mint from it.
  const buyer = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        buyer,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InvalidState/ });
});

test('it cannot mint from a candy machine that has been fully minted', async (t) => {
  // Given a candy machine that has been fully minted.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
  });

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        buyer: umi.identity,
        candyMachine,
      })
    )
    .sendAndConfirm(umi);
  await assertItemBought(t, umi, { candyMachine });

  // When we try to mint from it again.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InvalidState/ });
});

test('it can mint from a candy machine in a random order', async (t) => {
  // Given a candy machine with non-sequential config line settings.
  const umi = await createUmi();

  const indices = Array.from({ length: 5 }, (x, i) => i);
  const items = (await Promise.all(indices.map(() => createNft(umi)))).map(
    (item) => ({ id: item.publicKey, tokenStandard: TokenStandard.NonFungible })
  );

  const { publicKey: candyMachine } = await create(umi, {
    guards: {},
  });

  await Promise.all(
    items.map((item) =>
      transactionBuilder()
        .add(
          addNft(umi, {
            candyMachine,
            mint: item.id,
          })
        )
        .sendAndConfirm(umi)
    )
  );

  await transactionBuilder()
    .add(
      startSale(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from it.
  const minted = await drain(umi, candyMachine, indices.length);

  // Then the mints are not sequential.
  t.notDeepEqual(indices, minted);

  // And the mints are unique.
  minted.sort((a, b) => a - b);
  t.deepEqual(indices, minted);
});

const drain = async (umi: Umi, candyMachine: PublicKey, available: number) => {
  const indices: number[] = [];

  for (let i = 0; i < available; i += 1) {
    const buyer = generateSigner(umi);
    await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 600_000 }))
      .add(
        draw(umi, {
          candyMachine,
          buyer,
        })
      )
      .sendAndConfirm(umi);

    const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
    const buyerItem = candyMachineAccount.items.find(
      (item) => item.buyer === buyer.publicKey
    );
    indices.push(buyerItem?.index ?? -1);
  }

  return indices;
};