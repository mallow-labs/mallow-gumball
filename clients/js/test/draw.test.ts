import { some } from '@solana/kit';
import test from 'ava';
import {
  draw,
  findGumballMachineAuthorityPda,
  getAddTokensInstructionAsync,
  getStartSaleInstruction,
} from '../src';
import {
  COMPUTE_UNITS,
  createClient,
  createFungibleMint,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
  sol,
} from './_setup';

test('it draws a loaded token item through a solPayment guard', async (t) => {
  const client = await createClient();

  // Given a machine + solPayment guard with a single fungible item loaded.
  const { mint } = await createFungibleMint(client, { amount: 100 });
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: { solPayment: some({ lamports: sol(1) }) },
  });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
  ]);

  // Sanity: the item is loaded but undrawn.
  let account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.is(account.items[0].isDrawn, false);
  t.is(account.items[0].buyer, undefined);

  await sendTransaction(client.svm, client.payer, [
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  // When a funded buyer draws through the solPayment guard.
  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  const drawIx = await draw({
    gumballMachine,
    payer: buyer,
    buyer,
    mintArgs: { solPayment: some(true) },
  });
  await sendTransaction(client.svm, buyer, [COMPUTE_UNITS, drawIx]);

  // Then the item is drawn and assigned to the buyer.
  account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  const drawn = account.items.filter((i) => i.buyer === buyer.address);
  t.is(drawn.length, 1);
  t.is(drawn[0].isDrawn, true);

  // And the treasury (authority PDA) received the solPayment.
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const treasury = client.svm.getBalance(authorityPda) ?? 0n;
  t.true(treasury >= sol(1), 'treasury received at least 1 SOL');

  // And total revenue is incremented.
  t.true(BigInt(account.totalRevenue) === BigInt(sol(1)));
});
