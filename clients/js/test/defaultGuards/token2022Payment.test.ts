import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import { draw } from '../../src';
import {
  COMPUTE_UNITS,
  createClient,
  fetchGumballMachine,
  sendTransaction,
} from '../_setup';
import {
  createLoadedGumballMachine,
  createMintWithHolders,
  fetchTokenAmount,
  TOKEN_2022_PROGRAM_ADDRESS,
} from './_guardsBSetup';

test('it transfers Token2022 tokens from the payer to the destination', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;

  // A Token-2022 mint: destination treasury has 100 tokens, payer has 12.
  const [mint, destinationAta, identityAta] = await createMintWithHolders(
    client,
    {
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      holders: [
        { owner: destination, amount: 100 },
        { owner: client.payer.address, amount: 12 },
      ],
    }
  );

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      token2022Payment: { mint, destinationAta, amount: 5 },
    },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { token2022Payment: some({ mint, destinationAta }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  t.is(fetchTokenAmount(client, destinationAta), 105n);
  t.is(fetchTokenAmount(client, identityAta), 7n);
  t.is(account.totalRevenue, 5n);
});

test('it transfers Token2022 tokens from the payer to the fee account', async (t) => {
  const client = await createClient();
  const destination = (await generateKeyPairSigner()).address;
  const feeAccount = (await generateKeyPairSigner()).address;

  const [mint, destinationAta, identityAta, feeAccountAta] =
    await createMintWithHolders(client, {
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      holders: [
        { owner: destination, amount: 100 },
        { owner: client.payer.address, amount: 12 },
        { owner: feeAccount, amount: 0 },
      ],
    });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    guards: {
      token2022Payment: { mint, destinationAta, amount: 10 },
    },
    feeConfig: { feeAccount, feeBps: 1000 },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: {
        token2022Payment: some({ mint, destinationAta, feeAccount }),
      },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  // 10 tokens split: 1 to the fee account (10%), 9 to the destination.
  t.is(fetchTokenAmount(client, destinationAta), 109n);
  t.is(fetchTokenAmount(client, feeAccountAta), 1n);
  t.is(fetchTokenAmount(client, identityAta), 2n);
  t.is(account.totalRevenue, 10n);
});
