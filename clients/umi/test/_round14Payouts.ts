/* eslint-disable no-await-in-loop */
import { ruleSet } from '@metaplex-foundation/mpl-core';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { generateSigner, publicKey, some } from '@metaplex-foundation/umi';
import {
  addCnftV2,
  approveAddItem,
  claimCoreAsset,
  closeGumballMachine,
  draw,
  fetchGumballMachine,
  findGumballGuardPda,
  findGumballMachineAuthorityPda,
  getMerkleRoot,
  removeCnftV2,
  requestAddCoreAsset,
  settleCoreAssetSale,
  startSale,
  TokenStandard,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
} from './_cnftV2Setup';
import { disableMemo, reassignTokenOwner, requireMemo } from './_round13Token';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createUmi,
} from './_setup';

const classic = publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const token2022 = publicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const setup = async (use2022: boolean, kind = 'curator') => {
  const authority = await createCnftUmi(createUmi);
  const seller = kind === 'solo' ? authority : await createUmi();
  const buyer = await createUmi();
  const caller = await createUmi();
  const feeWallet = await createUmi();
  const creator = await createUmi();
  const machineSigner = generateSigner(authority);
  const machine = machineSigner.publicKey;
  const escrow = findGumballMachineAuthorityPda(authority, {
    gumballMachine: machine,
  })[0];
  const programs = authority.programs.clone();
  if (use2022) programs.bind('splToken', 'splToken2022');
  const tokenUmi = { ...authority, programs };
  const tokenProgram = use2022 ? token2022 : classic;
  const price = kind === 'solo' ? 21 : 10000;
  const [mint, vault, _buyerAta, authorityAta, feeAta, _creatorAta] =
    await createMintWithHolders(tokenUmi, {
      decimals: 0,
      holders: [
        { owner: escrow, amount: 0 },
        { owner: buyer.identity.publicKey, amount: price * 2 },
        { owner: authority.identity.publicKey, amount: 0 },
        { owner: feeWallet.identity.publicKey, amount: 0 },
        { owner: creator.identity.publicKey, amount: 0 },
      ],
    });
  const otherCreator = await createUmi();
  const assets = [];
  for (let i = 0; i < 2; i += 1) {
    assets.push(
      await createCoreAsset(seller, {
        plugins: [
          {
            type: 'Royalties',
            basisPoints: kind === 'solo' ? 10000 : 500,
            creators:
              kind === 'solo'
                ? [
                    { address: creator.identity.publicKey, percentage: 33 },
                    {
                      address: otherCreator.identity.publicKey,
                      percentage: 67,
                    },
                  ]
                : [{ address: creator.identity.publicKey, percentage: 100 }],
            ruleSet: ruleSet('None'),
          },
        ],
      })
    );
  }
  await create(authority, {
    gumballMachine: machineSigner,
    settings: {
      itemCapacity: 3,
      paymentMint: mint.publicKey,
      curatorFeeBps: kind === 'solo' ? 1000 : 500,
      sellersMerkleRoot:
        seller === authority
          ? null
          : some(getMerkleRoot([seller.identity.publicKey])),
    },
    feeConfig: ['fee', 'multiple'].includes(kind)
      ? { feeAccount: feeWallet.identity.publicKey, feeBps: 500 }
      : null,
    disablePrimarySplit: kind !== 'solo',
    items:
      seller === authority
        ? assets.map((asset) => ({
            id: asset.publicKey,
            tokenStandard: TokenStandard.Core,
          }))
        : [],
    guards: use2022
      ? {
          token2022Payment: {
            mint: mint.publicKey,
            destinationAta: vault,
            amount: price,
          },
        }
      : { tokenPayment: { mint: mint.publicKey, amount: price } },
  });
  // Enter the real v6 layout through a temporary v2 leaf before the sale.
  const leaf = await mintCnft(authority, {
    sellerFeeBasisPoints: 0,
    creators: [],
  });
  await addCnftV2(authority, {
    gumballMachine: machine,
    treeConfig: leaf.treeConfig,
    merkleTree: leaf.merkleTree,
    leafDelegate: leaf.owner,
    addItemArgs: {},
    args: cnftArgs(authority, leaf),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(authority, leaf).proof))
    .sendAndConfirm(authority);
  leaf.owner = escrow;
  const leafIndex = (
    await fetchGumballMachine(authority, machine)
  ).items.findIndex((item) => item.mint === leaf.assetId);
  await removeCnftV2(authority, {
    gumballMachine: machine,
    index: leafIndex,
    seller: authority.identity.publicKey,
    treeConfig: leaf.treeConfig,
    merkleTree: leaf.merkleTree,
    args: cnftArgs(authority, leaf),
  })
    .addRemainingAccounts(proofAccounts(getCnftProof(authority, leaf).proof))
    .sendAndConfirm(authority);
  if (seller !== authority) {
    for (const asset of assets) {
      await requestAddCoreAsset(seller, {
        gumballMachine: machine,
        asset: asset.publicKey,
      }).sendAndConfirm(seller);
      await approveAddItem(authority, {
        gumballMachine: machine,
        seller: seller.identity.publicKey,
        asset: asset.publicKey,
      }).sendAndConfirm(authority);
    }
  }
  await startSale(authority, { gumballMachine: machine }).sendAndConfirm(
    authority
  );
  for (let i = 0; i < 2; i += 1) {
    await draw(buyer, {
      gumballMachine: machine,
      mintArgs: use2022
        ? {
            token2022Payment: {
              mint: mint.publicKey,
              destinationAta: vault,
              feeAccounts: ['fee', 'multiple'].includes(kind)
                ? [feeWallet.identity.publicKey]
                : [],
              feeAccount: ['fee', 'multiple'].includes(kind)
                ? feeWallet.identity.publicKey
                : undefined,
            },
          }
        : {
            tokenPayment: {
              mint: mint.publicKey,
              feeAccounts: ['fee', 'multiple'].includes(kind)
                ? [feeWallet.identity.publicKey]
                : [],
              feeAccount: ['fee', 'multiple'].includes(kind)
                ? feeWallet.identity.publicKey
                : undefined,
            },
          },
    }).sendAndConfirm(buyer);
  }
  const gm = await fetchGumballMachine(authority, machine);
  for (let i = 0; i < 2; i += 1) {
    await claimCoreAsset(buyer, {
      gumballMachine: machine,
      index: i,
      seller: seller.identity.publicKey,
      asset: gm.items[i].mint,
    }).sendAndConfirm(buyer);
  }
  const settle = (index: number, payer = seller) =>
    settleCoreAssetSale(payer, {
      gumballMachine: machine,
      index,
      seller: seller.identity.publicKey,
      authority: authority.identity.publicKey,
      buyer: buyer.identity.publicKey,
      asset: gm.items[index].mint,
      creators:
        kind === 'solo'
          ? [creator.identity.publicKey, otherCreator.identity.publicKey]
          : [creator.identity.publicKey],
      paymentMint: mint.publicKey,
      paymentTokenProgram: tokenProgram,
      authorityPdaPaymentAccount: vault,
      authorityPaymentAccount: authorityAta,
      sellerPaymentAccount: findAssociatedTokenPda(payer, {
        mint: mint.publicKey,
        owner: seller.identity.publicKey,
        tokenProgramId: tokenProgram,
      })[0],
      feeAccount: ['fee', 'multiple'].includes(kind)
        ? feeWallet.identity.publicKey
        : undefined,
      feePaymentAccount: ['fee', 'multiple'].includes(kind)
        ? feeAta
        : undefined,
    });
  const close = () =>
    closeGumballMachine(authority, {
      machine,
      gumballGuard: findGumballGuardPda(authority, { base: machine })[0],
      authorityPdaPaymentAccount: vault,
      paymentMint: mint.publicKey,
      paymentTokenProgram: tokenProgram,
    }).sendAndConfirm(authority);
  const blockedWallet = ['fee', 'multiple'].includes(kind)
    ? feeWallet
    : authority;
  const blockedAta = ['fee', 'multiple'].includes(kind) ? feeAta : authorityAta;
  const blockOne = () =>
    use2022
      ? requireMemo(blockedWallet, blockedAta)
      : reassignTokenOwner(blockedWallet, blockedAta, buyer.identity.publicKey);
  const restoreOne = () =>
    use2022
      ? disableMemo(blockedWallet, blockedAta)
      : reassignTokenOwner(buyer, blockedAta, blockedWallet.identity.publicKey);
  const block = async () => {
    await blockOne();
    if (kind === 'multiple') {
      if (use2022) await requireMemo(authority, authorityAta);
      else
        await reassignTokenOwner(
          authority,
          authorityAta,
          buyer.identity.publicKey
        );
    }
  };
  const restore = async () => {
    await restoreOne();
    if (kind === 'multiple') {
      if (use2022) await disableMemo(authority, authorityAta);
      else
        await reassignTokenOwner(
          buyer,
          authorityAta,
          authority.identity.publicKey
        );
    }
  };
  return {
    authority,
    seller,
    buyer,
    caller,
    mint,
    vault,
    escrow,
    machine,
    machineSigner,
    authorityAta,
    blockedAta,
    tokenProgram,
    tokenUmi,
    settle,
    close,
    block,
    restore,
  };
};
