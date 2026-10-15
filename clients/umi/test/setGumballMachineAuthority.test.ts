import {
  generateSigner,
  publicKey,
  sol,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  GumballMachine,
  setGumballMachineAuthority,
  settleCoreAssetSale,
  TokenStandard,
} from '../src';
import { create, createCoreAsset, createUmi } from './_setup';

test('it can update the authority of a gumball machine v2', async (t) => {
  // Given a Gumball Machine using authority A.
  const umi = await createUmi();
  const authorityA = umi.identity;
  const buyer = await createUmi();
  const asset = await createCoreAsset(umi);
  const gumballMachine = await create(umi, {
    authority: authorityA.publicKey,
    items: [{ id: asset.publicKey, tokenStandard: TokenStandard.Core }],
    guards: { solPayment: { lamports: sol(1) } },
    startSale: true,
  });
  await draw(buyer, {
    gumballMachine: gumballMachine.publicKey,
    mintArgs: { solPayment: true },
  }).sendAndConfirm(buyer);

  // When we update it to use authority B.
  const authorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setGumballMachineAuthority(umi, {
        gumballMachine: gumballMachine.publicKey,
        authority: authorityA,
        newAuthority: authorityB.publicKey,
        newAuthoritySigner: authorityB,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine's authority was updated accordingly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(authorityB.publicKey),
  });
  await settleCoreAssetSale(buyer, {
    gumballMachine: gumballMachine.publicKey,
    index: 0,
    authority: authorityB.publicKey,
    seller: authorityA.publicKey,
    buyer: buyer.identity.publicKey,
    asset: asset.publicKey,
    creators: [authorityA.publicKey],
  }).sendAndConfirm(buyer);
  t.is(
    (await fetchGumballMachine(buyer, gumballMachine.publicKey)).itemsSettled,
    1n
  );
});

for (const key of [
  'Vote111111111111111111111111111111111111111',
  'SysvarRent111111111111111111111111111111111',
]) {
  test(`R12-03: authority rotation and initialization reject reserved ${key}`, async (t) => {
    const umi = await createUmi();
    const machine = await create(umi);
    await t.throwsAsync(
      setGumballMachineAuthority(umi, {
        gumballMachine: machine.publicKey,
        newAuthority: publicKey(key),
      }).sendAndConfirm(umi),
      { message: /InvalidAuthority/ }
    );
    await t.throwsAsync(create(umi, { authority: publicKey(key) }), {
      message: /InvalidAuthority/,
    });
  });
}

test('R12-03: reject off-curve, executable and unaccepted authority rotations', async (t) => {
  const umi = await createUmi();
  const machine = await create(umi);
  const escrow = findGumballMachineAuthorityPda(umi, {
    gumballMachine: machine.publicKey,
  })[0];
  for (const key of [
    escrow,
    publicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'),
    generateSigner(umi).publicKey,
  ]) {
    await t.throwsAsync(
      setGumballMachineAuthority(umi, {
        gumballMachine: machine.publicKey,
        newAuthority: key,
      }).sendAndConfirm(umi),
      { message: /InvalidAuthority/ }
    );
  }
  await setGumballMachineAuthority(umi, {
    gumballMachine: machine.publicKey,
    newAuthority: umi.identity.publicKey,
  }).sendAndConfirm(umi);
  for (const key of [
    escrow,
    publicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'),
  ])
    await t.throwsAsync(create(umi, { authority: key }), {
      message: /InvalidAuthority/,
    });
});

test('R12-03: legacy idempotent authority calls may omit the trailing optional signer', async (t) => {
  const umi = await createUmi();
  const machine = await create(umi);
  const legacy = setGumballMachineAuthority(umi, {
    gumballMachine: machine.publicKey,
    newAuthority: umi.identity.publicKey,
  }).mapInstructions((item) => ({
    ...item,
    instruction: {
      ...item.instruction,
      keys: item.instruction.keys.slice(0, 2),
    },
  }));
  await legacy.sendAndConfirm(umi);
  t.is(
    (await fetchGumballMachine(umi, machine.publicKey)).authority,
    umi.identity.publicKey
  );
});
