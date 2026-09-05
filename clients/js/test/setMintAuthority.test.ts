import { generateKeyPairSigner } from '@solana/kit';
import test from 'ava';
import { getSetMintAuthorityInstruction } from '../src';
import { createMachineNoGuard } from './_lifecycleSetup';
import { createClient, fetchGumballMachine, sendTransaction } from './_setup';

test('it can update the mint authority of a gumball machine', async (t) => {
  const client = await createClient();

  // Given a Gumball Machine with a mint authority equal to its authority A.
  const authorityA = await generateKeyPairSigner();
  const { gumballMachine } = await createMachineNoGuard(client, {
    authority: authorityA,
  });
  const before = fetchGumballMachine(client.svm, gumballMachine);
  t.is(before.mintAuthority, authorityA.address);

  // When we update its mint authority.
  const mintAuthorityB = await generateKeyPairSigner();
  await sendTransaction(client.svm, client.payer, [
    getSetMintAuthorityInstruction({
      gumballMachine,
      authority: authorityA,
      mintAuthority: mintAuthorityB,
    }),
  ]);

  // Then the Gumball Machine's mint authority was updated accordingly.
  const after = fetchGumballMachine(client.svm, gumballMachine);
  t.is(after.authority, authorityA.address);
  t.is(after.mintAuthority, mintAuthorityB.address);
});
