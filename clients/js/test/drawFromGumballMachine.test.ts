import test from 'ava';
import {
  getAddTokensInstructionAsync,
  getDrawFromGumballMachineInstructionAsync,
  getStartSaleInstruction,
} from '../src';
import { createMachineNoGuard } from './_lifecycleSetup';
import {
  COMPUTE_UNITS,
  createClient,
  createFungibleMint,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

// The umi test loads NFT items; here we load fungible token items instead (the
// kit test harness has no NFT scaffolding). The behaviour under test —
// drawing directly as the machine's mint authority — is identical.

test('it can mint directly from a gumball machine as the mint authority', async (t) => {
  const client = await createClient();

  // Given a loaded gumball machine (no guard → machine is its own mint authority).
  const { gumballMachine } = await createMachineNoGuard(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createFungibleMint(client, { amount: 10 });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity: 2,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  // When we mint directly from the gumball machine as the mint authority.
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getDrawFromGumballMachineInstructionAsync({
      gumballMachine,
      mintAuthority: client.payer,
      payer: client.payer,
      buyer: client.payer.address,
    }),
  ]);

  // Then the mint was successful and the gumball machine was updated.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  const bought = account.items.filter((i) => i.buyer === client.payer.address);
  t.is(bought.length, 1);
});

test('it cannot mint directly from a gumball machine if we are not the mint authority', async (t) => {
  const client = await createClient();

  // Given a loaded gumball machine with a mint authority A (the payer).
  const { gumballMachine } = await createMachineNoGuard(client, {
    settings: { itemCapacity: 5 },
  });
  const { mint } = await createFungibleMint(client, { amount: 10 });
  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 1,
      quantity: 2,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  // When we try to mint directly as mint authority B.
  const mintAuthorityB = await generateKeyPairSignerWithSol(client.svm);
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await getDrawFromGumballMachineInstructionAsync({
        gumballMachine,
        mintAuthority: mintAuthorityB,
        payer: client.payer,
        buyer: client.payer.address,
      }),
    ]),
    { message: /has one constraint|has_one|ConstraintHasOne/ }
  );

  // And the gumball machine stayed the same.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 0n);
});
