/* eslint-disable import/no-extraneous-dependencies */
import {
  fetchToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  isEqualToAmount,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import { drawJellybean } from '../src';
import { createJellybeanUmi, setupJellybeanMachine } from './_jellybeanSetup';
import { createMintWithHolders, createUmi } from './_setup';

// The gumball guard's `draw_jellybean` routes payment guards through the
// jellybean machine's fee accounts (not a gumball authority PDA). This exercises
// the jellybean branch of the solPayment guard end to end.
test('it distributes the solPayment price to the jellybean fee account on draw', async (t) => {
  const umi = await createJellybeanUmi(createUmi);
  const feeWallet = generateSigner(umi).publicKey;

  const jellybeanMachine = await setupJellybeanMachine(umi, {
    // Single fee account takes 100% of the sale.
    feeAccounts: [{ address: feeWallet, basisPoints: 10000 }],
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  const payer = await generateSignerWithSol(umi, sol(10));
  const buyer = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      drawJellybean(umi, {
        jellybeanMachine,
        payer,
        buyer,
        // For jellybean the solPayment destinations are the machine's fee
        // accounts, supplied explicitly (the guard has no authority PDA to derive).
        mintArgs: { solPayment: some({ feeAccounts: [feeWallet] }) },
      })
    )
    .sendAndConfirm(umi);

  // The fee account received the full 1 SOL price.
  const feeBalance = await umi.rpc.getBalance(feeWallet);
  t.true(
    isEqualToAmount(feeBalance, sol(1), sol(0.001)),
    `fee account balance: ${feeBalance.basisPoints}`
  );

  // And the payer paid it.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(
    isEqualToAmount(payerBalance, sol(9), sol(0.1)),
    'payer paid the price'
  );
});

// Splitting: two fee accounts with a 70/30 split must each receive their share.
test('it splits the solPayment price across multiple jellybean fee accounts', async (t) => {
  const umi = await createJellybeanUmi(createUmi);
  const feeA = generateSigner(umi).publicKey;
  const feeB = generateSigner(umi).publicKey;

  const jellybeanMachine = await setupJellybeanMachine(umi, {
    feeAccounts: [
      { address: feeA, basisPoints: 7000 },
      { address: feeB, basisPoints: 3000 },
    ],
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  const payer = await generateSignerWithSol(umi, sol(10));
  const buyer = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      drawJellybean(umi, {
        jellybeanMachine,
        payer,
        buyer,
        // Order must match the machine's fee_accounts.
        mintArgs: { solPayment: some({ feeAccounts: [feeA, feeB] }) },
      })
    )
    .sendAndConfirm(umi);

  const balanceA = await umi.rpc.getBalance(feeA);
  const balanceB = await umi.rpc.getBalance(feeB);
  t.true(isEqualToAmount(balanceA, sol(0.7), sol(0.001)), 'feeA got 70%');
  t.true(isEqualToAmount(balanceB, sol(0.3), sol(0.001)), 'feeB got 30%');
});

// Hardening: the guard binds each supplied destination to the machine's recorded
// fee account address. A draw that swaps in an attacker wallet must be rejected.
test('it rejects a jellybean draw whose fee account does not match the machine', async (t) => {
  const umi = await createJellybeanUmi(createUmi);
  const feeWallet = generateSigner(umi).publicKey;

  const jellybeanMachine = await setupJellybeanMachine(umi, {
    feeAccounts: [{ address: feeWallet, basisPoints: 10000 }],
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  const payer = await generateSignerWithSol(umi, sol(10));
  const buyer = generateSigner(umi);
  const attacker = generateSigner(umi).publicKey;

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      drawJellybean(umi, {
        jellybeanMachine,
        payer,
        buyer,
        // Substitutes the attacker for the machine's real fee account.
        mintArgs: { solPayment: some({ feeAccounts: [attacker] }) },
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /Invalid fee account address/ });
});

// Hardening: a jellybean machine with no fee accounts has nowhere to route the
// solPayment price, so the guard must refuse rather than silently drop funds.
test('it rejects a solPayment jellybean draw when the machine has no fee accounts', async (t) => {
  const umi = await createJellybeanUmi(createUmi);

  const jellybeanMachine = await setupJellybeanMachine(umi, {
    feeAccounts: [],
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  const payer = await generateSignerWithSol(umi, sol(10));
  const buyer = generateSigner(umi);

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      drawJellybean(umi, {
        jellybeanMachine,
        payer,
        buyer,
        mintArgs: { solPayment: some(true) },
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /MissingFeeAccounts/ });
});

// tokenPayment (SPL Token) has its own jellybean branch: the price is pulled
// from the payer's token account into the fee accounts' associated token
// accounts. Jellybean machines have no payment_mint, so the guard's mint is the
// sole source of truth.
test('it distributes an spl tokenPayment to the jellybean fee account on draw', async (t) => {
  const umi = await createJellybeanUmi(createUmi);
  const feeWallet = generateSigner(umi).publicKey;
  const payer = await generateSignerWithSol(umi, sol(10));

  // Payer holds 1000 tokens; the fee wallet gets an (empty) ATA to receive them.
  const [tokenMint, payerAta, feeAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: payer.publicKey, amount: 1000 },
      { owner: feeWallet, amount: 0 },
    ],
  });

  const jellybeanMachine = await setupJellybeanMachine(umi, {
    feeAccounts: [{ address: feeWallet, basisPoints: 10000 }],
    guards: {
      tokenPayment: some({ mint: tokenMint.publicKey, amount: 5 }),
    },
  });

  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      drawJellybean(umi, {
        jellybeanMachine,
        payer,
        buyer,
        mintArgs: {
          tokenPayment: some({
            mint: tokenMint.publicKey,
            feeAccounts: [feeWallet],
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // The fee account's token account received the 5-token price...
  t.is((await fetchToken(umi, feeAta)).amount, 5n);
  // ...and the payer paid it.
  t.is((await fetchToken(umi, payerAta)).amount, 995n);
});

// Splitting an spl tokenPayment across two fee accounts (70/30).
test('it splits an spl tokenPayment across multiple jellybean fee accounts', async (t) => {
  const umi = await createJellybeanUmi(createUmi);
  const feeA = generateSigner(umi).publicKey;
  const feeB = generateSigner(umi).publicKey;
  const payer = await generateSignerWithSol(umi, sol(10));

  const [tokenMint, payerAta, feeAAta, feeBAta] = await createMintWithHolders(
    umi,
    {
      holders: [
        { owner: payer.publicKey, amount: 1000 },
        { owner: feeA, amount: 0 },
        { owner: feeB, amount: 0 },
      ],
    }
  );

  const jellybeanMachine = await setupJellybeanMachine(umi, {
    feeAccounts: [
      { address: feeA, basisPoints: 7000 },
      { address: feeB, basisPoints: 3000 },
    ],
    guards: {
      tokenPayment: some({ mint: tokenMint.publicKey, amount: 10 }),
    },
  });

  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      drawJellybean(umi, {
        jellybeanMachine,
        payer,
        buyer,
        // Order must match the machine's fee_accounts.
        mintArgs: {
          tokenPayment: some({
            mint: tokenMint.publicKey,
            feeAccounts: [feeA, feeB],
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  t.is((await fetchToken(umi, feeAAta)).amount, 7n);
  t.is((await fetchToken(umi, feeBAta)).amount, 3n);
  t.is((await fetchToken(umi, payerAta)).amount, 990n);
});

// token2022Payment is explicitly gumball-only (`require!(machine_type ==
// Gumball)`). A jellybean draw with it must be rejected, not silently mishandled.
test('it rejects a token2022Payment on a jellybean draw as unsupported', async (t) => {
  const umi = await createJellybeanUmi(createUmi);
  const feeWallet = generateSigner(umi).publicKey;
  const payer = await generateSignerWithSol(umi, sol(10));

  // The guard is rejected before any account is touched, so the mint /
  // destination need not be real token-2022 accounts.
  const token22Mint = generateSigner(umi).publicKey;
  const destinationAta = generateSigner(umi).publicKey;

  const jellybeanMachine = await setupJellybeanMachine(umi, {
    feeAccounts: [{ address: feeWallet, basisPoints: 10000 }],
    guards: {
      token2022Payment: some({
        mint: token22Mint,
        amount: 5,
        destinationAta,
      }),
    },
  });

  const buyer = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      drawJellybean(umi, {
        jellybeanMachine,
        payer,
        buyer,
        mintArgs: {
          token2022Payment: some({ mint: token22Mint, destinationAta }),
        },
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /GuardNotSupported/ });
});
