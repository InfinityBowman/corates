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

function runWranglerD1ExecuteFile(filePath) {
  const args = [
    'wrangler',
    'd1',
    'execute',
    DB_NAME,
    '--remote',
    '--env',
    'production',
    '--yes',
    '--file',
    filePath,
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
    // Step 1: Drop existing tables
    console.log('');
    console.log('Step 1: Dropping existing tables...');
    const tables = [
      'mediaFiles',
      'project_members',
      'projects',
      'verification',
      'account',
      'session',
      'user',
    ];

    for (const table of tables) {
      console.log(`  Dropping table: ${table}`);
      runWranglerD1Execute(`DROP TABLE IF EXISTS ${table};`);
    }

    // Step 2: Delete and recreate R2 bucket
    // console.log('');
    // console.log('Step 2: Clearing R2 bucket...');
    // console.log(`  Deleting bucket: ${BUCKET_NAME}`);
    // const deleteResult = deleteR2Bucket();
    // if (deleteResult.status !== 0) {
    //   console.log(`    Note: ${deleteResult.stderr || 'Bucket may not exist or already deleted'}`);
    // } else {
    //   console.log('    Bucket deleted');
    // }

    // console.log(`  Creating bucket: ${BUCKET_NAME}`);
    // const createResult = createR2Bucket();
    // if (createResult.status !== 0) {
    //   console.log(
    //     `    Warning: Failed to create bucket: ${createResult.stderr || createResult.stdout}`,
    //   );
    //   throw new Error('Failed to recreate R2 bucket');
    // } else {
    //   console.log('    Bucket created');
    // }

    // Step 3: Run migration
    console.log('');
    console.log('Step 3: Running migration...');
    const migrationPath = join(ROOT, 'migrations', '0001_init.sql');
    runWranglerD1ExecuteFile(migrationPath);
    console.log('  Migration completed');

    // Step 4: Deploy workers
    console.log('');
    console.log('Step 4: Deploying workers...');
    deployWorkers();
    console.log('  Workers deployed');

    console.log('');
    console.log('==========================================');
    console.log('  Database reset, R2 cleared, and workers deployed!');
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
