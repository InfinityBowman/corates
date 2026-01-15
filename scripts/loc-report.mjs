#!/usr/bin/env node
/* global console, process */
/**
 * LOC (Lines of Code) report script using tokei
 *
 * Usage:
 *   node scripts/loc-report.mjs           # total + per package summary
 *   node scripts/loc-report.mjs packages  # only packages/* breakdown
 *   node scripts/loc-report.mjs web       # only packages/web
 *   node scripts/loc-report.mjs --json    # output raw JSON
 *   node scripts/loc-report.mjs --top=10  # show top N languages
 *   node scripts/loc-report.mjs --no-tests # exclude test files
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

function checkCommand(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(c('yellow', `${command} not found. Install: brew install ${command}`));
    process.exit(2);
  }
}

function runTokei(path, { excludeTests = false } = {}) {
  const args = [
    path,
    '-o',
    'json',
    '--exclude',
    'pnpm-lock.yaml',
    '--exclude',
    '*.snap',
    '--exclude',
    '*.d.ts',
  ];

  if (excludeTests) {
    args.push('--exclude', '**/__tests__/**');
    args.push('--exclude', '**/*.test.*');
    args.push('--exclude', '**/*.spec.*');
  }

  const result = spawnSync('tokei', args, {
    encoding: 'utf8',
    cwd: ROOT,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || 'tokei failed');
  }

  return JSON.parse(result.stdout);
}

function formatNumber(n) {
  return n.toLocaleString();
}

function bar(value, max, width = 30) {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return c('green', '\u2588'.repeat(filled)) + c('gray', '\u2591'.repeat(empty));
}

function printHeader(title) {
  console.log('');
  console.log(c('cyan', c('bold', `  ${title}`)));
  console.log(c('gray', '  ' + '\u2500'.repeat(60)));
}

function printLanguageTable(data, topN = null) {
  // Convert to array and sort by code
  const languages = Object.entries(data)
    .filter(([lang]) => lang !== 'Total')
    .map(([lang, stats]) => ({
      lang,
      code: stats.code,
      comments: stats.comments,
      blanks: stats.blanks,
      files: stats.reports?.length || 0,
    }))
    .sort((a, b) => b.code - a.code);

  if (languages.length === 0) {
    console.log(c('gray', '  No code files found'));
    return { totalCode: 0, totalComments: 0, totalBlanks: 0, totalFiles: 0 };
  }

  const maxCode = languages[0].code;
  const displayLangs = topN ? languages.slice(0, topN) : languages;

  // Header
  console.log(
    c('dim', '  ') +
      c('white', 'Language'.padEnd(20)) +
      c('white', 'Files'.padStart(8)) +
      c('white', 'Code'.padStart(10)) +
      c('white', 'Comments'.padStart(10)) +
      '  ' +
      c('white', 'Distribution'),
  );
  console.log(c('gray', '  ' + '\u2500'.repeat(80)));

  // eslint-disable-next-line no-unused-vars
  for (const { lang, code, comments, blanks, files } of displayLangs) {
    const langColor = getLangColor(lang);
    console.log(
      '  ' +
        c(langColor, lang.padEnd(20)) +
        c('dim', formatNumber(files).padStart(8)) +
        c('green', formatNumber(code).padStart(10)) +
        c('blue', formatNumber(comments).padStart(10)) +
        '  ' +
        bar(code, maxCode, 25),
    );
  }

  if (topN && languages.length > topN) {
    const others = languages.slice(topN);
    const otherCode = others.reduce((sum, l) => sum + l.code, 0);
    const otherComments = others.reduce((sum, l) => sum + l.comments, 0);
    const otherFiles = others.reduce((sum, l) => sum + l.files, 0);
    console.log(
      '  ' +
        c('gray', `(+${others.length} more)`.padEnd(20)) +
        c('dim', formatNumber(otherFiles).padStart(8)) +
        c('dim', formatNumber(otherCode).padStart(10)) +
        c('dim', formatNumber(otherComments).padStart(10)),
    );
  }

  // Totals
  const totalCode = languages.reduce((sum, l) => sum + l.code, 0);
  const totalComments = languages.reduce((sum, l) => sum + l.comments, 0);
  const totalBlanks = languages.reduce((sum, l) => sum + l.blanks, 0);
  const totalFiles = languages.reduce((sum, l) => sum + l.files, 0);

  console.log(c('gray', '  ' + '\u2500'.repeat(80)));
  console.log(
    '  ' +
      c('bold', 'Total'.padEnd(20)) +
      c('bold', formatNumber(totalFiles).padStart(8)) +
      c('bold', c('green', formatNumber(totalCode).padStart(10))) +
      c('bold', c('blue', formatNumber(totalComments).padStart(10))),
  );

  return { totalCode, totalComments, totalBlanks, totalFiles };
}

