/* eslint-disable import/no-extraneous-dependencies */
import test from 'ava';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { measureGuardCu } from './guardScenarios';
import { measureCu } from './scenarios';

// Committed reference (checked in) that subsequent runs compare against.
const BASELINE = join(process.cwd(), 'test/cu/baseline.json');
// Latest run's numbers (git-ignored); handy for eyeballing/diffing locally.
const LATEST = join(process.cwd(), 'test/cu/latest.json');

// A run is a regression if any instruction exceeds baseline by more than this.
const TOLERANCE = 0.02;

type Metrics = Record<string, number>;

function readMetrics(path: string): Metrics {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

function writeMetrics(path: string, metrics: Metrics): void {
  const ordered = Object.fromEntries(
    Object.keys(metrics)
      .sort()
      .map((k) => [k, metrics[k]])
  );
  writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`);
}

function formatTable(baseline: Metrics, current: Metrics): string {
  const labels = Object.keys(current).sort();
  const lines = labels.map((label) => {
    const cur = current[label];
    const base = baseline[label];
    if (base == null) {
      return `  ${label.padEnd(16)} ${String(cur).padStart(9)}   (no baseline)`;
    }
    const delta = cur - base;
    const pct = ((delta / base) * 100).toFixed(1);
    const sign = delta > 0 ? '+' : '';
    return `  ${label.padEnd(16)} ${String(base).padStart(9)} -> ${String(
      cur
    ).padStart(9)}   ${sign}${delta} (${sign}${pct}%)`;
  });
  return [
    '',
    '  scenario           baseline ->   current   delta',
    ...lines,
  ].join('\n');
}

// `CU_SNAPSHOT=1` (re)writes the committed baseline from this run instead of
// asserting against it. Use it to establish or intentionally update the baseline.
const isSnapshot = process.env.CU_SNAPSHOT === '1';

test.serial('compute unit benchmark', async (t) => {
  const current = { ...(await measureCu()), ...(await measureGuardCu()) };
  writeMetrics(LATEST, current);

  if (isSnapshot) {
    writeMetrics(BASELINE, current);
    t.log(`Baseline snapshot written to ${BASELINE}`);
    t.log(formatTable({}, current));
    t.pass();
    return;
  }

  const baseline = readMetrics(BASELINE);
  t.log(formatTable(baseline, current));

  if (Object.keys(baseline).length === 0) {
    t.log(
      'No committed baseline found — run with CU_SNAPSHOT=1 to create one.'
    );
    t.pass();
    return;
  }

  for (const label of Object.keys(current)) {
    const base = baseline[label];
    if (base == null) continue; // new scenario, nothing to compare yet
    const ceiling = Math.ceil(base * (1 + TOLERANCE));
    t.true(
      current[label] <= ceiling,
      `${label} CU regressed: ${base} -> ${current[label]} (ceiling ${ceiling})`
    );
  }

  for (const label of Object.keys(baseline)) {
    t.true(
      label in current,
      `scenario '${label}' is in baseline.json but was not measured — remove it from the baseline or restore the scenario`
    );
  }
});
