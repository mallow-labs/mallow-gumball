import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { some } from '@solana/kit';
import test from 'ava';
import {
  draw,
  getAddTokensInstructionAsync,
  getSettleTokensSaleInstructionAsync,
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

test('it settles a drawn token sale, delivering tokens to the buyer', async (t) => {
  const client = await createClient();

  // Given a machine with one fungible item, drawn by a buyer.
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
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm, sol(10));
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({
      gumballMachine,
      payer: buyer,
      buyer,
      mintArgs: { solPayment: some(true) },
    }),
  ]);

  const drawn = fetchGumballMachine(client.svm, gumballMachine).items.find(
    (i) => i.buyer === buyer.address
  );
  t.truthy(drawn);

  // When we settle the drawn sale.
  const [receiverTokenAccount] = await findAssociatedTokenPda({
    owner: buyer.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await sendTransaction(client.svm, client.payer, [
    COMPUTE_UNITS,
    await getSettleTokensSaleInstructionAsync({
      payer: client.payer,
      gumballMachine,
      authority: client.payer.address,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      receiverTokenAccount,
      index: drawn!.index,
    }),
  ]);

  // Then the item is settled and the buyer received the 100 tokens.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  const settled = account.items.find((i) => i.index === drawn!.index);
  t.is(settled?.isSettled, true);

  const receiver = client.svm.getAccount(receiverTokenAccount);
  t.truthy(receiver && receiver.exists);
});
