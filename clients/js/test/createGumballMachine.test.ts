import { generateKeyPairSigner, some } from '@solana/kit';
import test from 'ava';
import { getCreateGumballMachineInstructionsAsync, GumballState } from '../src';
import {
  createClient,
  defaultGumballSettings,
  fetchGumballMachine,
  sendTransaction,
} from './_setup';

test('it can create a gumball machine using config line settings', async (t) => {
  const client = await createClient();

  // When we create a new gumball machine with config line settings, buy back
  // config, disabled primary split and disabled royalties.
  const gumballMachine = await generateKeyPairSigner();
  const buyBackConfig = {
    enabled: true,
    toGumballMachine: false,
    oracleSigner: client.payer.address,
    valuePct: 70,
    marketplaceFeeBps: 1000,
    cutoffPct: 0,
  };
  const instructions = await getCreateGumballMachineInstructionsAsync(
    {
      gumballMachine,
      authority: client.payer.address,
      payer: client.payer,
      settings: defaultGumballSettings(),
      disablePrimarySplit: true,
      buyBackConfig: some(buyBackConfig),
      disableRoyalties: true,
    },
    { rpc: client.rpc }
  );
  await sendTransaction(client.svm, client.payer, instructions);

  // Then we expect the gumball machine account to have the right data.
  const account = fetchGumballMachine(client.svm, gumballMachine.address);
  t.is(account.version, 5);
  t.is(account.authority, client.payer.address);
  t.is(account.mintAuthority, client.payer.address);
  t.is(account.itemsRedeemed, 0n);
  t.is(account.itemsLoaded, 0);
  t.is(account.state, GumballState.None);
  t.deepEqual(account.items, []);
  t.is(account.disablePrimarySplit, true);
  t.is(account.disableRoyalties, true);
  t.deepEqual(account.buyBackConfig, buyBackConfig);
  t.is(account.buyBackFundsAvailable, 0n);
});

test("it can create a gumball machine that's bigger than 10Kb", async (t) => {
  const client = await createClient();

  // When we create a new gumball machine with a large amount of items.
  const gumballMachine = await generateKeyPairSigner();
  const settings = defaultGumballSettings({ itemCapacity: 20000 });
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

  // Then we expect the gumball machine account to have been created.
  const account = fetchGumballMachine(client.svm, gumballMachine.address);
  t.is(account.itemsRedeemed, 0n);
  t.is(account.settings.itemCapacity, 20000n);
});
