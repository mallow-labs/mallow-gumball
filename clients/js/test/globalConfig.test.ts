import { generateKeyPairSigner } from '@solana/kit';
import test from 'ava';
import {
  fetchGlobalConfigFromSeeds,
  getCreateGlobalConfigInstructionAsync,
  getUpdateGlobalConfigInstructionAsync,
} from '../src';
import {
  createClient,
  generateKeyPairSignerWithSol,
  sendTransaction,
  setupGlobalConfig,
} from './_setup';

// Each ava test builds its own LiteSVM ledger (fresh GlobalConfig singleton), so
// unlike the umi suite these do not need to run serially or restore state.

// ---------------------------------------------------------------------------
// create_global_config
// ---------------------------------------------------------------------------

test('it creates the global config', async (t) => {
  const client = await createClient();
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  const config = await fetchGlobalConfigFromSeeds(client.rpc);
  t.is(config.data.configAuthority, authority.address);
  t.is(config.data.accountFeeAuthority, authority.address);
});

test('it fails to create global config when it already exists', async (t) => {
  const client = await createClient();
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  // Attempting to create again should fail because the PDA is already initialized.
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getCreateGlobalConfigInstructionAsync({
        authority,
        configAuthority: authority.address,
        accountFeeAuthority: authority.address,
      }),
    ]),
    { message: /already in use/ }
  );
});

// ---------------------------------------------------------------------------
// update_global_config
// ---------------------------------------------------------------------------

test('it updates only account_fee_authority when config_authority is null', async (t) => {
  const client = await createClient();
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  const newFeeAuthority = (await generateKeyPairSigner()).address;
  await sendTransaction(client.svm, client.payer, [
    await getUpdateGlobalConfigInstructionAsync({
      authority,
      newConfigAuthority: null,
      newAccountFeeAuthority: newFeeAuthority,
    }),
  ]);

  const config = await fetchGlobalConfigFromSeeds(client.rpc);
  t.is(
    config.data.configAuthority,
    authority.address,
    'config_authority should be unchanged'
  );
  t.is(
    config.data.accountFeeAuthority,
    newFeeAuthority,
    'account_fee_authority should be updated'
  );
});

test('it updates only config_authority when account_fee_authority is null', async (t) => {
  const client = await createClient();
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  const newConfigAuth = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, client.payer, [
    await getUpdateGlobalConfigInstructionAsync({
      authority,
      newConfigAuthority: newConfigAuth.address,
      newAccountFeeAuthority: null,
    }),
  ]);

  const config = await fetchGlobalConfigFromSeeds(client.rpc);
  t.is(
    config.data.configAuthority,
    newConfigAuth.address,
    'config_authority should be updated'
  );
  t.is(
    config.data.accountFeeAuthority,
    authority.address,
    'account_fee_authority should be unchanged'
  );
});

test('it updates both fields at once', async (t) => {
  const client = await createClient();
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  const newConfigAuth = await generateKeyPairSignerWithSol(client.svm);
  const newFeeAuth = (await generateKeyPairSigner()).address;
  await sendTransaction(client.svm, client.payer, [
    await getUpdateGlobalConfigInstructionAsync({
      authority,
      newConfigAuthority: newConfigAuth.address,
      newAccountFeeAuthority: newFeeAuth,
    }),
  ]);

  const config = await fetchGlobalConfigFromSeeds(client.rpc);
  t.is(config.data.configAuthority, newConfigAuth.address);
  t.is(config.data.accountFeeAuthority, newFeeAuth);
});

test('it fails to update global config when signer is not the config authority', async (t) => {
  const client = await createClient();
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  const randomSigner = await generateKeyPairSignerWithSol(client.svm);
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getUpdateGlobalConfigInstructionAsync({
        authority: randomSigner,
        newConfigAuthority: randomSigner.address,
        newAccountFeeAuthority: null,
      }),
    ]),
    { message: /MissingRequiredSignature/ }
  );
});

test('it allows the new config authority to update after transfer', async (t) => {
  const client = await createClient();
  const authority = await generateKeyPairSignerWithSol(client.svm);
  await setupGlobalConfig(client, authority);

  // Transfer config_authority to a new keypair.
  const newConfigAuth = await generateKeyPairSignerWithSol(client.svm);
  await sendTransaction(client.svm, client.payer, [
    await getUpdateGlobalConfigInstructionAsync({
      authority,
      newConfigAuthority: newConfigAuth.address,
      newAccountFeeAuthority: null,
    }),
  ]);

  // The old authority should no longer be able to update.
  await t.throwsAsync(
    sendTransaction(client.svm, client.payer, [
      await getUpdateGlobalConfigInstructionAsync({
        authority,
        newConfigAuthority: authority.address,
        newAccountFeeAuthority: null,
      }),
    ]),
    { message: /MissingRequiredSignature/ }
  );

  // The new authority can update.
  const anotherFeeAuth = (await generateKeyPairSigner()).address;
  await sendTransaction(client.svm, client.payer, [
    await getUpdateGlobalConfigInstructionAsync({
      authority: newConfigAuth,
      newConfigAuthority: null,
      newAccountFeeAuthority: anotherFeeAuth,
    }),
  ]);

  const config = await fetchGlobalConfigFromSeeds(client.rpc);
  t.is(config.data.configAuthority, newConfigAuth.address);
  t.is(config.data.accountFeeAuthority, anotherFeeAuth);
});
