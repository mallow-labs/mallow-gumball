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

test('it allows minting from a specific address only', async (t) => {
  // Given a loaded Gumball Machine with an addressGate guard.
  const client = await createClient();
  const allowedAddress = await generateKeyPairSignerWithSol(
    client.svm,
    sol(10)
  );
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { addressGate: some({ address: allowedAddress.address }) },
  });

  // When the allowed address draws from it.
  await sendTransaction(client.svm, allowedAddress, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: allowedAddress,
      buyer: allowedAddress,
    }),
  ]);

  // Then minting was successful.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(
    account.items.filter((i) => i.buyer === allowedAddress.address).length,
    1
  );
});

test('it forbids minting from anyone else', async (t) => {
  // Given a gumball machine with an addressGate guard.
  const client = await createClient();
  const allowed = await generateKeyPairSigner();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: { addressGate: some({ address: allowed.address }) },
  });

  // When another wallet tries to draw from it, then we expect a program error.
  const unauthorizedMinter = await generateKeyPairSignerWithSol(
    client.svm,
    sol(10)
  );
  await t.throwsAsync(
    sendTransaction(client.svm, unauthorizedMinter, [
      COMPUTE_UNITS,
      await draw({
        gumballMachine,
        payer: unauthorizedMinter,
        buyer: unauthorizedMinter,
      }),
    ]),
    { message: /AddressNotAuthorized/ }
  );
});

test('it charges a bot tax when trying to mint using the wrong address', async (t) => {
  // Given a gumball machine with an addressGate guard and a bot tax.
  const client = await createClient();
  const allowed = await generateKeyPairSigner();
  const { gumballMachine } = await createMachineWithGuards(client, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      addressGate: some({ address: allowed.address }),
    },
  });

  // When another wallet tries to draw from it.
  const unauthorizedMinter = await generateKeyPairSignerWithSol(
    client.svm,
    sol(10)
  );
  const logs = await sendAndGetLogs(client.svm, unauthorizedMinter, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: unauthorizedMinter,
      buyer: unauthorizedMinter,
    }),
  ]);

  // Then we expect a silent bot tax error and no item redeemed.
  t.regex(logs, /Botting is taxed/);
  t.regex(logs, /AddressNotAuthorized/);
  t.is(fetchGumballMachine(client.svm, gumballMachine).itemsRedeemed, 0n);
});
