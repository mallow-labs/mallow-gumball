import { createJellybeanMachine } from '@mallow-labs/mallow-jellybean-umi';
import {
  generateSigner,
  publicKeyBytes,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { Account } from 'litesvm/dist/internal';
import {
  addCnftV2,
  approveAddItem,
  closeGumballMachine,
  createGumballGuard,
  draw,
  drawJellybean,
  fetchGumballGuard,
  fetchGumballMachine,
  findGumballGuardPda,
  getGumballMachineSizeForItemCount,
  getMerkleRoot,
  requestAddCoreAsset,
  startSale,
  TokenStandard,
  updateGumballGuard,
  updateSettings,
  wrap,
} from '../src';
import {
  cnftArgs,
  createCnftUmi,
  getCnftProof,
  mintCnft,
  proofAccounts,
} from './_cnftV2Setup';
import {
  createJellybeanUmi,
  MALLOW_JELLYBEAN_PROGRAM_ID,
} from './_jellybeanSetup';
import { create, createCoreAsset, createUmi } from './_setup';
import { getSvm } from './litesvm/svm';

for (const version of [5, 6]) {
  for (const otherType of ['gumball', 'jellybean']) {
    test(`R10-01: v${version} guard rejects another ${otherType} on wrap, update, draw and close`, async (t) => {
      const curator = await createCnftUmi(() => createJellybeanUmi(createUmi));
      const seller = await createUmi();
      const base = await create(curator, {
        settings: { itemCapacity: 2 },
        guards: { solPayment: some({ lamports: sol(1) }) },
      });
      const machine = base.publicKey;
      const guard = findGumballGuardPda(curator, { base: machine });
      if (version === 6) {
        const leaf = await mintCnft(curator);
        await addCnftV2(curator, {
          gumballMachine: machine,
          treeConfig: leaf.treeConfig,
          merkleTree: leaf.merkleTree,
          leafDelegate: leaf.owner,
          addItemArgs: {},
          args: cnftArgs(curator, leaf),
        })
          .addRemainingAccounts(
            proofAccounts(getCnftProof(curator, leaf).proof)
          )
          .sendAndConfirm(curator);
      }
      t.is((await fetchGumballMachine(curator, machine)).version, version);
      t.is(
        getSvm().getAccount(publicKeyBytes(machine))!.data().length,
        getGumballMachineSizeForItemCount(2, 6)
      );
      const asset = await createCoreAsset(seller);
      await requestAddCoreAsset(seller, {
        gumballMachine: machine,
        asset: asset.publicKey,
      }).sendAndConfirm(seller);
      const current = await fetchGumballMachine(curator, machine);
      await transactionBuilder()
        .add(
          updateSettings(curator, {
            gumballMachine: machine,
            settings: {
              ...current.settings,
              sellersMerkleRoot: some(
                getMerkleRoot([seller.identity.publicKey])
              ),
            },
          })
        )
        .add(
          approveAddItem(curator, {
            gumballMachine: machine,
            seller: seller.identity.publicKey,
            asset: asset.publicKey,
          })
        )
        .add(startSale(curator, { gumballMachine: machine }))
        .sendAndConfirm(curator);
      const other = generateSigner(curator);
      if (otherType === 'gumball')
        await create(curator, { gumballMachine: other });
      else
        await (
          await createJellybeanMachine(curator, {
            jellybeanMachine: other,
            args: { uri: '', feeAccounts: [], printFeeConfig: null },
          })
        ).sendAndConfirm(curator);
      const machineProgram =
        otherType === 'gumball' ? undefined : MALLOW_JELLYBEAN_PROGRAM_ID;
      await t.throwsAsync(
        wrap(curator, {
          machine: other.publicKey,
          gumballGuard: guard,
          machineProgram,
        }).sendAndConfirm(curator),
        { message: /InvalidMachine/ }
      );
      // Legacy shared guard state: the upgraded guard must also reject this
      // machine on first touch, even if its old mint authority already matches.
      const old = getSvm().getAccount(publicKeyBytes(other.publicKey))!;
      const otherData = old.data();
      otherData.set(publicKeyBytes(guard[0]), 41);
      getSvm().setAccount(
        publicKeyBytes(other.publicKey),
        new Account(old.lamports(), otherData, old.owner(), false, 0n)
      );
      await t.throwsAsync(
        updateGumballGuard(curator, {
          machine: other.publicKey,
          gumballGuard: guard,
          guards: {},
          groups: [],
        }).sendAndConfirm(curator),
        { message: /InvalidMachine/ }
      );
      const wrongDraw =
        otherType === 'gumball'
          ? draw(curator, {
              gumballMachine: other.publicKey,
              gumballGuard: guard,
              mintArgs: { solPayment: true },
            })
          : drawJellybean(curator, {
              jellybeanMachine: other.publicKey,
              gumballGuard: guard,
              mintArgs: { solPayment: true },
            });
      await t.throwsAsync(wrongDraw.sendAndConfirm(curator), {
        message: /InvalidMachine/,
      });
      await t.throwsAsync(
        closeGumballMachine(curator, {
          machine: other.publicKey,
          gumballGuard: guard,
          machineProgram,
        }).sendAndConfirm(curator),
        { message: /InvalidMachine/ }
      );
      await t.throwsAsync(
        createGumballGuard(curator, { base, guards: {} }).sendAndConfirm(
          curator
        )
      );
      t.true(await curator.rpc.accountExists(guard[0]));
      t.is(
        (await fetchGumballMachine(curator, machine)).mintAuthority,
        guard[0]
      );
      t.deepEqual(
        (await fetchGumballGuard(curator, guard)).guards.solPayment,
        some({ lamports: sol(1) })
      );
      await draw(curator, {
        gumballMachine: machine,
        gumballGuard: guard,
        mintArgs: { solPayment: true },
      }).sendAndConfirm(curator);
      const drawn = await fetchGumballMachine(curator, machine);
      t.is(drawn.itemsRedeemed, 1n);
      if (version === 6) {
        t.is(
          drawn.drawPayments.reduce((sum, amount) => sum + amount, 0n),
          1_000_000_000n
        );
        const compressedDraw =
          drawn.items.find((item) => item.buyer === curator.identity.publicKey)
            ?.tokenStandard === TokenStandard.Compressed;
        t.is(drawn.refundReserve, compressedDraw ? 1_000_000_000n : 0n);
        t.is(drawn.outstandingDraws, compressedDraw ? 1n : 0n);
        t.is(drawn.pendingDrawPayment, 0n);
      }
      await t.throwsAsync(
        updateGumballGuard(curator, {
          machine,
          gumballGuard: guard,
          guards: {},
          groups: [],
        }).sendAndConfirm(curator),
        { message: /Error Number: 6045/ }
      );
    });
  }
}
