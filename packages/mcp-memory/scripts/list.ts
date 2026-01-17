#!/usr/bin/env tsx
/**
 * CLI viewer for memory database entries
 *
 * Run with: pnpm --filter @corates/mcp-memory list
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { DATABASE_PATH } from '../src/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const dbPath = path.join(repoRoot, DATABASE_PATH);

interface KnowledgeRow {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string;
  source_type: string | null;
  source_reference: string | null;
  confidence: number;
  version: number;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function main(): void {
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.log('No memory database found at:', dbPath);
    console.log('Run the MCP server or seed script to create it.');
    process.exit(0);
  }

  const db = new Database(dbPath, { readonly: true });

  // Get stats
  const countRow = db
    .prepare('SELECT COUNT(*) as count FROM knowledge_entries WHERE superseded_by IS NULL')
    .get() as { count: number };
  const supersededRow = db
    .prepare('SELECT COUNT(*) as count FROM knowledge_entries WHERE superseded_by IS NOT NULL')
    .get() as { count: number };

  console.log('='.repeat(80));
  console.log('CORATES MEMORY DATABASE');
  console.log('='.repeat(80));
  console.log(`Location: ${dbPath}`);
  console.log(`Active entries: ${countRow.count}`);
  console.log(`Superseded entries: ${supersededRow.count}`);
  console.log('='.repeat(80));

  // Get entries by type
  const types = ['fact', 'decision', 'procedure', 'pattern'];

  for (const type of types) {
    const rows = db
      .prepare(
        `SELECT * FROM knowledge_entries 
         WHERE type = ? AND superseded_by IS NULL 
         ORDER BY confidence DESC, updated_at DESC`,
      )
      .all(type) as KnowledgeRow[];

    if (rows.length === 0) continue;

    console.log(`\n${type.toUpperCase()}S (${rows.length})`);
    console.log('-'.repeat(80));

    for (const row of rows) {
      const tags = JSON.parse(row.tags) as string[];
      const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
      const confidence = (row.confidence * 100).toFixed(0);

      console.log(`\n  ${row.title}${tagStr}`);
      console.log(`  ID: ${row.id} | v${row.version} | ${confidence}% confidence`);
      console.log(`  Updated: ${formatDate(row.updated_at)}`);

      if (row.source_type) {
        const sourceRef = row.source_reference ? ` (${row.source_reference})` : '';
        console.log(`  Source: ${row.source_type}${sourceRef}`);
      }

      // Show truncated content
      const contentLines = row.content.split('\n');
      const preview = contentLines.slice(0, 3).join('\n  ');
      console.log(`  ---`);
      console.log(`  ${truncate(preview, 200)}`);
    }
  }

  db.close();

  console.log('\n' + '='.repeat(80));
  console.log('TIP: Use a SQLite browser for full access to .mcp/memory.db');
  console.log('='.repeat(80) + '\n');
}

main();
