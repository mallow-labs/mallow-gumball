import { generateKeyPairSigner, none, some } from '@solana/kit';
import test from 'ava';
import { create, findGumballGuardPda } from '../src';
import {
  createClient,
  defaultGumballSettings,
  fetchGumballGuard,
  fetchGumballMachine,
  sendTransaction,
  sol,
} from './_setup';

test('it can create a gumball machine with an associated gumball guard', async (t) => {
  const client = await createClient();

  // When we create a new gumball machine with an associated gumball guard.
  const feeAccount = (await generateKeyPairSigner()).address;
  const gumballMachine = await generateKeyPairSigner();
  const instructions = await create(
    {
      gumballMachine,
      authority: client.payer,
      payer: client.payer,
      feeConfig: some({ feeAccount, feeBps: 500 }),
      guards: {
        botTax: some({ lamports: sol(0.01), lastInstruction: true }),
        solPayment: some({ lamports: sol(2) }),
      },
      settings: defaultGumballSettings(),
    },
    { rpc: client.rpc }
  );
  await sendTransaction(client.svm, client.payer, instructions);

  // Then we created a new gumball guard derived from the machine's address.
  const [gumballGuard] = await findGumballGuardPda({
    base: gumballMachine.address,
  });
  const guardAccount = fetchGumballGuard(client.svm, gumballGuard);
  t.is(guardAccount.base, gumballMachine.address);
  t.is(guardAccount.authority, client.payer.address);
  t.deepEqual(
    guardAccount.guards.botTax,
    some({ lamports: sol(0.01), lastInstruction: true })
  );
  t.deepEqual(guardAccount.guards.solPayment, some({ lamports: sol(2) }));
  // A representative unset guard decodes as none().
  t.deepEqual(guardAccount.guards.tokenPayment, none());
  t.deepEqual(guardAccount.groups, []);

  // And the created gumball machine uses the guard as its mint authority.
  const machineAccount = fetchGumballMachine(
    client.svm,
    gumballMachine.address
  );
  t.is(machineAccount.authority, client.payer.address);
  t.is(machineAccount.mintAuthority, gumballGuard);
  t.deepEqual(
    machineAccount.marketplaceFeeConfig,
    some({ feeAccount, feeBps: 500 })
  );
});
