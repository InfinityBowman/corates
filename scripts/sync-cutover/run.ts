/**
 * The cutover driver (CORATES-MAPPING.md §9). Run with:
 *
 *   pnpm tsx scripts/sync-cutover/run.ts <command> ...
 *
 * Commands:
 *
 *   transform <exports-dir> <out-dir>
 *     Read every `<projectId>.json` old-plane export (patched formatVersion 2
 *     — see old-exporter-patch.md) from exports-dir, write
 *     `<projectId>.snapshot.json` engine snapshots and a `report.json` into
 *     out-dir. Fails hard on any invalid export.
 *
 *   import <out-dir> --url <worker-origin> --token <SYNC_ADMIN_TOKEN>
 *     POST every snapshot in out-dir to the NEW worker's
 *     `/api/sync-admin/<projectId>/import`.
 *
 *   verify <exports-dir> --url <worker-origin> --token <SYNC_ADMIN_TOKEN>
 *     Fetch each project's engine export back and run the §9 invariant
 *     checks against the original old-plane export. Exits non-zero on any
 *     violation — the unfreeze gate.
 *
 * The three stages are separate on purpose: transform runs before the
 * freeze ends (its output is inspectable), import is the one destructive
 * step, and verify decides the unfreeze.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { transformProjectExport } from '../../packages/workers/src/sync/transform';
import { verifyProjectMigration } from '../../packages/workers/src/sync/verify';

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function arg(flag: string): string {
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) fail(`missing ${flag} <value>`);
  return process.argv[index + 1];
}

function exportFiles(dir: string): string[] {
  const files = readdirSync(dir).filter(
    file => file.endsWith('.json') && !file.endsWith('.snapshot.json') && file !== 'report.json',
  );
  if (files.length === 0) fail(`no export files in ${dir}`);
  return files.sort();
}

function projectIdOf(file: string): string {
  return basename(file, '.json');
}

async function adminFetch(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    fail(`${init?.method ?? 'GET'} ${url} → ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

const [, , command] = process.argv;

if (command === 'transform') {
  const [, , , exportsDir, outDir] = process.argv;
  if (!exportsDir || !outDir) fail('usage: transform <exports-dir> <out-dir>');
  mkdirSync(outDir, { recursive: true });

  const reports: Record<string, unknown>[] = [];
  for (const file of exportFiles(exportsDir)) {
    const projectId = projectIdOf(file);
    const oldExport = JSON.parse(readFileSync(join(exportsDir, file), 'utf8'));
    const { snapshot, report } = transformProjectExport(oldExport);
    if (snapshot.workspaceId !== projectId) {
      fail(`${file}: export projectId "${snapshot.workspaceId}" does not match file name`);
    }
    writeFileSync(join(outDir, `${projectId}.snapshot.json`), JSON.stringify(snapshot));
    reports.push(report as unknown as Record<string, unknown>);
    console.log(
      `✔ ${projectId}: ${report.studies} studies, ${report.checklists} checklists, ` +
        `${report.answers} answers, ${report.fieldSeeds} field seeds` +
        (report.droppedAnswerKeys.length ? `, ${report.droppedAnswerKeys.length} dropped keys` : '') +
        (report.warnings.length ? `, ${report.warnings.length} WARNINGS` : ''),
    );
    for (const warning of report.warnings) console.warn(`  ⚠ ${warning}`);
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(reports, null, 2));
  console.log(`\n${reports.length} projects transformed → ${outDir}`);
} else if (command === 'import') {
  const [, , , outDir] = process.argv;
  if (!outDir) fail('usage: import <out-dir> --url <origin> --token <token>');
  const origin = arg('--url');
  const token = arg('--token');

  const files = readdirSync(outDir)
    .filter(file => file.endsWith('.snapshot.json'))
    .sort();
  if (files.length === 0) fail(`no snapshots in ${outDir}`);

  const run = async () => {
    for (const file of files) {
      const projectId = basename(file, '.snapshot.json');
      const snapshot = readFileSync(join(outDir, file), 'utf8');
      const result = await adminFetch(`${origin}/api/sync-admin/${projectId}/import`, token, {
        method: 'POST',
        body: snapshot,
      });
      console.log(`✔ ${projectId}: imported ${String(result.imported)} rows`);
    }
    console.log(`\n${files.length} projects imported`);
  };
  run().catch(err => fail(String(err)));
} else if (command === 'verify') {
  const [, , , exportsDir] = process.argv;
  if (!exportsDir) fail('usage: verify <exports-dir> --url <origin> --token <token>');
  const origin = arg('--url');
  const token = arg('--token');

  const run = async () => {
    let failed = 0;
    for (const file of exportFiles(exportsDir)) {
      const projectId = projectIdOf(file);
      const oldExport = JSON.parse(readFileSync(join(exportsDir, file), 'utf8'));
      const engineExport = await adminFetch(`${origin}/api/sync-admin/${projectId}/export`, token);
      const result = verifyProjectMigration(oldExport, engineExport);
      if (result.ok) {
        console.log(`✔ ${projectId}: invariants hold`);
      } else {
        failed++;
        console.error(`✖ ${projectId}: ${result.violations.length} violations`);
        for (const violation of result.violations) console.error(`    ${violation}`);
      }
    }
    if (failed > 0) fail(`${failed} project(s) failed verification — do NOT unfreeze`);
    console.log('\nAll projects verified. Safe to unfreeze.');
  };
  run().catch(err => fail(String(err)));
} else {
  fail('usage: run.ts <transform|import|verify> ... (see file header)');
}
