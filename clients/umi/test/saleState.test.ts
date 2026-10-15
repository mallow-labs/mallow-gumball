/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */
import {
  fetchToken,
  findAssociatedTokenPda,
} from '@metaplex-foundation/mpl-toolbox';
import { none, publicKeyBytes, sol, some } from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import {
  CONFIG_LINE_V2_SIZE,
  endSale,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  getGumballMachineAccountDataSerializer,
  GUMBALL_MACHINE_SIZE,
  GumballState,
  removeTokens,
  removeTokensSpan,
  startSale,
  TokenStandard,
  updateSettings,
} from '../src';
import { create, createMintWithHolders, createUmi } from './_setup';
import { getSvm } from './litesvm/svm';

for (const collab of [false, true]) {
  test(`R5-01: v5 ${collab ? 'collab' : 'solo'} machine cannot change membership or reopen`, async (t) => {
    const umi = await createUmi();
    const mint = (
      await createMintWithHolders(umi, {
        holders: [{ owner: umi.identity, amount: 1 }],
      })
    )[0];
    const machine = (
      await create(umi, {
        settings: {
          sellersMerkleRoot: collab ? some(new Uint8Array(32)) : none(),
        },
        items: [
          {
            id: mint.publicKey,
            amount: 1,
            tokenStandard: TokenStandard.Fungible,
          },
        ],
        guards: { solPayment: { lamports: sol(1) } },
      })
    ).publicKey;
    t.is((await fetchGumballMachine(umi, machine)).version, 5);
    await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
    for (const state of [GumballState.SaleLive, GumballState.SaleEnded]) {
      if (state === GumballState.SaleEnded)
        await endSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
      const before = await fetchGumballMachine(umi, machine);
      await t.throwsAsync(
        updateSettings(umi, {
          gumballMachine: machine,
          settings: {
            ...before.settings,
            sellersMerkleRoot: collab ? none() : some(new Uint8Array(32)),
          },
        }).sendAndConfirm(umi),
        { message: /Error Number: 6045/ }
      );
      await updateSettings(umi, {
        gumballMachine: machine,
        settings: { ...before.settings, uri: 'updated' },
      }).sendAndConfirm(umi);
      t.is((await fetchGumballMachine(umi, machine)).state, state);
      await t.throwsAsync(
        startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi),
        { message: /Error Number: 6036/ }
      );
    }
  });
}

for (const span of [false, true]) {
  for (const marker of ['buyer', 'claimed', 'settled', 'payment']) {
    test(`R5-01/R5-20: ${span ? 'span' : 'legacy indices'} removal rejects a ${marker} ledger marker`, async (t) => {
      const umi = await createUmi();
      const mint = (
        await createMintWithHolders(umi, {
          holders: [{ owner: umi.identity, amount: 2 }],
        })
      )[0];
      const machine = (
        await create(umi, {
          settings: { itemCapacity: 2 },
          items: [
            {
              id: mint.publicKey,
              amount: 1,
              tokenStandard: TokenStandard.Fungible,
            },
          ],
        })
      ).publicKey;
      const svm = getSvm();
      const key = publicKeyBytes(machine);
      const account = svm.getAccount(key)!;
      const data = account.data();
      const decoded = await fetchGumballMachine(umi, machine);
      // Model a migrated editable account with an inconsistent processed line.
      data.set(
        getGumballMachineAccountDataSerializer().serialize({
          ...decoded,
          version: 6,
        })
      );
      const masks = GUMBALL_MACHINE_SIZE + 4 + 2 * CONFIG_LINE_V2_SIZE;
      if (marker === 'buyer') data[GUMBALL_MACHINE_SIZE + 4 + 64] = 1;
      if (marker === 'claimed') data[masks] |= 0x80;
      if (marker === 'settled') data[masks + 1] |= 0x80;
      if (marker === 'payment') {
        const oldSize =
          GUMBALL_MACHINE_SIZE +
          4 +
          2 * CONFIG_LINE_V2_SIZE +
          2 +
          8 +
          5 +
          38 +
          8 +
          8;
        data[oldSize + 16] = 1;
      }
      svm.setAccount(
        key,
        new Account(account.lamports(), data, account.owner(), false, 0n)
      );
      const escrow = findGumballMachineAuthorityPda(umi, {
        gumballMachine: machine,
      })[0];
      const tokenAccount = findAssociatedTokenPda(umi, {
        mint: mint.publicKey,
        owner: escrow,
      })[0];
      const balance = (await fetchToken(umi, tokenAccount)).amount;
      const builder = span
        ? removeTokensSpan(umi, {
            gumballMachine: machine,
            mint: mint.publicKey,
            amount: 1,
            startIndex: 0,
            endIndex: 0,
          })
        : removeTokens(umi, {
            gumballMachine: machine,
            mint: mint.publicKey,
            amount: 1,
            indices: new Uint8Array([0]),
          });
      await t.throwsAsync(builder.sendAndConfirm(umi), {
        message: /Error Number: 6036/,
      });
      t.deepEqual(svm.getAccount(key)!.data(), data);
      t.is((await fetchToken(umi, tokenAccount)).amount, balance);
    });
  }
}

