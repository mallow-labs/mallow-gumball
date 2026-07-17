import { generateKeyPairSigner } from '@solana/kit';
import test from 'ava';
import {
  createGumballGuard,
  findGumballGuardPda,
  getSetGumballGuardAuthorityInstruction,
} from '../src';
import {
  createClient,
  fetchGumballGuard,
  generateKeyPairSignerWithSol,
  sendTransaction,
} from './_setup';

test('it can update the authority of a gumball guard', async (t) => {
  // Given a Gumball Guard using authority A.
  const client = await createClient();
  const authorityA = await generateKeyPairSignerWithSol(client.svm);
  const base = await generateKeyPairSigner();
  await sendTransaction(client.svm, client.payer, [
    await createGumballGuard({
      base,
      authority: authorityA.address,
      payer: client.payer,
    }),
  ]);
  const [gumballGuard] = await findGumballGuardPda({ base: base.address });

  // When we update it to use authority B.
  const authorityB = await generateKeyPairSigner();
  await sendTransaction(client.svm, authorityA, [
    getSetGumballGuardAuthorityInstruction({
      gumballGuard,
      authority: authorityA,
      newAuthority: authorityB.address,
    }),
  ]);

  // Then the Gumball Guard's authority was updated accordingly.
  const account = fetchGumballGuard(client.svm, gumballGuard);
  t.is(account.authority, authorityB.address);
});
