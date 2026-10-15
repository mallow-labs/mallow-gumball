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
  approveAddItem,
  fetchGumballMachine,
  findGumballGuardPda,
  getMerkleRoot,
  requestAddCoreAsset,
  setMintAuthority,
  startSale,
  unwrap,
  updateGumballGuard,
  updateSettings,
  wrap,
} from '../src';
import {
  create,
  createCoreAsset,
  createGumballGuard,
  createUmi,
} from './_setup';
import { getSvm } from './litesvm/svm';

for (const version of [0, 1, 2, 3, 4, 5, 6]) {
  for (const custody of ['pending', 'loaded', 'live']) {
    test(`R9-01: v${version} ${custody} invited custody locks mint authority and all guard settings`, async (t) => {
      const curator = await createUmi();
      const seller = await createUmi();
      const machine = (
        await create(curator, {
          settings: { itemCapacity: 2, itemsPerSeller: 2 },
          guards: { solPayment: some({ lamports: sol(1) }) },
        })
      ).publicKey;
      const key = publicKeyBytes(machine);
      const account = getSvm().getAccount(key)!;
      const data = account.data();
      // Version-specific config layouts are selected by the program at entry.
      data[8] = version;
      getSvm().setAccount(
        key,
        new Account(account.lamports(), data, account.owner(), false, 0n)
      );
      const guard = findGumballGuardPda(curator, { base: machine });
      const replacement = await createGumballGuard(curator);
      const asset = await createCoreAsset(seller);
      await requestAddCoreAsset(seller, {
        gumballMachine: machine,
        asset: asset.publicKey,
      }).sendAndConfirm(seller);
      if (custody !== 'pending') {
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
          .sendAndConfirm(curator);
      }
      if (custody === 'live')
        await startSale(curator, { gumballMachine: machine }).sendAndConfirm(
          curator
        );
      for (const change of [
        setMintAuthority(curator, {
          gumballMachine: machine,
          mintAuthority: curator.identity,
        }),
        unwrap(curator, { gumballMachine: machine, gumballGuard: guard }),
        wrap(curator, { machine, gumballGuard: replacement }),
      ]) {
        await t.throwsAsync(change.sendAndConfirm(curator), {
          message: /Error Number: 6045|InvalidMachine/,
        });
      }
      for (const update of [
        { guards: {} },
        { guards: { solPayment: some({ lamports: sol(0) }) } },
        {
          guards: {
            solPayment: some({ lamports: sol(1) }),
            addressGate: some({ address: curator.identity.publicKey }),
          },
        },
        {
          guards: { solPayment: some({ lamports: sol(1) }) },
          groups: [
            {
              label: 'FREE',
              guards: { solPayment: some({ lamports: sol(0) }) },
            },
          ],
        },
      ]) {
        await t.throwsAsync(
          updateGumballGuard(curator, {
            machine,
            gumballGuard: guard,
            groups: [],
            ...update,
          }).sendAndConfirm(curator),
          { message: /Error Number: 6045/ }
        );
      }
      t.is(
        (await fetchGumballMachine(curator, machine)).mintAuthority,
        guard[0]
      );
    });
  }
}

test('R9-01: a solo machine retains price and mint-authority management before draws', async (t) => {
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);
  const machine = (
    await create(umi, {
      guards: {},
      items: [{ id: asset.publicKey, tokenStandard: 1 }],
    })
  ).publicKey;
  const guard = findGumballGuardPda(umi, { base: machine });
  await updateGumballGuard(umi, {
    machine,
    gumballGuard: guard,
    groups: [],
    guards: { solPayment: some({ lamports: sol(1) }) },
  }).sendAndConfirm(umi);
  await unwrap(umi, {
    gumballMachine: machine,
    gumballGuard: guard,
  }).sendAndConfirm(umi);
  await wrap(umi, { machine, gumballGuard: guard }).sendAndConfirm(umi);
  t.is((await fetchGumballMachine(umi, machine)).mintAuthority, guard[0]);
});

test('R9-01: creation can wrap a finalized empty collab machine before any seller escrow', async (t) => {
  const umi = await createUmi();
  const machine = (
    await create(umi, {
      settings: {
        sellersMerkleRoot: some(getMerkleRoot([generateSigner(umi).publicKey])),
      },
      guards: {},
    })
  ).publicKey;
  t.is(
    (await fetchGumballMachine(umi, machine)).mintAuthority,
    findGumballGuardPda(umi, { base: machine })[0]
  );
});
