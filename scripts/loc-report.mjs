#!/usr/bin/env node
/* global console, process */
/**
 * LOC (Lines of Code) report script
 *
 * Usage:
 *   node scripts/loc-report.mjs           # total + per package in packages/
 *   node scripts/loc-report.mjs packages  # only packages/* breakdown
 *   node scripts/loc-report.mjs web       # only the "web" top-level dir
 *   node scripts/loc-report.mjs --code-only  # only count code files (js, jsx, ts, tsx, css, sql)
 *   node scripts/loc-report.mjs packages --code-only  # code-only for packages
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
// const ROOT = '/Users/jacobmaynard/Documents/Repos/DOSSP/';

function checkCommand(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  if (result.status !== 0) {
    if (command === 'cloc') {
      console.error(`cloc not found in PATH. Install it: https://github.com/AlDanial/cloc`);
    } else {
      console.error(`${command} not found in PATH`);
    }
    process.exit(2);
  }
}

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

// Code file extensions to include when --code-only is used
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.sql']);

function isCodeFile(file) {
  const ext = file.substring(file.lastIndexOf('.'));
  return CODE_EXTENSIONS.has(ext.toLowerCase());
}

function getTrackedFiles(codeOnly = false) {
  // Get tracked files, excluding lock files
  const result = runCommand('git', ['ls-files', '-z']);
  let files = result.stdout
    .split('\0')
    .filter(file => {
      // Exclude lock files
      return !/^(.+\/)?(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(file);
    })
    .filter(Boolean);

  // Filter to code files only if requested
  if (codeOnly) {
    files = files.filter(isCodeFile);
  }

  return files;
}

function printHeader(title) {
  console.log('');
  console.log('===========================================');
  console.log(title);
  console.log('===========================================');
}

function runCloc(fileList) {
  if (fileList.length === 0) {
    return;
  }

  // Create temporary file with file list
  const tmpDir = mkdtempSync(join(tmpdir(), 'loc-report-'));
  const tmpFile = join(tmpDir, 'filelist.txt');
  writeFileSync(tmpFile, fileList.join('\n'));

  try {
    const result = runCommand('cloc', ['--list-file=' + tmpFile, '--quiet'], {
      allowFailure: true,
    });
    if (result.status === 0) {
      console.log(result.stdout);
    }
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function runSubset(label, fileList) {
  if (fileList.length === 0) {
    return;
  }
  console.log(`\n--- ${label} (${fileList.length} files) ---`);
  runCloc(fileList);
}

function main() {
  // Check required commands
  checkCommand('git');
  checkCommand('cloc');

  const args = process.argv.slice(2);
  const codeOnly = args.includes('--code-only') || args.includes('-c');
  const filter = args.find(arg => arg !== '--code-only' && arg !== '-c'); // Optional filter: 'packages' or specific dir

  // Get tracked files
  let trackedFiles = getTrackedFiles(codeOnly);

  if (trackedFiles.length === 0) {
    console.error('No tracked files found.');
    process.exit(1);
  }

  // Apply filter if specified
  if (filter) {
    if (filter === 'packages') {
      trackedFiles = trackedFiles.filter(file => file.startsWith('packages/'));
    } else {
      trackedFiles = trackedFiles.filter(file => file.startsWith(`${filter}/`));
    }
  }

  // Per-package breakdown (packages/*)
  const packageFiles = trackedFiles.filter(file => file.startsWith('packages/'));
  if (packageFiles.length > 0) {
    const header =
      codeOnly ? 'Per package (packages/*) - Code files only' : 'Per package (packages/*)';
    printHeader(header);

    // Group files by package
    const packages = new Map();
    for (const file of packageFiles) {
      const parts = file.split('/');
      if (parts.length >= 2 && parts[0] === 'packages') {
        const pkg = parts[1];
        if (!packages.has(pkg)) {
          packages.set(pkg, []);
        }
        packages.get(pkg).push(file);
      }
    }

    // Sort packages and run cloc for each
    const sortedPackages = Array.from(packages.keys()).sort();
    for (const pkg of sortedPackages) {
      const pkgFiles = packages.get(pkg);
      runSubset(`packages/${pkg}`, pkgFiles);
    }
  } else {
    console.log('');
    console.log('No packages/ directory detected or no tracked files under packages/.');
  }

  // Total (tracked files)
  const totalHeader =
    codeOnly ? 'Total (Git-tracked files - Code files only)' : 'Total (Git-tracked files)';
  printHeader(totalHeader);
  runCloc(trackedFiles);
}

try {
  main();
} catch (err) {
  console.error('Error:', err.message || err);
  process.exit(1);
}
