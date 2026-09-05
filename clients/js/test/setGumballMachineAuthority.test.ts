import { generateKeyPairSigner } from '@solana/kit';
import test from 'ava';
import { getSetGumballMachineAuthorityInstruction } from '../src';
import { createMachineNoGuard } from './_lifecycleSetup';
import { createClient, fetchGumballMachine, sendTransaction } from './_setup';

test('it can update the authority of a gumball machine', async (t) => {
  const client = await createClient();

  // Given a Gumball Machine using authority A.
  const authorityA = await generateKeyPairSigner();
  const { gumballMachine } = await createMachineNoGuard(client, {
    authority: authorityA,
  });

  // When we update it to use authority B.
  const authorityB = await generateKeyPairSigner();
  await sendTransaction(client.svm, client.payer, [
    getSetGumballMachineAuthorityInstruction({
      gumballMachine,
      authority: authorityA,
      newAuthority: authorityB.address,
    }),
  ]);

  // Then the Gumball Machine's authority was updated accordingly.
  const account = fetchGumballMachine(client.svm, gumballMachine);
  t.is(account.authority, authorityB.address);
});
