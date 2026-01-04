#!/usr/bin/env node
/* global console, process */
/**
 * Reset production D1 database, clear R2 bucket, and redeploy workers
 *
 * Usage: node scripts/reset-db-prod.mjs
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// const BUCKET_NAME = 'corates-pdfs-prod';
const DB_NAME = 'corates-db-prod';

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    ...options,
  });

  if (result.status !== 0 && !options.allowFailure) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const message = stderr || stdout || `${command} exited with code ${result.status}`;
    throw new Error(message);
  }

  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    status: result.status,
  };
}

function runWranglerD1Execute(command, options = {}) {
  const args = [
    'wrangler',
    'd1',
    'execute',
    DB_NAME,
    '--remote',
    '--env',
    'production',
    '--yes',
    '--command',
    command,
  ];

  return runCommand('pnpm', args, options);
}

function runWranglerD1MigrationsApply() {
  const args = [
    'wrangler',
    'd1',
    'migrations',
    'apply',
    DB_NAME,
    '--remote',
    '--env',
    'production',
  ];

  return runCommand('pnpm', args);
}

function deployWorkers() {
  const args = ['wrangler', 'deploy', '--env', 'production'];
  return runCommand('pnpm', args);
}

async function main() {
  console.log('==========================================');
  console.log('  Resetting Production D1 Database & R2');
  console.log('==========================================');
  console.log('');

  try {
    // Step 1: Drop existing tables (in reverse dependency order to respect foreign keys)
    console.log('');
    console.log('Step 1: Dropping existing tables...');

    // Drop tables in reverse dependency order (children before parents)
    // This ensures foreign key constraints don't prevent dropping
    const tables = [
      // App-specific tables (children first)
      'project_invitations',
      'project_members',
      'mediaFiles',
      'projects',
      'subscriptions',
      // Better Auth organization plugin tables
      'invitation',
      'member',
      'organization',
      // Better Auth core tables
      'twoFactor',
      'verification',
      'account',
      'session',
      'user',
      // Observability tables
      'stripe_event_ledger',
    ];

    for (const table of tables) {
      console.log(`  Dropping table: ${table}`);
      runWranglerD1Execute(`DROP TABLE IF EXISTS ${table};`);
    }

    // Also drop migration tracking tables if they exist
    // Wrangler D1 stores migration history in system tables
    console.log('  Dropping migration tracking tables...');
    runWranglerD1Execute(`DROP TABLE IF EXISTS __drizzle_migrations;`, { allowFailure: true });
    runWranglerD1Execute(`DROP TABLE IF EXISTS _cf_KV;`, { allowFailure: true });

    // Step 3: Run migrations
    console.log('');
    console.log('Step 3: Running migrations...');
    runWranglerD1MigrationsApply();
    console.log('  Migrations completed');

    // Verify critical tables were created
    console.log('  Verifying tables were created...');
    const verifyResult = runWranglerD1Execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='verification';",
      { allowFailure: true },
    );
    if (!verifyResult.stdout || !verifyResult.stdout.includes('verification')) {
      console.error('  WARNING: verification table was not created!');
      console.error('  Migration may have failed or been skipped.');
      throw new Error('Migration verification failed: verification table missing');
    }
    console.log('  Verification table exists');

    // Step 4: Deploy workers
    console.log('');
    console.log('Step 4: Deploying workers...');
    deployWorkers();
    console.log('  Workers deployed');

    console.log('');
    console.log('==========================================');
    console.log('  Database reset and workers deployed!');
    console.log('==========================================');
  } catch (err) {
    console.error('');
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
