import {
  fetchToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import test from 'ava';
import {
  draw,
  getAddTokensInstructionAsync,
  getClaimTokensInstructionAsync,
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
} from './_setup';

test('it can claim a tokens item', async (t) => {
  // Given a machine with a no-guard gumball guard and a single token item.
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const { mint } = await createFungibleMint(client, { amount: 100 });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  // When a buyer draws the item.
  const buyer = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Then claim it as the buyer.
  await sendTransaction(client.svm, buyer, [
    await getClaimTokensInstructionAsync({
      payer: buyer,
      gumballMachine,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 0,
    }),
  ]);

  // And the machine reflects the claim.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.is(account.itemsSettled, 0n);
  t.like(account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint,
    seller: client.payer.address,
    buyer: buyer.address,
    amount: 100,
  });

  // And the buyer received the tokens.
  const [buyerAta] = await findAssociatedTokenPda({
    owner: buyer.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const token = await fetchToken(client.rpc, buyerAta);
  t.is(token.data.amount, 100n);
});

test('it cannot claim a tokens item as another buyer', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const { mint } = await createFungibleMint(client, { amount: 100 });

  await sendTransaction(client.svm, client.payer, [
    await getAddTokensInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      amount: 100,
      quantity: 1,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  // Claiming as someone other than the drawn buyer fails.
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getClaimTokensInstructionAsync({
        payer: client.payer,
        gumballMachine,
        authority: client.payer.address,
        seller: client.payer.address,
        buyer: client.payer.address,
        mint,
        index: 0,
      }),
    ]),
    { message: /InvalidBuyer/ }
  );
});
