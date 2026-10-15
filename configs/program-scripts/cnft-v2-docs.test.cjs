const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

test('R18-01: every settlement reference uses an explicit burnt-slot signal', () => {
  const root = path.resolve(__dirname, '../..');
  for (const file of ['docs/cnft-v2.md', 'programs/mallow-gumball/README.md', 'clients/umi/README.md', 'clients/js/README.md']) {
    const docs = readFileSync(path.join(root, file), 'utf8');
    assert.match(docs, /args\.flags = 255/, file);
    assert.match(docs, /nonce == index/, file);
    assert.match(docs, /default.*(?:keys|owner)|owner.*default/s, file);
  }
});

test('R18-09: program instruction reference documents acceptance and parked payout exits', () => {
  const root = path.resolve(__dirname, '../..');
  const readme = readFileSync(path.join(root, 'programs/mallow-gumball/README.md'), 'utf8');
  const authority = readme.split('### 📄 `set_authority`')[1].split('### 📄')[0];
  assert.match(authority, /`new_authority_signer`.*✅.*required.*differs/i);
  assert.match(authority, /idempotent.*omit/i);
  const close = readme.split('### 📄 `withdraw`')[1].split('### 📄')[0];
  assert.match(close, /surplus above parked token debt/);
  assert.match(close, /vault.*remains open.*debt/s);
  const withdraw = readme.split('### 📄 `withdraw_payout`')[1].split('### 📄')[0];
  const recover = readme.split('### 📄 `recover_payout_rent`')[1].split('### 📄')[0];
  assert.match(withdraw, /recipient.*sign/i);
  assert.match(recover, /zero[\s\S]*?rent\s+payer.*sign/i);
  assert.match(readme, /\.\.\/\.\.\/docs\/cnft-v2\.md#parked-payouts-and-compatibility/);
});

test('R16-07: payout docs explain machine liveness, full vault sweep and rent fallback', () => {
  const root = path.resolve(__dirname, '../..');
  const source = readFileSync(path.join(root, 'programs/mallow-gumball/program/src/instructions/withdraw_payout.rs'), 'utf8');
  const docs = readFileSync(path.join(root, 'docs/cnft-v2.md'), 'utf8');
  const account = source.split('pub gumball_machine:')[0];
  assert.match(account, /key gives escrow seeds; owner and discriminator determine/);
  assert.match(account, /final post-close token withdrawal sweeps the vault balance/);
  const withdrawal = docs.split('- `withdraw_payout(amount: u64)`')[1].split('- `recover_payout_rent')[0];
  assert.match(withdrawal, /machine key gives the PDA seeds; its owner and discriminator determine/);
  assert.doesNotMatch(withdrawal, /used only as a key/);
  assert.match(docs, /final debt in that mint transfers the\s+vault's entire balance, including any unsolicited residue/);
  assert.match(docs, /credited amount can\s+therefore exceed the requested `amount`/);
  assert.match(docs, /falling\s+back to the recorded claim rent payer/);
  assert.match(docs, /If neither account can receive SOL rent-exempt, withdrawal still succeeds and\s+the empty vault remains open/);
});

test('R21-08: rollout refers to the current artifact and exact extension', () => {
  const root = path.resolve(__dirname, '../..');
  const docs = readFileSync(path.join(root, 'docs/cnft-v2.md'), 'utf8');
  const metrics = JSON.parse(readFileSync(path.join(root, 'docs/cnft-v2-fix21-metrics.json'), 'utf8'));
  const artifact = metrics.artifact.gumball;
  const rollout = docs.split('## Rollout and allocation')[1].split('## Parked payouts')[0];
  assert.match(rollout, /\[M21 release artifact\]\(#m21-marketplace-authorized-tree-exits\)/);
  assert.doesNotMatch(rollout, /1,711,600|161,392|29e37071|1,713,360|163,152|f84d4696/);
  const current = docs.split('## M21 marketplace-authorized tree exits')[1];
  for (const program of [artifact, metrics.artifact.guard]) {
    assert.ok(current.includes(program.bytes.toLocaleString('en-US')));
    assert.ok(current.includes(program.sha256));
    assert.ok(current.includes(program.recordedAllocationBytes.toLocaleString('en-US')));
    assert.equal(program.extendBytes, Math.max(0, program.bytes - program.recordedAllocationBytes));
  }
  assert.ok(current.includes(artifact.extendBytes.toLocaleString('en-US')));
  assert.ok(rollout.includes(metrics.artifact.guard.sha256));
});

test('release crates carry versions distinct from the deployed 1.0.0 programs', () => {
  const root = path.resolve(__dirname, '../..');
  const metrics = JSON.parse(readFileSync(path.join(root, 'docs/cnft-v2-fix21-metrics.json'), 'utf8'));
  const crateVersion = (manifest) =>
    readFileSync(path.join(root, manifest), 'utf8').match(/^version = "([^"]+)"/m)[1];
  const deployed = '1.0.0';
  const gumball = crateVersion('programs/mallow-gumball/program/Cargo.toml');
  const guard = crateVersion('programs/gumball-guard/program/Cargo.toml');
  assert.notEqual(gumball, deployed, 'mallow-gumball crate');
  assert.notEqual(guard, deployed, 'gumball-guard crate');
  assert.equal(gumball, metrics.artifact.gumball.crateVersion);
  assert.equal(guard, metrics.artifact.guard.crateVersion);
  assert.equal(crateVersion('programs/utils/Cargo.toml'), '0.2.0');
  for (const [idl, version] of [['mallow_gumball', gumball], ['gumball_guard', guard]]) {
    const json = JSON.parse(readFileSync(path.join(root, `idls/${idl}.json`), 'utf8'));
    assert.notEqual(json.metadata.version, deployed, idl);
    assert.equal(json.metadata.version, version, idl);
    assert.match(readFileSync(path.join(root, `clients/umi/src/anchorIdls/${idl}.ts`), 'utf8'), new RegExp(`version: '${version}'`));
  }
});

test('R21-08: settle account documentation includes the marketplace prefix', () => {
  const root = path.resolve(__dirname, '../..');
  const source = readFileSync(path.join(root, 'programs/mallow-gumball/program/src/instructions/settle_cnft_sale_v2.rs'), 'utf8');
  const docs = source.split('#[event_cpi]')[0];
  assert.match(docs, /marketplace fee authority signer and canonical/);
  assert.match(docs, /guard GlobalConfig, before any Token-2022 slot/);
});
