import {
  AccountState,
  fetchToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import type { Address } from '@solana/kit';
import test from 'ava';
import {
  draw,
  getAddNftInstructionAsync,
  getClaimNftInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
} from '../src';
import { createNft, createProgrammableNft } from './_removeClaimSetup';
import {
  COMPUTE_UNITS,
  createClient,
  createGumballMachine,
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

const MPL_TOKEN_AUTH_RULES_PROGRAM_ID =
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address;

const tokenAccountOf = async (mint: string, owner: string) => {
  const [ata] = await findAssociatedTokenPda({
    mint: mint as any,
    owner: owner as any,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata;
};

test('it can claim an nft item', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const { mint } = await createNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimNftInstructionAsync({
      payer: buyer,
      gumballMachine,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 0,
    }),
  ]);

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
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });

  const token = await fetchToken(
    client.rpc,
    await tokenAccountOf(mint, buyer.address)
  );
  t.is(token.data.state, AccountState.Initialized);
  t.is(token.data.owner, buyer.address);
  t.is(token.data.delegate.__option, 'None');
  t.is(token.data.amount, 1n);
});

test('it can claim a pnft item', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const { mint } = await createProgrammableNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
      authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await getClaimNftInstructionAsync({
      payer: buyer,
      gumballMachine,
      seller: client.payer.address,
      buyer: buyer.address,
      mint,
      index: 0,
      authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    }),
  ]);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsRedeemed, 1n);
  t.like(account.items[0], {
    index: 0,
    isDrawn: true,
    isClaimed: true,
    isSettled: false,
    mint,
    seller: client.payer.address,
    buyer: buyer.address,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    amount: 1,
  });

  const token = await fetchToken(
    client.rpc,
    await tokenAccountOf(mint, buyer.address)
  );
  t.is(token.data.state, AccountState.Frozen);
  t.is(token.data.owner, buyer.address);
  t.is(token.data.amount, 1n);
});

test('it cannot claim an nft item as another buyer', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
    guards: {},
  });
  const { mint } = await createNft(client);

  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const buyer = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, buyer, [
    COMPUTE_UNITS,
    await draw({ gumballMachine, payer: buyer, buyer }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      COMPUTE_UNITS,
      await getClaimNftInstructionAsync({
        payer: client.payer,
        gumballMachine,
        seller: client.payer.address,
        buyer: client.payer.address,
        mint,
        index: 0,
      }),
    ]),
    { message: /InvalidBuyer/ }
  );
});
