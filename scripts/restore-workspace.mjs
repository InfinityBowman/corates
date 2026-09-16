// Restore one project from a workspace backup object (docs/guides/database.md,
// "Workspace backups"). Fetches the envelope from the backups bucket, re-inserts
// the D1 rows that are missing, imports the workspace through the sync-admin
// route, and checks the live row count against the snapshot.
//
//   pnpm restore:workspace -- --env staging --project <id> --date 2026-09-16 --dry-run
//   pnpm restore:workspace -- --env staging --project <id> --key deleted/<id>/<iso>.json.gz --pre-restore --yes
//
// Runs wrangler from packages/web so the account id in wrangler.jsonc applies.
// SYNC_ADMIN_TOKEN comes from packages/web/.env.<env>.

import { spawnSync } from 'node:child_process';
import { gunzipSync, gzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import dotenv from 'dotenv';

const ROOT = resolve(import.meta.dirname, '..');
const WEB_DIR = join(ROOT, 'packages/web');

const ENVS = {
  staging: {
    bucket: 'corates-backups-staging',
    d1: 'corates-db-staging',
    appUrl: 'https://staging.corates.org',
  },
  production: {
    bucket: 'corates-backups-prod',
    d1: 'corates-db-prod',
    appUrl: 'https://corates.org',
  },
};

// Drizzle serialised these as ISO strings; D1 stores unix seconds.
const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt', 'joinedAt']);

function parseArgs(argv) {
  const args = { preRestore: false, dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') continue;
    if (token === '--pre-restore') args.preRestore = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--yes' || token === '-y') args.yes = true;
    else if (['--env', '--project', '--date', '--key', '--file'].includes(token)) {
      args[token.slice(2)] = argv[++i];
    } else throw new Error(`Unknown flag: ${token}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:
  pnpm restore:workspace -- --env <staging|production> --project <id> (--date YYYY-MM-DD | --key <object key> | --file <local .json.gz>) [--pre-restore] [--dry-run] [--yes]

  --date         Daily snapshot: snapshots/<project>/<date>.json.gz
  --key          Any object key in the backups bucket (deleted/... for a deleted project)
  --file         A local envelope instead of fetching one
  --pre-restore  Export the current workspace to <prefix>/<now>-pre-restore.json.gz first
  --dry-run      Fetch and inspect, write nothing
  --yes          Required for a real restore`);
}

function run(cmd, cmdArgs, { cwd = WEB_DIR } = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${cmd} exited ${result.status}`).trim());
  }
  return result.stdout;
}

function wrangler(...cmdArgs) {
  return run('pnpm', ['exec', 'wrangler', ...cmdArgs]);
}

function d1Rows(env, sql) {
  const out = wrangler(
    'd1',
    'execute',
    ENVS[env].d1,
    '--remote',
    '--env',
    env,
    '--json',
    '--command',
    sql,
  );
  const parsed = JSON.parse(out);
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap(s => s.results ?? []);
}

function sqlValue(column, value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (TIMESTAMP_COLUMNS.has(column)) return String(Math.floor(Date.parse(value) / 1000));
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insertOrIgnore(table, row) {
  const columns = Object.keys(row);
  const values = columns.map(c => sqlValue(c, row[c]));
  return `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
}

async function admin(cfg, op, body) {
  const res = await fetch(`${cfg.appUrl}/api/sync-admin/${cfg.project}/${op}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${cfg.token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${op} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function fetchEnvelope(cfg, args) {
  if (args.file) return JSON.parse(gunzipSync(readFileSync(args.file)).toString('utf8'));
  const tmp = join(mkdtempSync(join(tmpdir(), 'corates-restore-')), 'envelope.json.gz');
  wrangler('r2', 'object', 'get', `${cfg.bucket}/${cfg.key}`, '--file', tmp, '--remote');
  return JSON.parse(gunzipSync(readFileSync(tmp)).toString('utf8'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!ENVS[args.env] || !args.project || !(args.date || args.key || args.file)) {
    usage();
    process.exit(2);
  }
  if (!args.dryRun && !args.yes) {
    console.error('Refusing to write without --yes (use --dry-run to inspect).');
    process.exit(2);
  }

  const envFile = dotenv.parse(readFileSync(join(WEB_DIR, `.env.${args.env}`)));
  const cfg = {
    env: args.env,
    project: args.project,
    bucket: ENVS[args.env].bucket,
    key: args.key ?? (args.date ? `snapshots/${args.project}/${args.date}.json.gz` : null),
    appUrl: ENVS[args.env].appUrl,
    token: envFile.SYNC_ADMIN_TOKEN,
  };
  if (!cfg.token) throw new Error(`SYNC_ADMIN_TOKEN must be set in packages/web/.env.${args.env}`);

  console.log(`Source: ${args.file ?? `${cfg.bucket}/${cfg.key}`}`);
  const envelope = fetchEnvelope(cfg, args);
  if (envelope.project?.id !== cfg.project) {
    throw new Error(`Envelope is for project ${envelope.project?.id}, not ${cfg.project}`);
  }
  const snapshotRows = envelope.workspace.rows.length;
  console.log(
    `Envelope: "${envelope.project.name}", ${envelope.members.length} members, ${envelope.mediaFiles.length} media files, ${snapshotRows} workspace rows, exported ${envelope.workspace.exportedAt}`,
  );

  const before = await admin(cfg, 'stats');
  console.log(`Current workspace: ${before.rows.live} live rows, version ${before.currentVersion}`);

  const projectExists =
    d1Rows(cfg.env, `SELECT id FROM projects WHERE id = '${cfg.project.replaceAll("'", "''")}';`)
      .length > 0;
  const statements = [
    insertOrIgnore('projects', envelope.project),
    ...envelope.members.map(m => insertOrIgnore('project_members', m)),
    ...envelope.mediaFiles.map(f => insertOrIgnore('mediaFiles', f)),
  ];
  console.log(
    projectExists ?
      'D1 project row exists; members and media files re-inserted only where missing.'
    : 'D1 project row is missing; it will be re-inserted with its members and media files.',
  );

  if (args.dryRun) {
    console.log('[dry-run] Would run:');
    for (const s of statements) console.log('  ' + s);
    console.log(
      `[dry-run] Would POST ${snapshotRows} rows to /api/sync-admin/${cfg.project}/import`,
    );
    return;
  }

  if (args.preRestore) {
    const current = await admin(cfg, 'export');
    const preKey = `snapshots/${cfg.project}/${new Date().toISOString()}-pre-restore.json.gz`;
    const tmp = join(mkdtempSync(join(tmpdir(), 'corates-restore-')), 'pre-restore.json.gz');
    writeFileSync(tmp, gzipSync(JSON.stringify({ ...envelope, workspace: current })));
    wrangler(
      'r2',
      'object',
      'put',
      `${cfg.bucket}/${preKey}`,
      '--file',
      tmp,
      '--remote',
      '--content-type',
      'application/gzip',
    );
    console.log(`Pre-restore copy: ${cfg.bucket}/${preKey}`);
  }

  // The owning organization and creator user must still exist; a foreign key
  // failure here means the envelope's createdBy or orgId needs a live target.
  wrangler(
    'd1',
    'execute',
    ENVS[cfg.env].d1,
    '--remote',
    '--env',
    cfg.env,
    '--command',
    statements.join(' '),
  );

  const imported = await admin(cfg, 'import', envelope.workspace);
  console.log(`Imported ${imported.imported} rows at version ${imported.version}`);

  const after = await admin(cfg, 'stats');
  const ok = after.rows.live === snapshotRows;
  console.log(
    `${ok ? 'OK' : 'MISMATCH'}: live rows ${after.rows.live}, snapshot rows ${snapshotRows}`,
  );
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
