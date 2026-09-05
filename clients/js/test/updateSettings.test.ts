import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import { getUpdateSettingsInstruction } from '../src';
import { createMachineNoGuard } from './_lifecycleSetup';
import {
  createClient,
  defaultGumballSettings,
  fetchGumballMachine,
  sendTransaction,
} from './_setup';

test('it can update settings', async (t) => {
  const client = await createClient();

  // Given an existing gumball machine.
  const { gumballMachine } = await createMachineNoGuard(client);

  // When we update its settings.
  const newSettings = defaultGumballSettings({
    uri: 'https://new-example.com',
    itemsPerSeller: 0,
    sellersMerkleRoot: null,
    curatorFeeBps: 100,
    hideSoldItems: true,
    paymentMint: (await generateKeyPairSigner()).address,
  });
  await sendTransaction(client.svm, client.payer, [
    getUpdateSettingsInstruction({
      gumballMachine,
      authority: client.payer,
      settings: newSettings,
    }),
  ]);

  // Then the settings were updated accordingly.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.settings.uri, 'https://new-example.com');
  t.is(account.settings.itemsPerSeller, 0);
  t.is(account.settings.curatorFeeBps, 100);
  t.is(account.settings.hideSoldItems, true);
  t.is(account.settings.paymentMint, newSettings.paymentMint);
});

test('it can update buy back config', async (t) => {
  const client = await createClient();

  // Given an existing gumball machine.
  const { gumballMachine } = await createMachineNoGuard(client);

  // When we update its buy back config.
  const buyBackConfig = {
    enabled: true,
    toGumballMachine: true,
    oracleSigner: (await generateKeyPairSigner()).address,
    valuePct: 50,
    marketplaceFeeBps: 100,
    cutoffPct: 50,
  };
  await sendTransaction(client.svm, client.payer, [
    getUpdateSettingsInstruction({
      gumballMachine,
      authority: client.payer,
      settings: defaultGumballSettings(),
      buyBackConfig: some(buyBackConfig),
    }),
  ]);

  // Then the buy back config was updated accordingly.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.deepEqual(account.buyBackConfig, buyBackConfig);
});
