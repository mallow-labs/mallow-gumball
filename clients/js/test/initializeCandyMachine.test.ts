import { createAccountWithRent } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  GumballSettings,
  GumballState,
  initializeCandyMachine,
} from '../src';
import { createUmi, defaultGumballSettings } from './_setup';

/**
 * Note that most of the tests for the "initializeCandyMachine" instructions are
 * part of the "createCandyMachine" tests as they are more convenient to test.
 */

test('it can initialize a new candy machine account', async (t) => {
  // Given an empty candy machine account with a big enough size.
  const umi = await createUmi();
  const candyMachine = generateSigner(umi);
  await transactionBuilder()
    .add(
      createAccountWithRent(umi, {
        newAccount: candyMachine,
        space: 5000,
        programId: umi.programs.get('mplCandyMachineCore').publicKey,
      })
    )
    .sendAndConfirm(umi);

  const settings: GumballSettings = {
    ...defaultGumballSettings(),
    uri: 'https://arweave.net/abc123',
    itemCapacity: 20n,
    itemsPerSeller: 1,
    sellersMerkleRoot: none(),
    curatorFeeBps: 500,
    hideSoldItems: false,
  };
  // When we initialize a candy machine at this address.
  await transactionBuilder()
    .add(
      initializeCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        settings,
        feeConfig: {
          feeAccount: publicKey(umi.identity),
          feeBps: 500,
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the candy machine account to have the right data.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    publicKey: publicKey(candyMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
    version: 0,
    itemsRedeemed: 0n,
    finalizedItemsCount: 0n,
    state: GumballState.None,
    settings,
  });
});
