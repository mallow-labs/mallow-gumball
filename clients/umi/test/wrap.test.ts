import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchGumballMachine, GumballMachine, wrap } from '../src';
import { create, createGumballGuard, createUmi } from './_setup';

test('it can wrap a gumball machine v2 in a gumball guard', async (t) => {
  // Given an existing gumball machine and gumball guard.
  const umi = await createUmi();
  const base = await create(umi);
  const machine = base.publicKey;
  const gumballGuard = await createGumballGuard(umi, { base });

  // When we wrap the gumball machine in the gumball guard.
  await transactionBuilder()
    .add(wrap(umi, { machine, gumballGuard }))
    .sendAndConfirm(umi);

  // Then the mint authority of the gumball machine is the gumball guard.
  const gumballMachineAccount = await fetchGumballMachine(umi, machine);
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(gumballGuard),
  });
});

test('it refuses a guard with a different immutable base', async (t) => {
  // Given an existing gumball machine and a gumball guard associated with it.
  const umi = await createUmi();
  const base = await create(umi);
  const machine = base.publicKey;
  const gumballGuardA = await createGumballGuard(umi, { base });
  await transactionBuilder()
    .add(wrap(umi, { machine, gumballGuard: gumballGuardA }))
    .sendAndConfirm(umi);

  // When we wrap the gumball machine in a different gumball guard.
  const gumballGuardB = await createGumballGuard(umi);
  await t.throwsAsync(
    transactionBuilder()
      .add(wrap(umi, { machine, gumballGuard: gumballGuardB }))
      .sendAndConfirm(umi),
    { message: /InvalidMachine/ }
  );

  // Then the mint authority of the gumball machine was updated accordingly.
  const gumballMachineAccount = await fetchGumballMachine(umi, machine);
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(gumballGuardA),
  });
});
