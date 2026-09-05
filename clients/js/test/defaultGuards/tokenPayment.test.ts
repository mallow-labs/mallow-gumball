import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import { draw, findGumballMachineAuthorityPda } from '../../src';
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
  createMintWithHolders,
  fetchTokenAmount,
  findTokenPda,
  sendForLogs,
} from './_guardsBSetup';

test('it transfers tokens from the payer to the destination', async (t) => {
  const client = await createClient();
  const gumballMachineSigner = await generateKeyPairSigner();
  const [destination] = await findGumballMachineAuthorityPda({
    gumballMachine: gumballMachineSigner.address,
  });

  // A mint where the destination treasury has 100 tokens and the payer has 12.
  const [mint, , identityAta] = await createMintWithHolders(client, {
    holders: [
      { owner: destination, amount: 100 },
      { owner: client.payer.address, amount: 12 },
    ],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    gumballMachine: gumballMachineSigner,
    guards: { tokenPayment: { mint, amount: 5 } },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenPayment: some({ mint }) },
    }),
  ]);

  // The item was bought by the payer.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  // The treasury received 5 tokens and the payer lost 5.
  const [destinationAta] = await findTokenPda({ mint, owner: destination });
  t.is(fetchTokenAmount(client, destinationAta), 105n);
  t.is(fetchTokenAmount(client, identityAta), 7n);
  t.is(account.totalRevenue, 5n);
});

test('it transfers tokens from the payer to the fee account', async (t) => {
  const client = await createClient();
  const gumballMachineSigner = await generateKeyPairSigner();
  const [destination] = await findGumballMachineAuthorityPda({
    gumballMachine: gumballMachineSigner.address,
  });
  const feeAccount = (await generateKeyPairSigner()).address;

  const [mint, , identityAta, feeAccountAta] = await createMintWithHolders(
    client,
    {
      holders: [
        { owner: destination, amount: 100 },
        { owner: client.payer.address, amount: 12 },
        { owner: feeAccount, amount: 0 },
      ],
    }
  );

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    gumballMachine: gumballMachineSigner,
    guards: { tokenPayment: { mint, amount: 10 } },
    feeConfig: { feeAccount, feeBps: 1000 },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenPayment: some({ mint, feeAccounts: [feeAccount] }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === client.payer.address).length, 1);

  // 10 tokens split: 1 to the fee account (10%), 9 to the treasury.
  const [destinationAta] = await findTokenPda({ mint, owner: destination });
  t.is(fetchTokenAmount(client, destinationAta), 109n);
  t.is(fetchTokenAmount(client, feeAccountAta), 1n);
  t.is(fetchTokenAmount(client, identityAta), 2n);
  t.is(account.totalRevenue, 10n);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  const client = await createClient();
  const gumballMachineSigner = await generateKeyPairSigner();
  const [destination] = await findGumballMachineAuthorityPda({
    gumballMachine: gumballMachineSigner.address,
  });
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));

  // The payer (fee payer) holds the tokens; the buyer holds nothing.
  const [mint, , payerAta] = await createMintWithHolders(client, {
    holders: [
      { owner: destination, amount: 100 },
      { owner: client.payer.address, amount: 12 },
    ],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    gumballMachine: gumballMachineSigner,
    guards: { tokenPayment: { mint, amount: 5 } },
  });

  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer,
      mintArgs: { tokenPayment: some({ mint }) },
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.items.filter((i) => i.buyer === buyer.address).length, 1);

  const [destinationAta] = await findTokenPda({ mint, owner: destination });
  t.is(fetchTokenAmount(client, destinationAta), 105n);
  t.is(fetchTokenAmount(client, payerAta), 7n);
});

test('it fails if the payer does not have enough tokens', async (t) => {
  const client = await createClient();
  const gumballMachineSigner = await generateKeyPairSigner();
  const [destination] = await findGumballMachineAuthorityPda({
    gumballMachine: gumballMachineSigner.address,
  });

  const [mint, identityAta] = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 4 },
      { owner: destination, amount: 0 },
    ],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    gumballMachine: gumballMachineSigner,
    guards: { tokenPayment: { mint, amount: 5 } },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { tokenPayment: some({ mint }) },
      }),
    ]),
    { message: /NotEnoughTokens/ }
  );

  t.is(fetchTokenAmount(client, identityAta), 4n);
});

test('it charges a bot tax if the payer does not have enough tokens', async (t) => {
  const client = await createClient();
  const gumballMachineSigner = await generateKeyPairSigner();
  const [destination] = await findGumballMachineAuthorityPda({
    gumballMachine: gumballMachineSigner.address,
  });

  const [mint, identityAta] = await createMintWithHolders(client, {
    holders: [
      { owner: client.payer.address, amount: 4 },
      { owner: destination, amount: 0 },
    ],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    gumballMachine: gumballMachineSigner,
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenPayment: { mint, amount: 5 },
    },
  });

  const logs = await sendForLogs(client, client.payer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: client.payer,
      buyer: client.payer,
      mintArgs: { tokenPayment: some({ mint }) },
    }),
  ]);

  assertBotTax(t, logs, /NotEnoughTokens/);
  t.is(fetchTokenAmount(client, identityAta), 4n);
});

test('it fails if a different mint is provided in draw', async (t) => {
  const client = await createClient();
  const gumballMachineSigner = await generateKeyPairSigner();
  const [destination] = await findGumballMachineAuthorityPda({
    gumballMachine: gumballMachineSigner.address,
  });

  const [mint] = await createMintWithHolders(client, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: client.payer.address, amount: 4 },
    ],
  });
  const [otherMint] = await createMintWithHolders(client, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: client.payer.address, amount: 4 },
    ],
  });

  const { gumballMachine } = await createLoadedGumballMachine(client, {
    gumballMachine: gumballMachineSigner,
    guards: { tokenPayment: { mint, amount: 5 } },
  });

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: client.payer,
        buyer: client.payer,
        mintArgs: { tokenPayment: some({ mint: otherMint }) },
      }),
    ]),
    { message: /Invalid token account mint/ }
  );
});
