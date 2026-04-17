/* global console, process */

// Run with:
// pnpm user:make-admin:local -- --email test@example.com
// Or simply:
// pnpm user:make-admin:local -- test@example.com

import { spawnSync } from 'node:child_process';

// Load environment variables from .env
import dotenv from 'dotenv';
dotenv.config();

function parseArgs(argv) {
  const args = {
    email: null,
    dryRun: false,
  };

  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    // Common separator when args are forwarded from pnpm/npm scripts.
    if (token === '--') {
      continue;
    }

    if (token === '--email' || token === '-e') {
      args.email = argv[i + 1] || null;
      i++;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token.startsWith('-')) {
      throw new Error(`Unknown flag: ${token}`);
    }

    positionals.push(token);
  }

  if (!args.email && positionals.length > 0) {
    args.email = positionals[0];
  }

  return args;
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runWranglerD1Execute({ command, json = true }) {
  const args = ['wrangler', 'd1', 'execute', 'corates-db', '--local'];
  if (json) args.push('--json');
  args.push('--command', command);

  const result = spawnSync('pnpm', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const message = stderr || stdout || `wrangler exited with code ${result.status}`;
    throw new Error(message);
  }

  return (result.stdout || '').trim();
}

function extractRowsFromWranglerJson(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { rows: null, raw: stdout };
  }

  const statements = Array.isArray(parsed) ? parsed : [parsed];

  const rows = [];
  for (const stmt of statements) {
    if (Array.isArray(stmt?.results)) {
      rows.push(...stmt.results);
    }
  }

  return { rows, raw: parsed };
}

function printUsage() {
  console.log(`Usage:
  pnpm user:make-admin:local -- --email someone@example.com
  pnpm user:make-admin:local -- someone@example.com

Options:
  --email, -e   Email address to promote
  --dry-run     Prints the SQL that would run without executing it

Alternative:
  - Set ADMIN_EMAIL in your .env file or as an environment variable.

Notes:
  - Uses Cloudflare Wrangler to update the LOCAL D1 database (corates-db).
  - Make sure your local dev server has been run at least once to create the DB.`);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err?.message || err));
    printUsage();
    process.exit(2);
  }

  const email = normalizeEmail(args.email || process.env.ADMIN_EMAIL);

  if (!email || !isValidEmail(email)) {
    console.error('A valid email is required.');
    printUsage();
    process.exit(2);
  }

  const selectSql = `SELECT id, email, role FROM user WHERE lower(email) = lower(${sqlString(
    email,
  )}) LIMIT 5;`;

  const updateSql = `UPDATE user SET role = 'admin', updatedAt = unixepoch() WHERE lower(email) = lower(${sqlString(
    email,
  )});`;

  if (args.dryRun) {
    console.log('[dry-run] Would run:');
    console.log(selectSql);
    console.log(updateSql);
    console.log(selectSql);
    return;
  }

  console.log(`Looking for user: ${email}`);

  const beforeJson = runWranglerD1Execute({ command: selectSql, json: true });
  const before = extractRowsFromWranglerJson(beforeJson);

  if (!before.rows || before.rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  if (before.rows.length > 1) {
    console.error(`Multiple users matched email ${email}; refusing to proceed.`);
    console.error('Result rows:', JSON.stringify(before.rows, null, 2));
    process.exit(1);
  }

  const currentRole = before.rows[0]?.role ?? null;
  if (currentRole === 'admin') {
    console.log(`User ${email} is already an admin.`);
    return;
  }

  console.log(`Promoting ${email} from "${currentRole || 'user'}" to "admin"...`);

  runWranglerD1Execute({ command: updateSql, json: true });

  const afterJson = runWranglerD1Execute({ command: selectSql, json: true });
  const after = extractRowsFromWranglerJson(afterJson);

  console.log('Updated user role in local DB:');
  console.log(JSON.stringify(after.rows?.[0] || null, null, 2));
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
