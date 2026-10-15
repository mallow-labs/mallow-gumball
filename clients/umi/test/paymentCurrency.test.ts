import {
  createAssociatedToken,
  findAssociatedTokenPda,
} from '@metaplex-foundation/mpl-toolbox';
import { publicKey, sol } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addCnft,
  addCnftV2,
  claimCnft,
  claimCnftV2,
  claimCoreAsset,
  claimNft,
  claimTokens,
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  getDefaultBuyBackConfig,
  manageBuyBackFunds,
  settleCnftSale,
  settleCnftSaleV2,
  settleCoreAssetSale,
  settleNftSale,
  settleTokensSale,
  settleTokensSaleClaimed,
  startSale,
  TokenStandard,
  updateSettings,
} from '../src';
import * as v1 from './_cnftSetup';
import * as v2 from './_cnftV2Setup';
import {
  create,
  createCoreAsset,
  createMintWithHolders,
  createNft,
  createUmi,
} from './_setup';

for (const standard of [
  'core',
  'nft',
  'tokens',
  'tokens-batch',
  'cnft-v1',
  'cnft-v2',
]) {
  for (const claimed of standard === 'tokens-batch' ? [true] : [false, true]) {
    test(`R11-01: ${standard} rejects a mismatched payment mint; claimed=${claimed}`, async (t) => {
      const cnft = standard === 'cnft-v2' ? v2 : v1;
      const seller: any = await cnft.createCnftUmi(createUmi);
      const buyer: any = await cnft.createCnftUmi(createUmi);
      const caller: any = await cnft.createCnftUmi(createUmi);
      const [otherMint] = await createMintWithHolders(seller, { holders: [] });
      let mint: any;
      let item: any;
      let machine: any;
      const price = 1_000_000_000n;
      if (standard.startsWith('cnft')) {
        item = await cnft.mintCnft(seller, {
          creators: [],
          sellerFeeBasisPoints: 0,
        });
        machine = (
          await create(seller, { guards: { solPayment: { lamports: sol(1) } } })
        ).publicKey;
        await (standard === 'cnft-v2' ? addCnftV2 : addCnft)(seller, {
          gumballMachine: machine,
          treeConfig: item.treeConfig,
          merkleTree: item.merkleTree,
          leafDelegate: item.owner,
          addItemArgs: {},
          args: cnft.cnftArgs(seller, item),
        } as any)
          .addRemainingAccounts(
            cnft.proofAccounts(cnft.getCnftProof(seller, item).proof)
          )
          .sendAndConfirm(seller);
        item.owner = findGumballMachineAuthorityPda(seller, {
          gumballMachine: machine,
        })[0];
      } else {
        mint =
          standard === 'core'
            ? await createCoreAsset(seller)
            : standard === 'nft'
              ? await createNft(seller)
              : (
                  await createMintWithHolders(seller, {
                    decimals: 0,
                    holders: [{ owner: seller.identity, amount: 1 }],
                  })
                )[0];
        machine = (
          await create(seller, {
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
      await startSale(seller, { gumballMachine: machine }).sendAndConfirm(
        seller
      );
      await draw(buyer, {
        gumballMachine: machine,
        mintArgs: { solPayment: true },
      }).sendAndConfirm(buyer);
      const common = {
        gumballMachine: machine,
        index: 0,
        seller: seller.identity.publicKey,
        buyer: buyer.identity.publicKey,
      };
      if (claimed) {
        const claim =
          standard === 'core'
            ? claimCoreAsset(buyer, { ...common, asset: mint.publicKey })
            : standard === 'nft'
              ? claimNft(buyer, { ...common, mint: mint.publicKey })
              : standard.startsWith('tokens')
                ? claimTokens(buyer, {
                    ...common,
                    authority: seller.identity.publicKey,
                    mint: mint.publicKey,
                  })
                : (standard === 'cnft-v2' ? claimCnftV2 : claimCnft)(buyer, {
                    ...common,
                    treeConfig: item.treeConfig,
                    merkleTree: item.merkleTree,
                    args: cnft.cnftArgs(buyer, item),
                  } as any).addRemainingAccounts(
                    cnft.proofAccounts(cnft.getCnftProof(buyer, item).proof)
                  );
        await claim.sendAndConfirm(buyer);
        if (item) item.owner = buyer.identity.publicKey;
      }
      const settle = (paymentMint?: any) => {
        const args = {
          ...common,
          authority: seller.identity.publicKey,
          paymentMint,
        };
        return standard === 'core'
          ? settleCoreAssetSale(caller, {
              ...args,
              asset: mint.publicKey,
              creators: [seller.identity.publicKey],
            })
          : standard === 'nft'
            ? settleNftSale(caller, {
                ...args,
                mint: mint.publicKey,
                creators: [seller.identity.publicKey],
              })
            : standard === 'tokens'
              ? settleTokensSale(caller, {
                  ...args,
                  mint: mint.publicKey,
                  receiverTokenAccount: findAssociatedTokenPda(buyer, {
                    mint: mint.publicKey,
                    owner: buyer.identity.publicKey,
                  })[0],
                })
              : standard === 'tokens-batch'
                ? settleTokensSaleClaimed(caller, {
                    ...args,
                    mint: mint.publicKey,
                    startIndex: 0,
                    endIndex: 0,
                  })
                : (standard === 'cnft-v2' ? settleCnftSaleV2 : settleCnftSale)(
                    caller,
                    {
                      ...args,
                      treeConfig: item.treeConfig,
                      merkleTree: item.merkleTree,
                      currentLeafOwner: item.owner,
                      currentLeafDelegate: item.owner,
                      args: cnft.cnftArgs(caller, item),
                    } as any
                  ).addRemainingAccounts(
                    cnft.settleRemainingAccounts(
                      item.creators,
                      cnft.getCnftProof(caller, item).proof
                    )
                  );
      };
      const pda = findGumballMachineAuthorityPda(seller, {
        gumballMachine: machine,
      })[0];
      const balance = (await seller.rpc.getBalance(pda)).basisPoints;
      await t.throwsAsync(settle(otherMint.publicKey).sendAndConfirm(caller), {
        message: /InvalidPaymentMint/,
      });
      t.is((await fetchGumballMachine(seller, machine)).itemsSettled, 0n);
      t.is((await seller.rpc.getBalance(pda)).basisPoints, balance);
      await settle().sendAndConfirm(caller);
      t.is((await fetchGumballMachine(seller, machine)).itemsSettled, 1n);
      t.is(balance - (await seller.rpc.getBalance(pda)).basisPoints, price);
    });
  }
}

for (const native of [true, false]) {
  test(`R11-02: buy-back deposits and withdrawals bind the machine currency; native=${native}`, async (t) => {
    const umi = await createUmi();
    const [mint] = await createMintWithHolders(umi, {
      holders: [{ owner: umi.identity, amount: 1000 }],
    });
    const [otherMint] = await createMintWithHolders(umi, { holders: [] });
    const machine = (
      await create(umi, {
        settings: native ? {} : { paymentMint: mint.publicKey },
        buyBackConfig: { ...getDefaultBuyBackConfig(), enabled: true },
      })
    ).publicKey;
    const run = (paymentMint: any, isWithdraw: boolean) =>
      manageBuyBackFunds(umi, {
        gumballMachine: machine,
        paymentMint,
        isWithdraw,
        amount: 100,
      }).sendAndConfirm(umi);
    await t.throwsAsync(run(otherMint.publicKey, false), {
      message: /InvalidPaymentMint/,
    });
    t.is((await fetchGumballMachine(umi, machine)).buyBackFundsAvailable, 0n);
    if (!native)
      await t.throwsAsync(run(undefined, false), {
        message: /InvalidPaymentMint/,
      });
    const paymentMint = native ? undefined : mint.publicKey;
    if (!native) {
      await createAssociatedToken(umi, {
        mint: mint.publicKey,
        owner: findGumballMachineAuthorityPda(umi, {
          gumballMachine: machine,
        })[0],
      }).sendAndConfirm(umi);
    }
    await run(paymentMint, false);
    await t.throwsAsync(run(otherMint.publicKey, true), {
      message: /InvalidPaymentMint/,
    });
    t.is((await fetchGumballMachine(umi, machine)).buyBackFundsAvailable, 100n);
    if (!native)
      await t.throwsAsync(run(undefined, true), {
        message: /InvalidPaymentMint/,
      });
    await run(paymentMint, true);
    t.is((await fetchGumballMachine(umi, machine)).buyBackFundsAvailable, 0n);
  });
}

for (const native of [true, false]) {
  test(`R12-02: currency cannot change while buy-back funds remain; native=${native}`, async (t) => {
    const umi = await createUmi();
    const [mint] = await createMintWithHolders(umi, {
      holders: [{ owner: umi.identity, amount: 1000 }],
    });
    const machine = (
      await create(umi, {
        settings: native ? {} : { paymentMint: mint.publicKey },
        buyBackConfig: { ...getDefaultBuyBackConfig(), enabled: true },
      })
    ).publicKey;
    const paymentMint = native ? undefined : mint.publicKey;
    if (!native)
      await createAssociatedToken(umi, {
        mint: mint.publicKey,
        owner: findGumballMachineAuthorityPda(umi, {
          gumballMachine: machine,
        })[0],
      }).sendAndConfirm(umi);
    await manageBuyBackFunds(umi, {
      gumballMachine: machine,
      paymentMint,
      amount: 100,
      isWithdraw: false,
    }).sendAndConfirm(umi);
    const original = await fetchGumballMachine(umi, machine);
    const changed = {
      ...original.settings,
      paymentMint: native
        ? mint.publicKey
        : publicKey('So11111111111111111111111111111111111111112'),
    };
    await t.throwsAsync(
      updateSettings(umi, {
        gumballMachine: machine,
        settings: changed,
      }).sendAndConfirm(umi),
      { message: /InvalidSettingUpdate/ }
    );
    t.is(
      (await fetchGumballMachine(umi, machine)).settings.paymentMint,
      original.settings.paymentMint
    );
    await manageBuyBackFunds(umi, {
      gumballMachine: machine,
      paymentMint,
      amount: 100,
      isWithdraw: true,
    }).sendAndConfirm(umi);
    await updateSettings(umi, {
      gumballMachine: machine,
      settings: changed,
    }).sendAndConfirm(umi);
    t.is((await fetchGumballMachine(umi, machine)).buyBackFundsAvailable, 0n);
  });
}
