/* global console, process */

// Run with:
// pnpm user:create-orcid:local -- --email test@example.com --orcid-id 0000-0001-2345-6789
// Or simply:
// pnpm user:create-orcid:local -- test@example.com 0000-0001-2345-6789

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Load environment variables from .env (or .dev.vars if renamed)
import dotenv from 'dotenv';
dotenv.config();

function parseArgs(argv) {
  const args = {
    email: null,
    orcidId: null,
    name: null,
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

    if (token === '--orcid-id' || token === '-o') {
      args.orcidId = argv[i + 1] || null;
      i++;
      continue;
    }

    if (token === '--name' || token === '-n') {
      args.name = argv[i + 1] || null;
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

  // First positional is email, second is ORCID ID
  if (!args.email && positionals.length > 0) {
    args.email = positionals[0];
  }
  if (!args.orcidId && positionals.length > 1) {
    args.orcidId = positionals[1];
  }

  return args;
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeOrcidId(orcidId) {
  if (!orcidId) return null;
  // Remove hyphens and @orcid.org suffix
  let normalized = orcidId.replace(/@orcid\.org$/i, '').replace(/-/g, '');
  return normalized.trim();
}

function isValidOrcidId(orcidId) {
  const normalized = normalizeOrcidId(orcidId);
  // ORCID IDs are 16 characters (digits, last can be X)
  return normalized && /^[\dXx]{16}$/.test(normalized);
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
  pnpm user:create-orcid:local -- --email test@example.com --orcid-id 0000-0001-2345-6789
  pnpm user:create-orcid:local -- test@example.com 0000-0001-2345-6789

Options:
  --email, -e       Email address for the user (required)
  --orcid-id, -o   ORCID ID (e.g., 0000-0001-2345-6789) (required)
  --name, -n        User's display name (optional, defaults to email)
  --dry-run         Prints the SQL that would run without executing it

Notes:
  - Uses Cloudflare Wrangler to insert into the LOCAL D1 database (corates-db).
  - Make sure your local dev server has been run at least once to create the DB.
  - Creates a user with an ORCID account linked.
  - The email will be set to the synthetic format (orcidId@orcid.org) if not provided.`);
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

  const email = normalizeEmail(args.email || process.env.TEST_EMAIL);
  const orcidId = normalizeOrcidId(args.orcidId || process.env.TEST_ORCID_ID);
  const name = args.name || email?.split('@')[0] || 'Test User';

  if (!email || !isValidEmail(email)) {
    console.error('A valid email is required.');
    printUsage();
    process.exit(2);
  }

  if (!orcidId || !isValidOrcidId(orcidId)) {
    console.error('A valid ORCID ID is required (16 digits, e.g., 0000-0001-2345-6789).');
    printUsage();
    process.exit(2);
  }

  // Check if user already exists
  const checkUserSql = `SELECT id, email FROM user WHERE lower(email) = lower(${sqlString(email)}) LIMIT 1;`;
  const checkAccountSql = `SELECT id, userId, accountId FROM account WHERE providerId = 'orcid' AND accountId = ${sqlString(normalizeOrcidId(orcidId))} LIMIT 1;`;

  // Generate IDs
  const userId = randomUUID();
  const accountId = randomUUID();
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

  // Create user SQL
  const createUserSql = `INSERT INTO user (
    id, name, email, emailVerified, createdAt, updatedAt
  ) VALUES (
    ${sqlString(userId)},
    ${sqlString(name)},
    ${sqlString(email)},
    0,
    ${now},
    ${now}
  );`;

  // Create ORCID account SQL
  const createAccountSql = `INSERT INTO account (
    id, userId, accountId, providerId, createdAt, updatedAt
  ) VALUES (
    ${sqlString(accountId)},
    ${sqlString(userId)},
    ${sqlString(normalizeOrcidId(orcidId))},
    'orcid',
    ${now},
    ${now}
  );`;

  if (args.dryRun) {
    console.log('[dry-run] Would run:');
    console.log(checkUserSql);
    console.log(checkAccountSql);
    console.log(createUserSql);
    console.log(createAccountSql);
    return;
  }

  // Check if user already exists
  const checkUserJson = runWranglerD1Execute({ command: checkUserSql, json: true });
  const checkUser = extractRowsFromWranglerJson(checkUserJson);

  if (checkUser.rows && checkUser.rows.length > 0) {
    console.error(`User with email ${email} already exists.`);
    console.error('Existing user:', JSON.stringify(checkUser.rows[0], null, 2));
    process.exit(1);
  }

  // Check if ORCID account already exists
  const checkAccountJson = runWranglerD1Execute({ command: checkAccountSql, json: true });
  const checkAccount = extractRowsFromWranglerJson(checkAccountJson);

  if (checkAccount.rows && checkAccount.rows.length > 0) {
    console.error(`ORCID account ${orcidId} is already linked to another user.`);
    console.error('Existing account:', JSON.stringify(checkAccount.rows[0], null, 2));
    process.exit(1);
  }

  console.log(`Creating test user with ORCID account...`);
  console.log(`  Email: ${email}`);
  console.log(`  Name: ${name}`);
  console.log(`  ORCID ID: ${orcidId} (normalized: ${normalizeOrcidId(orcidId)})`);

  // Create user
  runWranglerD1Execute({ command: createUserSql, json: false });

  // Create account
  runWranglerD1Execute({ command: createAccountSql, json: false });

  // Verify creation
  const verifyUserSql = `SELECT id, email, name FROM user WHERE id = ${sqlString(userId)};`;
  const verifyAccountSql = `SELECT id, userId, accountId, providerId FROM account WHERE id = ${sqlString(accountId)};`;

  const verifyUserJson = runWranglerD1Execute({ command: verifyUserSql, json: true });
  const verifyAccountJson = runWranglerD1Execute({ command: verifyAccountSql, json: true });

  const verifyUser = extractRowsFromWranglerJson(verifyUserJson);
  const verifyAccount = extractRowsFromWranglerJson(verifyAccountJson);

  console.log('\nCreated user:');
  console.log(JSON.stringify(verifyUser.rows?.[0] || null, null, 2));
  console.log('\nCreated ORCID account:');
  console.log(JSON.stringify(verifyAccount.rows?.[0] || null, null, 2));
  console.log('\nYou can now test merging accounts with this user.');
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
