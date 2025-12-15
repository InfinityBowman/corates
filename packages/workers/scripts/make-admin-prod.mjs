/* global console, process */

// run with
// pnpm -s user:make-admin:prod -- --dry-run --email test@example.com
// Run the below to make the user (default email) an admin for real:
// pnpm -s user:make-admin:prod -- -y

import { spawnSync } from 'node:child_process';

// Load environment variables from .env (or .dev.vars if renamed)
import dotenv from 'dotenv';
dotenv.config();

function parseArgs(argv) {
  const args = {
    email: null,
    yes: false,
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

    if (token === '--yes' || token === '-y') {
      args.yes = true;
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
  // Intentionally simple validation; this is a guardrail, not a full RFC parser.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runWranglerD1Execute({ command, json = true }) {
  const args = ['wrangler', 'd1', 'execute', 'corates-db-prod', '--remote', '--env', 'production'];
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
  // Wrangler can return an array (one entry per statement) or an object.
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { rows: null, raw: stdout };
  }

  const statements = Array.isArray(parsed) ? parsed : [parsed];

  // Collect rows from any statement that has a `results` array.
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
  pnpm user:make-admin:prod -- --email someone@example.com --yes

Options:
  --email, -e   Email address to promote
  --yes, -y     Required. Confirms you intend to modify the production database.
  --dry-run     Prints the SQL that would run without executing it

Alternative:
  - Set ADMIN_EMAIL in your .env file or as an environment variable.

Notes:
  - Uses Cloudflare Wrangler to update the remote D1 database (corates-db-prod).
  - Requires you to be authenticated with Cloudflare and have access to the production DB.`);
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

  if (!args.yes && !args.dryRun) {
    console.error('Refusing to modify production DB without --yes.');
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

  const beforeJson = runWranglerD1Execute({ command: selectSql, json: true });
  const before = extractRowsFromWranglerJson(beforeJson);

  if (!before.rows || before.rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  // Guardrail: unique email should mean 1 row.
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

  runWranglerD1Execute({ command: updateSql, json: true });

  const afterJson = runWranglerD1Execute({ command: selectSql, json: true });
  const after = extractRowsFromWranglerJson(afterJson);

  console.log('Updated user role in production DB:');
  console.log(JSON.stringify(after.rows?.[0] || null, null, 2));
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
