import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  closeGumballMachine,
  closeMintLimit,
  deleteGumballGuard,
  draw,
  fetchMintCounter,
  findGumballGuardPda,
  findMintCounterPda,
  settleNftSale,
  TokenStandard,
} from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createNft,
  createUmi,
  getTestAuthority,
  setupGlobalConfig,
} from '../_setup';

test('it allows minting when the mint limit is not reached', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 5.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the mint limit PDA was incremented.
  const counterPda = findMintCounterPda(umi, {
    id: 1,
    user: umi.identity.publicKey,
    machine: gumballMachine,
    gumballGuard: findGumballGuardPda(umi, { base: gumballMachine })[0],
  });
  const counterAccount = await fetchMintCounter(umi, counterPda);
  t.is(counterAccount.count, 1);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 5.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  // When we mint from it using a separate buyer.
  const buyer = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer,

        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyer) });

  // And the mint limit PDA was incremented for that buyer.
  const counterPda = findMintCounterPda(umi, {
    id: 1,
    user: buyer.publicKey,
    machine: gumballMachine,
    gumballGuard: findGumballGuardPda(umi, { base: gumballMachine })[0],
  });
  const counterAccount = await fetchMintCounter(umi, counterPda);
  t.is(counterAccount.count, 1);
});

test('it forbids minting when the mint limit is reached', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And the identity already minted their NFT.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // When that same identity tries to mint from the same Gumball Machine again.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /AllowedMintLimitReached/ });
});

test('the mint limit is local to each wallet', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And buyer A already minted their NFT.
  const buyerA = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer: buyerA,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyerA) });

  // When buyer B mints from the same Gumball Machine.
  const buyerB = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer: buyerB,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful as the limit is per wallet.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyerB) });
});

test('it charges a bot tax when trying to mint after the limit', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1 and a bot tax guard.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And the identity already minted their NFT.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // When the identity tries to mint from the same Gumball Machine again.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, signature, /AllowedMintLimitReached/);
});

// ---------------------------------------------------------------------------
// close_mint_limit tests
// ---------------------------------------------------------------------------

