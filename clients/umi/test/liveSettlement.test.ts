/* eslint-disable import/no-extraneous-dependencies */
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { defaultPublicKey, sol, some } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addCnft,
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  settleCnftSale,
  settleCoreAssetSale,
  settleNftSale,
  settleTokensSale,
  settleTokensSaleClaimed,
  startSale,
  TokenStandard,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
  settleRemainingAccounts,
} from './_cnftSetup';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createNft,
  createUmi,
} from './_setup';

for (const standard of ['core', 'nft', 'tokens', 'tokens-batch', 'cnft-v1']) {
  test(`R4-01: undrawn ${standard} cannot settle while the sale is live`, async (t) => {
    const umi: any = await createCnftUmi(createUmi as any);
    const caller: any = await createUmi();
    let mint: any;
    let item: any;
    let machine: any;
    if (standard === 'cnft-v1') {
      item = await mintCnft(umi);
      machine = (
        await create(umi, {
          settings: { itemCapacity: 1 },
          guards: { solPayment: { lamports: sol(1) } },
        })
      ).publicKey;
      await addCnft(umi, {
        gumballMachine: machine,
        treeConfig: item.treeConfig,
        merkleTree: item.merkleTree,
        args: cnftArgs(umi, item),
        addItemArgs: {},
      })
        .addRemainingAccounts(proofAccounts(getCnftProof(umi, item).proof))
        .sendAndConfirm(umi);
      item.owner = findGumballMachineAuthorityPda(umi, {
        gumballMachine: machine,
      })[0];
    } else {
      mint =
        standard === 'core'
          ? await createCoreAsset(umi)
          : standard === 'nft'
            ? await createNft(umi)
            : (
                await createMintWithHolders(umi, {
                  decimals: 0,
                  holders: [{ owner: umi.identity, amount: 1 }],
                })
              )[0];
      machine = (
        await create(umi, {
          items: [
            {
              id: mint.publicKey,
              tokenStandard:
                standard === 'core'
                  ? TokenStandard.Core
                  : standard === 'nft'
                    ? TokenStandard.NonFungible
                    : TokenStandard.Fungible,
              amount: 1,
            },
          ],
          guards: { solPayment: { lamports: sol(1) } },
        })
      ).publicKey;
    }
    await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
    const common = {
      gumballMachine: machine,
      index: 0,
      seller: umi.identity.publicKey,
      authority: umi.identity.publicKey,
      buyer: defaultPublicKey(),
    };
    const settle =
      standard === 'core'
        ? settleCoreAssetSale(caller, {
            ...common,
            asset: mint.publicKey,
            creators: [],
          })
        : standard === 'nft'
          ? settleNftSale(caller, {
              ...common,
              mint: mint.publicKey,
              creators: [],
            })
          : standard === 'tokens'
            ? settleTokensSale(caller, {
                ...common,
                mint: mint.publicKey,
                receiverTokenAccount: findAssociatedTokenPda(umi, {
                  mint: mint.publicKey,
                  owner: umi.identity.publicKey,
                })[0],
              })
            : standard === 'tokens-batch'
              ? settleTokensSaleClaimed(caller, {
                  ...common,
                  mint: mint.publicKey,
                  startIndex: 0,
                  endIndex: 0,
                })
              : settleCnftSale(caller, {
                  ...common,
                  treeConfig: item.treeConfig,
                  merkleTree: item.merkleTree,
                  args: cnftArgs(umi, item),
                  currentLeafOwner: item.owner,
                  currentLeafDelegate: item.owner,
                }).addRemainingAccounts(
                  settleRemainingAccounts(
                    item.creators,
                    getCnftProof(umi, item).proof
                  )
                );
    await t.throwsAsync(settle.sendAndConfirm(caller), {
      message: /Error Number: 6036/,
    });
    const unchanged = await fetchGumballMachine(umi, machine);
    t.is(unchanged.itemsSettled, 0n);
    t.is(unchanged.itemsRedeemed, 0n);
    t.false(unchanged.items[0].isClaimed);
    await draw(caller, {
      gumballMachine: machine,
      mintArgs: { solPayment: some(true) },
    }).sendAndConfirm(caller);
    const after = await fetchGumballMachine(umi, machine);
    t.is(after.itemsRedeemed, 1n);
    t.false(after.items[0].isClaimed);
    t.false(after.items[0].isSettled);
  });
}
