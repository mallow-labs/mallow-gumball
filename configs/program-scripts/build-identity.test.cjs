const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ids = {
  'mallow-gumball': 'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa',
  'gumball-guard': 'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF',
};

const buildFixture = (t, mode = 'cold') => {
  const root = path.resolve(__dirname, '../..');
  mkdirSync(path.join(root, 'target'), { recursive: true });
  const fixture = mkdtempSync(path.join(root, 'target/build-identity-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const directory of ['configs/program-scripts', '.github', 'bin', 'idls', 'clients/umi/src/anchorIdls']) {
    mkdirSync(path.join(fixture, directory), { recursive: true });
  }
  writeFileSync(path.join(fixture, 'configs/program-scripts/build.sh'), readFileSync(path.join(__dirname, 'build.sh')));
  writeFileSync(path.join(fixture, 'configs/program-scripts/dump.sh'), '# No external RPCs in this build smoke test.\n');
  writeFileSync(path.join(fixture, '.github/.env'), `PROGRAMS=${JSON.stringify(Object.keys(ids))}\n`);
  for (const [program, id] of Object.entries(ids)) {
    const source = path.join(fixture, 'programs', program, 'program/src');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'lib.rs'), `declare_id!("${id}");\n`);
    if (mode === 'warm') {
      const deploy = path.join(fixture, 'programs', program, 'target/deploy');
      mkdirSync(deploy, { recursive: true });
      writeFileSync(path.join(deploy, `${program.replaceAll('-', '_')}-keypair.json`), '[42]\n');
    }
  }
  // Emulate Anchor's observed cold-cache key syncing, plus deliberate ID drift.
  // All tool binaries are stubs: this exercises the real build script orchestration.
  const stub = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.BUILD_SMOKE_LOG, tool + ' ' + args.join(' ') + '\\n');
if (tool === 'solana-keygen') {
  const output = args[args.indexOf('-o') + 1];
  fs.writeFileSync(output, '[42]\\n');
} else {
  const name = path.basename(path.dirname(process.cwd()));
  const stem = name.replaceAll('-', '_');
  const source = path.join(process.cwd(), 'src/lib.rs');
  const deploy = path.resolve('../target/deploy');
  fs.mkdirSync(deploy, { recursive: true });
  if (tool === 'anchor') {
    const key = path.join(deploy, stem + '-keypair.json');
    if (!fs.existsSync(key) || process.env.BUILD_SMOKE_MODE === 'source-drift') {
      fs.writeFileSync(source, 'declare_id!("11111111111111111111111111111111");\\n');
      fs.writeFileSync(key, '[42]\\n');
    }
    const id = fs.readFileSync(source, 'utf8').match(/declare_id!\\("([^"]+)"\\)/)[1];
    const idl = path.resolve('../target/idl');
    const types = path.resolve('../target/types');
    fs.mkdirSync(idl, { recursive: true });
    fs.mkdirSync(types, { recursive: true });
    fs.writeFileSync(path.join(idl, stem + '.json'), JSON.stringify({ address: process.env.BUILD_SMOKE_MODE === 'idl-drift' ? '11111111111111111111111111111111' : id }));
    fs.writeFileSync(path.join(types, stem + '.ts'), '// ' + id + '\\n');
    fs.writeFileSync(path.join(deploy, stem + '.so'), 'anchor v0 binary');
  } else if (tool === 'cargo') {
    // A cached SBF build leaves a newer Anchor v0 artifact untouched.
    const binary = path.join(deploy, stem + '.so');
    if (!fs.existsSync(binary)) fs.writeFileSync(binary, 'sbpf v2 binary');
  }
}
`;
  for (const tool of ['solana-keygen', 'anchor', 'cargo']) {
    writeFileSync(path.join(fixture, 'bin', tool), stub, { mode: 0o755 });
  }
  const log = path.join(fixture, 'tools.log');
  const result = spawnSync('bash', ['configs/program-scripts/build.sh'], {
    cwd: fixture,
    env: { ...process.env, PROGRAMS: JSON.stringify(Object.keys(ids)), PATH: `${fixture}/bin:${process.env.PATH}`, BUILD_SMOKE_LOG: log, BUILD_SMOKE_MODE: mode },
    encoding: 'utf8',
    timeout: 10000,
  });
  return { fixture, result, calls: existsSync(log) ? readFileSync(log, 'utf8') : '' };
};

for (const mode of ['cold', 'warm']) {
  test(`R16-02: ${mode}-cache build keeps canonical program IDs and publishes matching IDLs`, (t) => {
    const { fixture, result, calls } = buildFixture(t, mode);
    assert.equal(result.status, 0, result.stderr);
    assert.equal((calls.match(/solana-keygen new/g) ?? []).length, mode === 'cold' ? 2 : 0);
    for (const [program, id] of Object.entries(ids)) {
      const stem = program.replaceAll('-', '_');
      assert.equal(readFileSync(path.join(fixture, 'programs', program, 'program/src/lib.rs'), 'utf8'), `declare_id!("${id}");\n`);
      assert.equal(JSON.parse(readFileSync(path.join(fixture, 'idls', `${stem}.json`))).address, id);
      assert.match(readFileSync(path.join(fixture, 'clients/umi/src/anchorIdls', `${stem}.ts`), 'utf8'), new RegExp(id));
      assert.ok(existsSync(path.join(fixture, 'programs/.bin', `${stem}.so`)));
      assert.equal(readFileSync(path.join(fixture, 'programs/.bin', `${stem}.so`), 'utf8'), 'sbpf v2 binary');
    }
    assert.equal((calls.match(/anchor build --provider.cluster localnet --ignore-keys/g) ?? []).length, 2);
    assert.equal((calls.match(/cargo build-sbf --arch v2 --tools-version v1.52/g) ?? []).length, 2);
  });
}

for (const mode of ['source-drift', 'idl-drift']) {
  test(`R16-02: ${mode} aborts before deploying or publishing generated outputs`, (t) => {
    const { fixture, result, calls } = buildFixture(t, mode);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /canonical program ID/);
    assert.doesNotMatch(calls, /cargo build-sbf/);
    assert.equal(existsSync(path.join(fixture, 'idls/mallow_gumball.json')), false);
    assert.equal(existsSync(path.join(fixture, 'programs/.bin/mallow_gumball.so')), false);
  });
}
