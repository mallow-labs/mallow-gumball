import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchGumballMachine, GumballMachine, unwrap, wrap } from '../src';
import { create, createGumballGuard, createUmi } from './_setup';

test('it can unwrap a gumball machine v2 from its gumball guard', async (t) => {
  // Given an existing gumball machine and a gumball guard associated with it.
  const umi = await createUmi();
  const machine = (await create(umi)).publicKey;
  const gumballGuard = await createGumballGuard(umi);
  await transactionBuilder()
    .add(wrap(umi, { machine, gumballGuard }))
    .sendAndConfirm(umi);

  // When we unwrap the gumball machine from its gumball guard.
  await transactionBuilder()
    .add(unwrap(umi, { gumballMachine: machine, gumballGuard }))
    .sendAndConfirm(umi);

  // Then the mint authority of the gumball machine was updated accordingly.
  const gumballMachineAccount = await fetchGumballMachine(umi, machine);
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
  });
});