function getLangColor(lang) {
  const colorMap = {
    JavaScript: 'yellow',
    TypeScript: 'blue',
    JSX: 'yellow',
    TSX: 'blue',
    CSS: 'magenta',
    JSON: 'green',
    Markdown: 'white',
    SQL: 'cyan',
    HTML: 'yellow',
    'Plain Text': 'gray',
  };
  return colorMap[lang] || 'white';
}

function printPackageSummary(packages) {
  printHeader('Package Summary');

  const sorted = packages.sort((a, b) => b.code - a.code);
  const maxCode = sorted[0]?.code || 1;

  console.log(
    c('dim', '  ') +
      c('white', 'Package'.padEnd(16)) +
      c('white', 'Files'.padStart(8)) +
      c('white', 'Code'.padStart(10)) +
      c('white', 'Comments'.padStart(10)) +
      '  ' +
      c('white', 'Size'),
  );
  console.log(c('gray', '  ' + '\u2500'.repeat(70)));

  for (const pkg of sorted) {
    console.log(
      '  ' +
        c('cyan', pkg.name.padEnd(16)) +
        c('dim', formatNumber(pkg.files).padStart(8)) +
        c('green', formatNumber(pkg.code).padStart(10)) +
        c('blue', formatNumber(pkg.comments).padStart(10)) +
        '  ' +
        bar(pkg.code, maxCode, 20),
    );
  }

  const total = {
    files: sorted.reduce((sum, p) => sum + p.files, 0),
    code: sorted.reduce((sum, p) => sum + p.code, 0),
    comments: sorted.reduce((sum, p) => sum + p.comments, 0),
  };

  console.log(c('gray', '  ' + '\u2500'.repeat(70)));
  console.log(
    '  ' +
      c('bold', 'Total'.padEnd(16)) +
      c('bold', formatNumber(total.files).padStart(8)) +
      c('bold', c('green', formatNumber(total.code).padStart(10))) +
      c('bold', c('blue', formatNumber(total.comments).padStart(10))),
  );
}

function printQuickStats(data) {
  const languages = Object.entries(data).filter(([lang]) => lang !== 'Total');
  const totalCode = languages.reduce((sum, [, stats]) => sum + stats.code, 0);
  const totalComments = languages.reduce((sum, [, stats]) => sum + stats.comments, 0);
  const totalFiles = languages.reduce((sum, [, stats]) => sum + (stats.reports?.length || 0), 0);
  const ratio = totalComments > 0 ? (totalCode / totalComments).toFixed(1) : 'N/A';

  console.log('');
  console.log(
    c('dim', '  ') +
      c('white', 'Quick Stats: ') +
      c('green', `${formatNumber(totalCode)} lines`) +
      c('dim', ' | ') +
      c('blue', `${formatNumber(totalComments)} comments`) +
      c('dim', ' | ') +
      c('yellow', `${formatNumber(totalFiles)} files`) +
      c('dim', ' | ') +
      c('magenta', `${ratio}:1 code/comment ratio`),
  );
}

function main() {
  checkCommand('tokei');

  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const excludeTests = args.includes('--no-tests');
  const topMatch = args.find(a => a.startsWith('--top='));
  const topN = topMatch ? parseInt(topMatch.split('=')[1], 10) : null;
  const filter = args.find(arg => !arg.startsWith('--'));

  // Determine target path
  let targetPath = 'packages';
  if (filter && filter !== 'packages') {
    targetPath = `packages/${filter}`;
  }

  // Run tokei
  const data = runTokei(targetPath, { excludeTests });

  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Print header
  console.log('');
  console.log(c('bold', c('cyan', '  CoRATES Lines of Code Report')));
  console.log(c('gray', `  Target: ${targetPath}${excludeTests ? ' (excluding tests)' : ''}`));

  // Quick stats
  printQuickStats(data);

  // Per-package breakdown
  if (!filter || filter === 'packages') {
    const packageDirs = ['docs', 'landing', 'mcp', 'shared', 'ui', 'web', 'workers'];
    const packageStats = [];

    for (const pkg of packageDirs) {
      try {
        const pkgData = runTokei(`packages/${pkg}`, { excludeTests });
        const languages = Object.entries(pkgData).filter(([lang]) => lang !== 'Total');
        const code = languages.reduce((sum, [, stats]) => sum + stats.code, 0);
        const comments = languages.reduce((sum, [, stats]) => sum + stats.comments, 0);
        const files = languages.reduce((sum, [, stats]) => sum + (stats.reports?.length || 0), 0);

        if (code > 0) {
          packageStats.push({ name: pkg, code, comments, files });
        }
      } catch {
        // Package doesn't exist or no code
      }
    }

    if (packageStats.length > 0) {
      printPackageSummary(packageStats);
    }
  }

  // Language breakdown
  printHeader('Languages');
  printLanguageTable(data, topN);

  console.log('');
}

try {
  main();
} catch (err) {
  console.error(c('yellow', 'Error: ') + err.message);
  process.exit(1);
}
