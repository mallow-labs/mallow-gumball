import { generateKeyPairSigner } from '@solana/kit';
import test from 'ava';
import { getCreateGumballMachineInstructionsAsync, GumballState } from '../src';
import {
  createClient,
  defaultGumballSettings,
  fetchGumballMachine,
  sendTransaction,
} from './_setup';

test('it can initialize a new gumball machine account', async (t) => {
  // Given a client and a fresh machine keypair.
  const client = await createClient();
  const gumballMachine = await generateKeyPairSigner();
  const settings = defaultGumballSettings({
    uri: 'https://arweave.net/abc123',
    itemCapacity: 20,
    itemsPerSeller: 1,
    curatorFeeBps: 500,
    hideSoldItems: false,
  });

  // When we build + send the createAccount + initialize instructions.
  const instructions = await getCreateGumballMachineInstructionsAsync(
    {
      gumballMachine,
      authority: client.payer.address,
      payer: client.payer,
      settings,
    },
    { rpc: client.rpc }
  );
  await sendTransaction(client.svm, client.payer, instructions);

  // Then the account decodes with the right base data + settings.
  const account = fetchGumballMachine(client.svm, gumballMachine.address);
  t.is(account.version, 5);
  t.is(account.authority, client.payer.address);
  // Without a wrapped guard, the machine is its own mint authority.
  t.is(account.mintAuthority, client.payer.address);
  t.is(account.itemsRedeemed, 0n);
  t.is(account.itemsLoaded, 0);
  t.is(account.state, GumballState.None);
  t.is(account.settings.uri, 'https://arweave.net/abc123');
  t.is(account.settings.itemCapacity, 20n);
  t.is(account.settings.itemsPerSeller, 1);
  t.is(account.settings.curatorFeeBps, 500);
  t.is(account.settings.hideSoldItems, false);
  t.is(account.settings.paymentMint, settings.paymentMint);
  t.deepEqual(account.items, []);
});
