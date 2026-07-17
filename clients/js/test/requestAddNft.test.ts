import {
  AccountState,
  decodeToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { some } from '@solana/kit';
import test from 'ava';
import {
  findGumballMachineAuthorityPda,
  getAddNftInstructionAsync,
  getRequestAddCoreAssetInstructionAsync,
  getRequestAddNftInstructionAsync,
  getStartSaleInstruction,
  TokenStandard,
} from '../src';
import {
  createCoreAsset,
  createNft,
  getAddItemRequest,
  getSellerHistory,
} from './_addSetup';
import {
  createClient,
  createGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

test('it can create a request to add nft to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { mint } = await createNft(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddNftInstructionAsync({ gumballMachine, seller, mint }),
  ]);

  const request = await getAddItemRequest(client, mint);
  t.like(request, {
    asset: mint,
    seller: seller.address,
    gumballMachine,
    tokenStandard: TokenStandard.NonFungible,
  });

  // The nft is frozen and delegated to the machine authority PDA.
  const [authorityPda] = await findGumballMachineAuthorityPda({
    gumballMachine,
  });
  const [ata] = await findAssociatedTokenPda({
    owner: seller.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const tokenAccount = decodeToken(client.svm.getAccount(ata) as never).data;
  t.is(tokenAccount.state, AccountState.Frozen);
  t.is(tokenAccount.owner, seller.address);
  t.deepEqual(tokenAccount.delegate, some(authorityPda));

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    seller.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it cannot request to add core asset as the gumball machine authority', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const { asset } = await createCoreAsset(client);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getRequestAddCoreAssetInstructionAsync({
        gumballMachine,
        seller: client.payer,
        asset,
      }),
    ]),
    { message: /SellerCannotBeAuthority/ }
  );
});

test('it cannot request to add nft when limit has been reached', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5, itemsPerSeller: 1 },
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { mint: mint0 } = await createNft(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddNftInstructionAsync({
      gumballMachine,
      seller,
      mint: mint0,
    }),
  ]);

  const { mint: mint1 } = await createNft(client, seller);
  await t.throwsAsync(
    sendTransaction(client.svm, seller, [
      await getRequestAddNftInstructionAsync({
        gumballMachine,
        seller,
        mint: mint1,
      }),
    ]),
    { message: /SellerTooManyItems/ }
  );
});

test('it cannot request to add nft when sale has started', async (t) => {
  const client = await createClient();
  const { mint: initialMint } = await createNft(client);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddNftInstructionAsync({
      gumballMachine,
      seller: client.payer,
      mint: initialMint,
    }),
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { mint } = await createNft(client, seller);

  await t.throwsAsync(
    sendTransaction(client.svm, seller, [
      await getRequestAddNftInstructionAsync({ gumballMachine, seller, mint }),
    ]),
    { message: /InvalidState/ }
  );
});
