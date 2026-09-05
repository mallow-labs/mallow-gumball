import {
  generateSigner,
  sol,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  createGlobalConfig,
  fetchGlobalConfigFromSeeds,
  updateGlobalConfig,
} from '../src';
import { createUmi, getTestAuthority, setupGlobalConfig } from './_setup';

// All tests mutate the same GlobalConfig singleton — they must run serially.

// ---------------------------------------------------------------------------
// create_global_config
// ---------------------------------------------------------------------------

test.serial('it creates the global config', async (t) => {
  const umi = await createUmi();
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  const config = await fetchGlobalConfigFromSeeds(umi);
  t.is(config.configAuthority, authority.publicKey);
  t.is(config.accountFeeAuthority, authority.publicKey);
});

test.serial(
  'it fails to create global config when it already exists',
  async (t) => {
    const umi = await createUmi();
    const authority = getTestAuthority(umi);
    await setupGlobalConfig(umi, authority);

    // Attempting to create again should fail because the PDA is already initialized.
    const promise = transactionBuilder()
      .add(
        createGlobalConfig(umi, {
          authority,
          configAuthority: authority.publicKey,
          accountFeeAuthority: authority.publicKey,
        })
      )
      .sendAndConfirm(umi);

    await t.throwsAsync(promise);
  }
);

// ---------------------------------------------------------------------------
// update_global_config
// ---------------------------------------------------------------------------

test.serial(
  'it updates only account_fee_authority when config_authority is null',
  async (t) => {
    const umi = await createUmi();
    const authority = getTestAuthority(umi);
    await setupGlobalConfig(umi, authority);

    const newFeeAuthority = generateSigner(umi).publicKey;
    await updateGlobalConfig(umi, {
      authority,
      newConfigAuthority: null,
      newAccountFeeAuthority: newFeeAuthority,
    }).sendAndConfirm(umi);

    const config = await fetchGlobalConfigFromSeeds(umi);
    t.is(
      config.configAuthority,
      authority.publicKey,
      'config_authority should be unchanged'
    );
    t.is(
      config.accountFeeAuthority,
      newFeeAuthority,
      'account_fee_authority should be updated'
    );

    // Restore for other tests.
    await updateGlobalConfig(umi, {
      authority,
      newConfigAuthority: null,
      newAccountFeeAuthority: authority.publicKey,
    }).sendAndConfirm(umi);
  }
);

test.serial(
  'it updates only config_authority when account_fee_authority is null',
  async (t) => {
    const umi = await createUmi();
    const authority = getTestAuthority(umi);
    await setupGlobalConfig(umi, authority);

    const newConfigAuth = generateSigner(umi);
    await umi.rpc.airdrop(newConfigAuth.publicKey, sol(1));

    await updateGlobalConfig(umi, {
      authority,
      newConfigAuthority: newConfigAuth.publicKey,
      newAccountFeeAuthority: null,
    }).sendAndConfirm(umi);

    const config = await fetchGlobalConfigFromSeeds(umi);
    t.is(
      config.configAuthority,
      newConfigAuth.publicKey,
      'config_authority should be updated'
    );
    t.is(
      config.accountFeeAuthority,
      authority.publicKey,
      'account_fee_authority should be unchanged'
    );

    // Restore — now the new config authority must sign.
    await updateGlobalConfig(umi, {
      authority: newConfigAuth,
      newConfigAuthority: authority.publicKey,
      newAccountFeeAuthority: null,
    }).sendAndConfirm(umi);
  }
);

test.serial('it updates both fields at once', async (t) => {
  const umi = await createUmi();
  const authority = getTestAuthority(umi);
  await setupGlobalConfig(umi, authority);

  const newConfigAuth = generateSigner(umi);
  const newFeeAuth = generateSigner(umi).publicKey;
  await umi.rpc.airdrop(newConfigAuth.publicKey, sol(1));

  await updateGlobalConfig(umi, {
    authority,
    newConfigAuthority: newConfigAuth.publicKey,
    newAccountFeeAuthority: newFeeAuth,
  }).sendAndConfirm(umi);

  const config = await fetchGlobalConfigFromSeeds(umi);
  t.is(config.configAuthority, newConfigAuth.publicKey);
  t.is(config.accountFeeAuthority, newFeeAuth);

  // Restore.
  await updateGlobalConfig(umi, {
    authority: newConfigAuth,
    newConfigAuthority: authority.publicKey,
    newAccountFeeAuthority: authority.publicKey,
  }).sendAndConfirm(umi);
});

test.serial(
  'it fails to update global config when signer is not the config authority',
  async (t) => {
    const umi = await createUmi();
    const authority = getTestAuthority(umi);
    await setupGlobalConfig(umi, authority);

    const randomSigner = generateSigner(umi);

    const promise = transactionBuilder()
      .add(
        updateGlobalConfig(umi, {
          authority: randomSigner,
          newConfigAuthority: randomSigner.publicKey,
          newAccountFeeAuthority: null,
        })
      )
      .sendAndConfirm(umi);

    await t.throwsAsync(promise, { message: /MissingRequiredSignature/ });
  }
);

test.serial(
  'it allows the new config authority to update after transfer',
  async (t) => {
    const umi = await createUmi();
    const authority = getTestAuthority(umi);
    await setupGlobalConfig(umi, authority);

    // Transfer config_authority to a new keypair.
    const newConfigAuth = generateSigner(umi);
    await umi.rpc.airdrop(newConfigAuth.publicKey, sol(1));

    await updateGlobalConfig(umi, {
      authority,
      newConfigAuthority: newConfigAuth.publicKey,
      newAccountFeeAuthority: null,
    }).sendAndConfirm(umi);

    // The old authority should no longer be able to update.
    const failPromise = transactionBuilder()
      .add(
        updateGlobalConfig(umi, {
          authority,
          newConfigAuthority: authority.publicKey,
          newAccountFeeAuthority: null,
        })
      )
      .sendAndConfirm(umi);
    await t.throwsAsync(failPromise, { message: /MissingRequiredSignature/ });

    // The new authority can update.
    const anotherFeeAuth = generateSigner(umi).publicKey;
    await updateGlobalConfig(umi, {
      authority: newConfigAuth,
      newConfigAuthority: null,
      newAccountFeeAuthority: anotherFeeAuth,
    }).sendAndConfirm(umi);

    const config = await fetchGlobalConfigFromSeeds(umi);
    t.is(config.configAuthority, newConfigAuth.publicKey);
    t.is(config.accountFeeAuthority, anotherFeeAuth);

    // Restore for other tests.
    await updateGlobalConfig(umi, {
      authority: newConfigAuth,
      newConfigAuthority: authority.publicKey,
      newAccountFeeAuthority: authority.publicKey,
    }).sendAndConfirm(umi);
  }
);
