#!/usr/bin/env node
/**
 * Render the Playwright JSON reporter output as a Markdown job summary.
 *
 * Usage: node scripts/e2e-summary.mjs <results.json> [<results.json> ...]
 *
 * Several files can be given when the CI step ran a healing pass over the
 * failures of the first pass: later files override earlier ones per test, so
 * a test that failed first and passed on the re-run is reported as healed.
 */

import { readFileSync, existsSync } from 'node:fs';

const files = process.argv.slice(2).filter(existsSync);
if (files.length === 0) {
  console.log('No Playwright results found.');
  process.exit(0);
}

/** @type {Map<string, { title: string, outcome: string, error: string, pass: number }>} */
const tests = new Map();

function walk(suite, ancestors, pass) {
  for (const spec of suite.specs ?? []) {
    const title = [...ancestors, spec.title].join(' > ');
    const key = `${spec.file}:${spec.line}:${title}`;
    const test = spec.tests[0];
    if (!test) continue;
    const firstError = test.results.find(r => r.error)?.error?.message ?? '';
    const previous = tests.get(key);
    let outcome = test.status;
    let error = firstError;
    if (previous && previous.outcome !== 'expected' && outcome === 'expected') {
      outcome = 'healed';
      error = previous.error;
    }
    tests.set(key, { title: `${spec.file} > ${title}`, outcome, error, pass });
  }
  for (const child of suite.suites ?? []) {
    walk(child, [...ancestors, child.title], pass);
  }
}

files.forEach((file, index) => {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  for (const suite of report.suites ?? []) {
    walk(suite, [], index + 1);
  }
});

const rows = [...tests.values()];
const byOutcome = outcome => rows.filter(t => t.outcome === outcome);
const failed = byOutcome('unexpected');
const flaky = byOutcome('flaky');
const healed = byOutcome('healed');
const passed = byOutcome('expected');

function firstLine(text) {
  const stripped = text.replace(/\[[0-9;]*m/g, '');
  const line = stripped.split('\n').find(l => l.trim()) ?? '';
  return line.trim().slice(0, 160);
}

const lines = [];
lines.push('## E2E results');
lines.push('');
lines.push(
  `${passed.length} passed, ${flaky.length} flaky, ${healed.length} healed on re-run, ${failed.length} failed`,
);
lines.push('');

function section(title, list) {
  if (list.length === 0) return;
  lines.push(`### ${title}`);
  lines.push('');
  lines.push('| Test | First error |');
  lines.push('| --- | --- |');
  for (const t of list) {
    lines.push(
      `| ${t.title.replace(/\|/g, '\\|')} | ${firstLine(t.error).replace(/\|/g, '\\|')} |`,
    );
  }
  lines.push('');
}

section('Failed', failed);
section('Healed by the re-run', healed);
section('Flaky (passed on retry)', flaky);

console.log(lines.join('\n'));