test('it can close a mint counter after guard is deleted', async (t) => {
  // Given a gumball machine with a mint limit guard.
  // Use 1 item so drawing it auto-transitions to SaleEnded.
  const umi = await createUmi();
  const nft = await createNft(umi);
  const { publicKey: gumballMachine } = await create(umi, {
    items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
    startSale: true,
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  // When a buyer draws from it (creating a MintCounter PDA).
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];
  const mintCounterPda = findMintCounterPda(umi, {
    id: 1,
    user: buyer.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });

  // Confirm the MintCounter PDA exists.
  t.true(await umi.rpc.accountExists(mintCounterPda[0]));

  // Settle the single drawn item so the guard can be deleted.
  const payer = await generateSignerWithSol(umi, sol(10));
  await settleNftSale(umi, {
    payer,
    index: 0,
    gumballMachine,
    buyer: buyer.publicKey,
    seller: umi.identity.publicKey,
    mint: nft.publicKey,
    creators: [umi.identity.publicKey],
  })
    .prepend(setComputeUnitLimit(umi, { units: 600_000 }))
    .sendAndConfirm(umi);

  // Delete the guard so mint counters can be closed.
  await deleteGumballGuard(umi, {
    gumballGuard,
    machine: gumballMachine,
  }).sendAndConfirm(umi);

  // Set up (or idempotently re-set) the GlobalConfig authority and close the mint counter.
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  await transactionBuilder()
    .add(
      closeMintLimit(umi, {
        authority,
        gumballGuard,
        mintCounter: mintCounterPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then the MintCounter PDA no longer exists.
  t.false(await umi.rpc.accountExists(mintCounterPda[0]));
});

test('it fails to close a mint counter when guard still exists', async (t) => {
  // Given a gumball machine with a mint limit guard where the guard has not been deleted.
  const umi = await createUmi();
  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  // When a buyer draws (creating a MintCounter PDA).
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];
  const mintCounterPda = findMintCounterPda(umi, {
    id: 1,
    user: buyer.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  // When we try to close the mint counter without deleting the guard first.
  const promise = transactionBuilder()
    .add(
      closeMintLimit(umi, {
        authority,
        gumballGuard,
        mintCounter: mintCounterPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error because the guard still exists.
  await t.throwsAsync(promise, { message: /InvalidMachineState/ });
});

test('it fails to close a mint counter when signed by a non-authority', async (t) => {
  // Given a gumball machine with a mint limit guard where the guard has been deleted.
  // Use 1 item so drawing it auto-transitions to SaleEnded.
  const umi = await createUmi();
  const nft = await createNft(umi);
  const { publicKey: gumballMachine } = await create(umi, {
    items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
    startSale: true,
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];
  const mintCounterPda = findMintCounterPda(umi, {
    id: 1,
    user: buyer.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });

  // Settle the single drawn item so the guard can be deleted.
  const payer = await generateSignerWithSol(umi, sol(10));
  await settleNftSale(umi, {
    payer,
    index: 0,
    gumballMachine,
    buyer: buyer.publicKey,
    seller: umi.identity.publicKey,
    mint: nft.publicKey,
    creators: [umi.identity.publicKey],
  })
    .prepend(setComputeUnitLimit(umi, { units: 600_000 }))
    .sendAndConfirm(umi);

  // Delete the guard so the guard-existence check passes.
  await deleteGumballGuard(umi, {
    gumballGuard,
    machine: gumballMachine,
  }).sendAndConfirm(umi);

  // Ensure GlobalConfig is set to the test authority.
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  // When a random wallet tries to close the mint counter.
  const randomSigner = generateSigner(umi);
  const promise = transactionBuilder()
    .add(
      closeMintLimit(umi, {
        authority: randomSigner,
        gumballGuard,
        mintCounter: mintCounterPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a constraint/signature error.
  await t.throwsAsync(promise, { message: /MissingRequiredSignature/ });
});

test('it can close a mint counter after machine is fully closed', async (t) => {
  // Given a gumball machine + guard with mint limit.
  // Use 1 item so drawing it auto-transitions to SaleEnded and index 0 is deterministic.
  const umi = await createUmi();
  const nft = await createNft(umi);
  const { publicKey: gumballMachine } = await create(umi, {
    items: [{ id: nft.publicKey, tokenStandard: TokenStandard.NonFungible }],
    startSale: true,
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  const buyer = generateSigner(umi);
  // Drawing the last item auto-transitions the machine to SaleEnded.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];

  const mintCounterPda = findMintCounterPda(umi, {
    id: 1,
    user: buyer.publicKey,
    machine: gumballMachine,
    gumballGuard,
  });

  // Settle the single drawn item (index 0 is always correct with 1 item).
  const payer = await generateSignerWithSol(umi, sol(10));
  await settleNftSale(umi, {
    payer,
    index: 0,
    gumballMachine,
    buyer: buyer.publicKey,
    seller: umi.identity.publicKey,
    mint: nft.publicKey,
    creators: [umi.identity.publicKey],
  })
    .prepend(setComputeUnitLimit(umi, { units: 600_000 }))
    .sendAndConfirm(umi);

  await transactionBuilder()
    .add(closeGumballMachine(umi, { machine: gumballMachine, gumballGuard }))
    .sendAndConfirm(umi);

  // Confirm the machine is closed.
  t.false(await umi.rpc.accountExists(gumballMachine));

  // When we close the mint counter (guard and machine accounts are gone).
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  await transactionBuilder()
    .add(
      closeMintLimit(umi, {
        authority,
        gumballGuard,
        mintCounter: mintCounterPda[0],
      })
    )
    .sendAndConfirm(umi);

  // Then the MintCounter PDA no longer exists.
  t.false(await umi.rpc.accountExists(mintCounterPda[0]));
});
