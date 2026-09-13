#!/usr/bin/env node
/**
 * Parse every emitted client chunk so a dependency shipping syntax newer than
 * build.target fails the build instead of a user's browser.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'acorn';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', 'dist', 'client', 'assets');

// Matches the oldest browser in build.target (vite.config.ts). Raise both together.
const ECMA_VERSION = 2021;

let files;
try {
  files = readdirSync(ASSETS_DIR).filter(file => file.endsWith('.js'));
} catch {
  console.error(`No client build at ${ASSETS_DIR}. Run 'pnpm --filter web build' first.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`No .js files in ${ASSETS_DIR}. The build did not emit a client bundle.`);
  process.exit(1);
}

const failures = [];
for (const file of files) {
  try {
    parse(readFileSync(join(ASSETS_DIR, file), 'utf-8'), {
      ecmaVersion: ECMA_VERSION,
      sourceType: 'module',
    });
  } catch (error) {
    failures.push(`  ${file}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(
    `${failures.length} of ${files.length} client chunks use syntax newer than ES${ECMA_VERSION}:`,
  );
  console.error(failures.join('\n'));
  console.error(
    '\nEither lower build.target in vite.config.ts so the syntax is transpiled, or raise\n' +
      'ECMA_VERSION here and in build.target to move the supported browser floor.',
  );
  process.exit(1);
}

console.log(`${files.length} client chunks parse as ES${ECMA_VERSION}`);
