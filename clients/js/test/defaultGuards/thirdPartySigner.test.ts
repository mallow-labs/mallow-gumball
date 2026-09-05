import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import { draw } from '../../src';
import {
  COMPUTE_UNITS,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from '../_setup';
import {
  createClient,
  createMachineWithGuards,
  sendAndGetLogs,
} from './_guardsASetup';

test('it allows minting when the third party signer is provided', async (t) => {
  // Given a loaded Gumball Machine with a third party signer guard.
  const client = await createClient();
  const thirdPartySigner = await generateKeyPairSigner();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      thirdPartySigner: some({ signerKey: thirdPartySigner.address }),
    },
  });

  // When we draw providing the third party as a Signer.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { thirdPartySigner: some({ signer: thirdPartySigner }) },
    }),
  ]);

  // Then minting was successful.
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 1n);
});

test('it forbids minting when the third party signer is wrong', async (t) => {
  // Given a loaded Gumball Machine with a third party signer guard.
  const client = await createClient();
  const thirdPartySigner = await generateKeyPairSigner();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      thirdPartySigner: some({ signerKey: thirdPartySigner.address }),
    },
  });

  // When we try to draw providing the wrong third party signer, then we expect
  // an error.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const wrongThirdPartySigner = await generateKeyPairSigner();
  await t.throwsAsync(
    sendTransaction(client.svm, buyer, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: buyer,
        buyer,
        mintArgs: {
          thirdPartySigner: some({ signer: wrongThirdPartySigner }),
        },
      }),
    ]),
    { message: /MissingRequiredSignature/ }
  );
});

test('it charges a bot tax when trying to mint using the wrong third party signer', async (t) => {
  // Given a loaded Gumball Machine with a third party signer guard and a bot tax
  // guard.
  const client = await createClient();
  const thirdPartySigner = await generateKeyPairSigner();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      thirdPartySigner: some({ signerKey: thirdPartySigner.address }),
    },
  });

  // When we try to draw providing the wrong third party signer.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const wrongThirdPartySigner = await generateKeyPairSigner();
  const logs = await sendAndGetLogs(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { thirdPartySigner: some({ signer: wrongThirdPartySigner }) },
    }),
  ]);

  // Then we expect a silent bot tax error and no item redeemed.
  t.regex(logs, /Botting is taxed/);
  t.regex(logs, /MissingRequiredSignature/);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 0n);
});
