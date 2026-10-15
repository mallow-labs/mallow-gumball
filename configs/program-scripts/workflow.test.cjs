const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, realpathSync } = require('node:fs');
const path = require('node:path');

test('R19-02: local Kit tests build Umi fixtures before loading AVA', () => {
  const root = path.join(__dirname, '../..');
  const scripts = JSON.parse(readFileSync(path.join(root, 'clients/js/package.json'), 'utf8')).scripts;
  const steps = scripts.test.split(' && ');
  assert.equal(steps[0], 'pnpm --dir ../umi build');
  assert.ok(steps.indexOf('ava') > 0);
  const rootScripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.equal(rootScripts['test:js'], 'cd clients/js && pnpm test');
});

test('R18-03: Kit v2 tests install and build their Umi fixtures before testing', () => {
  const { createRequire } = require('node:module');
  const { readdirSync } = require('node:fs');
  const root = path.join(__dirname, '../..');
  const usesUmi = readdirSync(path.join(root, 'clients/js/test'), { recursive: true })
    .filter((file) => file.endsWith('.ts'))
    .some((file) => readFileSync(path.join(root, 'clients/js/test', file), 'utf8').includes('../../../umi/'));
  assert.ok(usesUmi, 'the Kit v2 regressions must remain covered');
  const runtime = createRequire(realpathSync(path.join(root, 'clients/umi/node_modules/eslint/package.json')));
  const workflow = runtime('js-yaml').load(readFileSync(path.join(root, '.github/workflows/test-js.yml'), 'utf8'));
  const steps = workflow.jobs.test.steps;
  const install = steps.findIndex((step) => step['working-directory'] === './clients/umi' && step.run === 'pnpm install --frozen-lockfile');
  const build = steps.findIndex((step) => step['working-directory'] === './clients/umi' && step.run === 'pnpm build');
  const testIndex = steps.findIndex((step) => step.name === 'Test');
  assert.ok(install >= 0 && build > install && testIndex > build);
  assert.equal(steps[install].if, "matrix.client == 'js'");
  assert.equal(steps[build].if, "matrix.client == 'js'");
});

test('R13-17: CI runs operator regressions after installing their Umi runtime', () => {
  const workflow = readFileSync(path.join(__dirname, '../../.github/workflows/test-js.yml'), 'utf8');
  const steps = workflow.split(/\n      - name: /);
  const dependencies = steps.findIndex((step) => step.startsWith('Install dependencies\n'));
  const scripts = steps.findIndex((step) => /run: pnpm test:scripts\s*(?:\n|$)/.test(step));
  assert.ok(scripts > dependencies && dependencies > 0);
  assert.match(steps[scripts], /if: matrix\.client == 'umi'/);
  assert.doesNotMatch(steps[scripts], /working-directory:/);
  assert.match(steps[dependencies], /folder: \.\/clients\/\$\{\{ matrix\.client \}\}/);
});

test('R14-04/R17-02/R18-06: script, Umi and tested docs PRs reach the operator regression job', () => {
  // Reuse the YAML and glob runtimes installed with the Umi CI dependencies.
  const { createRequire } = require('node:module');
  const runtime = createRequire(realpathSync(path.join(__dirname, '../../clients/umi/node_modules/eslint/package.json')));
  const filters = runtime('js-yaml').load(readFileSync(path.join(__dirname, '../../.github/file-filters.yml'), 'utf8'));
  const minimatch = runtime('minimatch');
  const selected = (group, file) => filters[group].flat(Infinity).some((pattern) => minimatch(file, pattern, { dot: true }));
  const main = readFileSync(path.join(__dirname, '../../.github/workflows/main.yml'), 'utf8');
  assert.match(main, /build_programs:[\s\S]*?if:.*needs\.changes\.outputs\.any == 'true'/);
  assert.match(main, /generate_clients:[\s\S]*?if:.*needs\.changes\.outputs\.any == 'true'[\s\S]*?needs: build_programs/);
  assert.match(main, /js_changed:.*steps\.changes\.outputs\.js_client/);
  assert.match(main, /test_js:[\s\S]*?if: needs\.generate_clients\.outputs\.js_changed == 'true'[\s\S]*?uses: \.\/.github\/workflows\/test-js\.yml/);
  for (const file of [
    'configs/program-scripts/check-guard-bindings.cjs',
    'configs/program-scripts/workflow.test.cjs',
    'clients/umi/src/index.ts',
    'clients/umi/package.json',
    'package.json',
    '.github/file-filters.yml',
    'codama.mjs',
    'idls/mallow_gumball.json',
    'idls/gumball_guard.json',
    'pnpm-lock.yaml',
    'docs/cnft-v2.md',
    'docs/cnft-v2-metrics.json',
  ]) {
    assert.ok(selected('any', file), `${file} must enable the build/generate dependency chain`);
    assert.ok(selected('js_client', file), `${file} must enable the JS/Umi regression job`);
  }
  assert.equal(selected('any', 'docs/unrelated.md'), false);
  assert.equal(selected('js_client', 'docs/unrelated.md'), false);
  assert.equal(selected('any', 'docs/cnft-v2-fix18-metrics.json'), false);
  assert.equal(selected('js_client', 'docs/cnft-v2-fix18-metrics.json'), false);
});

test('R15-06/R15-08: shared Rust and toolchain changes select both programs and Rust tests', () => {
  const { createRequire } = require('node:module');
  const runtime = createRequire(realpathSync(path.join(__dirname, '../../clients/umi/node_modules/eslint/package.json')));
  const filters = runtime('js-yaml').load(readFileSync(path.join(__dirname, '../../.github/file-filters.yml'), 'utf8'));
  const minimatch = runtime('minimatch');
  const selected = (group, file) => filters[group].flat(Infinity).some((pattern) => minimatch(file, pattern, { dot: true }));
  for (const file of [
    'programs/utils/src/lamports.rs',
    'programs/utils/src/token22.rs',
    'programs/utils/tests/token_recipient.rs',
    'clients/rust/src/lib.rs',
    'clients/rust/tests/cnft_v2.rs',
    '.github/.env',
  ]) {
    for (const group of ['any', 'programs', 'mallow_gumball_program', 'gumball_guard_program', 'js_client']) {
      assert.ok(selected(group, file), `${file} must enable ${group}`);
    }
  }
  const workflow = runtime('js-yaml').load(readFileSync(path.join(__dirname, '../../.github/workflows/test-programs.yml'), 'utf8'));
  const host = workflow.jobs.test_rust;
  assert.ok(host, 'host Rust tests must run independently of the program matrix');
  assert.equal(host.strategy, undefined, 'shared Rust tests must run only once');
  const rust = host.steps.findIndex((step) => /install-rust/.test(step.uses ?? ''));
  for (const manifest of ['programs/utils/Cargo.toml', 'clients/rust/Cargo.toml']) {
    const index = host.steps.findIndex((step) => step.run === `cargo test --manifest-path ${manifest}`);
    assert.ok(index > rust && rust >= 0, `${manifest} must run after installing Rust`);
    assert.equal(host.steps[index].if, undefined);
    assert.equal(host.steps[index]['working-directory'], undefined);
  }
});
