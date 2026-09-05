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
  getAddCoreAssetInstructionAsync,
  getApproveAddItemInstructionAsync,
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
  fetchGumballMachine,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

// NOTE: umi additionally asserts the core asset stays frozen/delegated after
// approval. There is no generated kit mpl-core account decoder in this
// workspace, so that plugin-state assertion is omitted for the core-asset case;
// the nft case verifies frozen/delegated state via the SPL token account.

test('it can approve a request to add core asset to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { asset } = await createCoreAsset(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddCoreAssetInstructionAsync({
      gumballMachine,
      seller,
      asset,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getApproveAddItemInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: seller.address,
      asset,
    }),
  ]);

  // The request is closed.
  t.is(await getAddItemRequest(client, asset), null);

  // The item is loaded into the machine.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    isDrawn: false,
    isClaimed: false,
    isSettled: false,
    mint: asset,
    seller: seller.address,
    buyer: undefined,
    tokenStandard: TokenStandard.Core,
    amount: 1,
  });

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    seller.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it can approve a request to add an nft to a gumball machine', async (t) => {
  const client = await createClient();
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { mint } = await createNft(client, seller);

  await sendTransaction(client.svm, seller, [
    await getRequestAddNftInstructionAsync({ gumballMachine, seller, mint }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    await getApproveAddItemInstructionAsync({
      gumballMachine,
      authority: client.payer,
      seller: seller.address,
      asset: mint,
    }),
  ]);

  t.is(await getAddItemRequest(client, mint), null);

  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.itemsLoaded, 1);
  t.like(account.items[0], {
    index: 0,
    mint,
    seller: seller.address,
    tokenStandard: TokenStandard.NonFungible,
    amount: 1,
  });

  // The nft is still frozen/delegated to the gumball machine authority PDA.
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
  t.deepEqual(tokenAccount.delegate, some(authorityPda));

  const sellerHistory = await getSellerHistory(
    client,
    gumballMachine,
    seller.address
  );
  t.is(sellerHistory?.itemCount, 1n);
});

test('it cannot approve a request to add core asset to a gumball machine after the gumball has started', async (t) => {
  const client = await createClient();
  const { asset: initialAsset } = await createCoreAsset(client);
  const { gumballMachine } = await createGumballMachine(client, {
    settings: { itemCapacity: 5 },
  });
  await sendTransaction(client.svm, client.payer, [
    await getAddCoreAssetInstructionAsync({
      gumballMachine,
      seller: client.payer,
      asset: initialAsset,
    }),
  ]);

  const seller = await generateKeyPairSignerWithSol(client.svm);
  const { asset } = await createCoreAsset(client, seller);
  await sendTransaction(client.svm, seller, [
    await getRequestAddCoreAssetInstructionAsync({
      gumballMachine,
      seller,
      asset,
    }),
  ]);

  await sendTransaction(client.svm, client.payer, [
    getStartSaleInstruction({ gumballMachine, authority: client.payer }),
  ]);

  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getApproveAddItemInstructionAsync({
        gumballMachine,
        authority: client.payer,
        seller: seller.address,
        asset,
      }),
    ]),
    { message: /InvalidState/ }
  );
});
