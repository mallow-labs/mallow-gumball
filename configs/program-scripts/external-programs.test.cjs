const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sha = (text) => createHash('sha256').update(text).digest('hex');

// A throwaway repo root holding the real scripts and stubs for curl and solana.
// Each stub serves the file named by its last argument from `served`.
const setup = (t, pins) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'external-programs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scripts = path.join(root, 'configs/program-scripts');
  mkdirSync(scripts, { recursive: true });
  for (const script of ['dump.sh', 'external-programs.sh']) {
    copyFileSync(path.join(__dirname, script), path.join(scripts, script));
  }
  writeFileSync(
    path.join(scripts, 'external-programs.txt'),
    ['# comment', 'release test-tag', ...Object.entries(pins).map(([file, text]) => `${file} ID${file} mainnet ${sha(text)}`)].join('\n') + '\n'
  );
  const served = path.join(root, 'served');
  const bin = path.join(root, 'bin');
  mkdirSync(served);
  mkdirSync(bin);
  writeFileSync(
    path.join(bin, 'curl'),
    `#!/bin/bash
for last; do :; done
while [ $# -gt 0 ]; do [ "$1" == "-o" ] && out=$2; shift; done
echo "$last" >> "${root}/curl.log"
cp "${served}/$(basename "$last")" "$out" 2>/dev/null || exit 22
`
  );
  writeFileSync(
    path.join(bin, 'solana'),
    `#!/bin/bash
for last; do :; done
cp "${served}/$(basename "$last")" "$last"
`
  );
  chmodSync(path.join(bin, 'curl'), 0o755);
  chmodSync(path.join(bin, 'solana'), 0o755);
  const run = (script, ...args) =>
    spawnSync('bash', [path.join(scripts, script), ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
  return {
    root,
    run,
    serve: (file, text) => writeFileSync(path.join(served, file), text),
    out: (file) => path.join(root, 'out', file),
    downloads: () => (existsSync(path.join(root, 'curl.log')) ? readFileSync(path.join(root, 'curl.log'), 'utf8').trim().split('\n') : []),
  };
};

test('dump installs a pinned binary from the manifest release', (t) => {
  const f = setup(t, { 'a.so': 'good' });
  f.serve('a.so', 'good');
  const result = f.run('dump.sh', 'out');
  assert.equal(result.status, 0, result.stdout);
  assert.equal(readFileSync(f.out('a.so'), 'utf8'), 'good');
  assert.match(f.downloads()[0], /releases\/download\/test-tag\/a\.so$/);
});

test('dump refuses a download that does not match its pin and installs nothing', (t) => {
  const f = setup(t, { 'a.so': 'good' });
  f.serve('a.so', 'tampered');
  const result = f.run('dump.sh', 'out');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /pinned/);
  assert.equal(existsSync(f.out('a.so')), false);
  assert.equal(existsSync(f.out('.download-a.so')), false);
});

test('dump fails when a binary cannot be downloaded', (t) => {
  const f = setup(t, { 'a.so': 'good' });
  const result = f.run('dump.sh', 'out');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /could not download/);
});

test('dump keeps a matching binary and replaces a stale one', (t) => {
  const f = setup(t, { 'keep.so': 'keep', 'stale.so': 'new' });
  mkdirSync(path.join(f.root, 'out'));
  writeFileSync(f.out('keep.so'), 'keep');
  writeFileSync(f.out('stale.so'), 'old');
  f.serve('stale.so', 'new');
  const result = f.run('dump.sh', 'out');
  assert.equal(result.status, 0, result.stdout);
  assert.equal(readFileSync(f.out('stale.so'), 'utf8'), 'new');
  assert.equal(f.downloads().length, 1);
});

test('check passes when the chain matches every pin', (t) => {
  const f = setup(t, { 'a.so': 'good' });
  f.serve('a.so', 'good');
  const result = f.run('external-programs.sh', 'check');
  assert.equal(result.status, 0, result.stdout);
});

test('check names a program upgraded on chain', (t) => {
  const f = setup(t, { 'a.so': 'good', 'b.so': 'same' });
  f.serve('a.so', 'upgraded');
  f.serve('b.so', 'same');
  const result = f.run('external-programs.sh', 'check');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /DRIFT a\.so/);
  assert.match(result.stdout, /ok b\.so/);
});

test('check tells an unreadable program apart from drift', (t) => {
  const f = setup(t, { 'a.so': 'good' });
  const result = f.run('external-programs.sh', 'check');
  assert.equal(result.status, 2);
  assert.match(result.stdout, /UNREADABLE a\.so/);
});

test('the manifest pins every external program the tests load', () => {
  const manifest = readFileSync(path.join(__dirname, 'external-programs.txt'), 'utf8');
  const entries = manifest.split('\n').filter((line) => !line.startsWith('#') && line.split(' ').length === 4).map((line) => line.split(' '));
  const release = manifest.split('\n').find((line) => line.startsWith('release '));
  assert.match(release, /^release external-programs-\d{4}-\d{2}-\d{2}$/);
  for (const [, , cluster, pinned] of entries) {
    assert.match(cluster, /^(mainnet|devnet)$/);
    assert.match(pinned, /^[0-9a-f]{64}$/);
  }
  const svm = readFileSync(path.join(__dirname, '../../clients/umi/test/litesvm/svm.ts'), 'utf8');
  const loaded = [...svm.matchAll(/id: '(\w+)',\s*file: 'programs\/\.bin\/(\w+\.so)'/g)].map((match) => [match[2], match[1]]);
  assert.ok(loaded.length > 0);
  for (const [file, id] of loaded) {
    if (file === 'mallow_gumball.so' || file === 'gumball_guard.so') continue;
    const entry = entries.find((row) => row[0] === file);
    assert.ok(entry, `${file} is not pinned`);
    assert.equal(entry[1], id, file);
  }
});