for (const version of [5, 6]) {
  for (const collab of [false, true]) {
    test(`R6-03/R6-04: v${version} ${collab ? 'collab' : 'solo'} payment and membership lock with loaded items`, async (t) => {
      const umi = await createUmi();
      const [mint] = await createMintWithHolders(umi, {
        holders: [{ owner: umi.identity, amount: 1 }],
      });
      const machine = (
        await create(umi, {
          settings: {
            sellersMerkleRoot: collab ? some(new Uint8Array(32)) : none(),
          },
          items: [
            { id: mint.publicKey, tokenStandard: TokenStandard.Fungible },
          ],
          guards: { solPayment: { lamports: sol(1) } },
        })
      ).publicKey;
      if (version === 6) {
        const key = publicKeyBytes(machine);
        const account = getSvm().getAccount(key)!;
        const data = account.data();
        data[8] = version;
        getSvm().setAccount(
          key,
          new Account(account.lamports(), data, account.owner(), false, 0n)
        );
      }
      for (const state of [
        collab ? GumballState.DetailsFinalized : GumballState.None,
        GumballState.SaleLive,
        GumballState.SaleEnded,
      ]) {
        if (state === GumballState.SaleLive)
          await startSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
        if (state === GumballState.SaleEnded)
          await endSale(umi, { gumballMachine: machine }).sendAndConfirm(umi);
        const before = await fetchGumballMachine(umi, machine);
        if (state === GumballState.DetailsFinalized) {
          for (const root of [some(new Uint8Array(32).fill(1)), none()]) {
            await updateSettings(umi, {
              gumballMachine: machine,
              settings: { ...before.settings, sellersMerkleRoot: root },
            }).sendAndConfirm(umi);
            t.deepEqual(
              (await fetchGumballMachine(umi, machine)).settings
                .sellersMerkleRoot,
              root
            );
          }
          await updateSettings(umi, {
            gumballMachine: machine,
            settings: before.settings,
          }).sendAndConfirm(umi);
        }
        const raw = getSvm().getAccount(publicKeyBytes(machine))!.data();
        for (const settings of [
          { ...before.settings, paymentMint: mint.publicKey },
          ...(state === GumballState.SaleLive ||
          state === GumballState.SaleEnded
            ? [
                {
                  ...before.settings,
                  sellersMerkleRoot: collab ? none() : some(new Uint8Array(32)),
                },
              ]
            : []),
          ...(collab && state !== GumballState.DetailsFinalized
            ? [
                {
                  ...before.settings,
                  sellersMerkleRoot: some(new Uint8Array(32).fill(1)),
                },
              ]
            : []),
        ]) {
          await t.throwsAsync(
            updateSettings(umi, {
              gumballMachine: machine,
              settings,
            }).sendAndConfirm(umi),
            { message: /Error Number: 6045/ }
          );
          t.deepEqual(
            getSvm().getAccount(publicKeyBytes(machine))!.data(),
            raw
          );
        }
        await updateSettings(umi, {
          gumballMachine: machine,
          settings: { ...before.settings, uri: 'updated' },
        }).sendAndConfirm(umi);
        t.is((await fetchGumballMachine(umi, machine)).state, state);
      }
    });
  }
}
