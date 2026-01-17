/**
 * SQLite storage implementation for the memory system
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type {
  MemoryStorage,
  KnowledgeEntry,
  KnowledgeType,
  SourceType,
  SearchQuery,
  SearchResponse,
  SearchResult,
} from '../types.js';
import {
  DATABASE_PATH,
  SCHEMA_VERSION,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  DEFAULT_MIN_CONFIDENCE,
  RANKING_WEIGHTS,
  RECENCY_DECAY_DAYS,
} from '../constants.js';

// Database row type (snake_case from SQLite)
interface KnowledgeRow {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string;
  source_type: string | null;
  source_reference: string | null;
  confidence: number;
  embedding: string;
  version: number;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Compute recency score (0-1, higher is more recent)
 */
function computeRecencyScore(updatedAt: string): number {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate <= 0) return 1;
  if (daysSinceUpdate >= RECENCY_DECAY_DAYS) return 0;

  // Linear decay over RECENCY_DECAY_DAYS
  return 1 - daysSinceUpdate / RECENCY_DECAY_DAYS;
}

/**
 * Convert database row to KnowledgeEntry
 */
function rowToEntry(row: KnowledgeRow): KnowledgeEntry {
  return {
    id: row.id,
    type: row.type as KnowledgeType,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
    source:
      row.source_type ?
        {
          type: row.source_type as SourceType,
          reference: row.source_reference ?? undefined,
        }
      : undefined,
    confidence: row.confidence,
    embedding: JSON.parse(row.embedding) as number[],
    version: row.version,
    supersededBy: row.superseded_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteStorage implements MemoryStorage {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(repoRoot: string) {
    this.dbPath = path.join(repoRoot, DATABASE_PATH);
  }

  async initialize(): Promise<void> {
    // Ensure .mcp directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create metadata table first
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Check current schema version
    const versionRow = this.db
      .prepare('SELECT value FROM memory_metadata WHERE key = ?')
      .get('schema_version') as { value: string } | undefined;

    const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

    if (currentVersion < SCHEMA_VERSION) {
      // Run migrations
      this.migrateToV1();

      // Update schema version
      this.db
        .prepare('INSERT OR REPLACE INTO memory_metadata (key, value) VALUES (?, ?)')
        .run('schema_version', SCHEMA_VERSION.toString());
    }
  }

  private migrateToV1(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('fact', 'decision', 'procedure', 'pattern')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        source_type TEXT,
        source_reference TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        embedding TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        superseded_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entries_type ON knowledge_entries(type);
      CREATE INDEX IF NOT EXISTS idx_entries_superseded ON knowledge_entries(superseded_by);
      CREATE INDEX IF NOT EXISTS idx_entries_confidence ON knowledge_entries(confidence);
      CREATE INDEX IF NOT EXISTS idx_entries_updated ON knowledge_entries(updated_at);
    `);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async search(query: SearchQuery, queryEmbedding: number[]): Promise<SearchResponse> {
    if (!this.db) throw new Error('Database not initialized');

    const limit = Math.min(query.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const minConfidence = query.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

    // Build SQL query with filters
    let sql = `
      SELECT * FROM knowledge_entries
      WHERE confidence >= ?
    `;
    const params: (string | number)[] = [minConfidence];

    // Filter out superseded entries unless explicitly requested
    if (!query.includeSuperseded) {
      sql += ' AND superseded_by IS NULL';
    }

    // Filter by types
    if (query.types && query.types.length > 0) {
      const placeholders = query.types.map(() => '?').join(', ');
      sql += ` AND type IN (${placeholders})`;
      params.push(...query.types);
    }

    // Filter by tags (any match)
    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => "tags LIKE '%' || ? || '%'").join(' OR ');
      sql += ` AND (${tagConditions})`;
      params.push(...query.tags);
    }

    const rows = this.db.prepare(sql).all(...params) as KnowledgeRow[];

    // Compute similarity and rank
    const scoredResults = rows.map(row => {
      const embedding = JSON.parse(row.embedding) as number[];
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      const recency = computeRecencyScore(row.updated_at);

      const relevanceScore =
        RANKING_WEIGHTS.similarity * similarity +
        RANKING_WEIGHTS.confidence * row.confidence +
        RANKING_WEIGHTS.recency * recency;

      return { row, similarity, relevanceScore };
    });

    // Sort by relevance score descending
    scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Take top results
    const topResults = scoredResults.slice(0, limit);

    const results: SearchResult[] = topResults.map(({ row, relevanceScore }) => ({
      id: row.id,
      type: row.type as SearchResult['type'],
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags) as string[],
      confidence: row.confidence,
      relevanceScore,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      results,
      totalMatches: scoredResults.length,
    };
  }

  async create(
    entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO knowledge_entries (
        id, type, title, content, tags, source_type, source_reference,
        confidence, embedding, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `,
      )
      .run(
        id,
        entry.type,
        entry.title,
        entry.content,
        JSON.stringify(entry.tags),
        entry.source?.type ?? null,
        entry.source?.reference ?? null,
        entry.confidence,
        JSON.stringify(entry.embedding),
        now,
        now,
      );

    return id;
  }

  async update(id: string, entry: Partial<KnowledgeEntry>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Entry not found: ${id}`);
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (entry.title !== undefined) {
      updates.push('title = ?');
      params.push(entry.title);
    }
    if (entry.content !== undefined) {
      updates.push('content = ?');
      params.push(entry.content);
    }
    if (entry.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(entry.tags));
    }
    if (entry.confidence !== undefined) {
      updates.push('confidence = ?');
      params.push(entry.confidence);
    }
    if (entry.embedding !== undefined) {
      updates.push('embedding = ?');
      params.push(JSON.stringify(entry.embedding));
    }

    // Always increment version and update timestamp
    updates.push('version = version + 1');
    updates.push('updated_at = ?');
    params.push(now);

    params.push(id);

    this.db
      .prepare(`UPDATE knowledge_entries SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);
  }

  async supersede(
    oldId: string,
    newEntry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getById(oldId);
    if (!existing) {
      throw new Error(`Entry not found: ${oldId}`);
    }
    if (existing.supersededBy) {
      throw new Error(`Entry already superseded by: ${existing.supersededBy}`);
    }

    // Create new entry
    const newId = await this.create(newEntry);

    // Mark old entry as superseded
    this.db
      .prepare('UPDATE knowledge_entries SET superseded_by = ? WHERE id = ?')
      .run(newId, oldId);

    return newId;
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(id) as
      | KnowledgeRow
      | undefined;

    return row ? rowToEntry(row) : null;
  }

  async findSimilar(
    embedding: number[],
    threshold: number,
    limit: number,
  ): Promise<Array<{ entry: KnowledgeEntry; similarity: number }>> {
    if (!this.db) throw new Error('Database not initialized');

    // Get all non-superseded entries
    const rows = this.db
      .prepare('SELECT * FROM knowledge_entries WHERE superseded_by IS NULL')
      .all() as KnowledgeRow[];

    const results = rows
      .map(row => {
        const entryEmbedding = JSON.parse(row.embedding) as number[];
        const similarity = cosineSimilarity(embedding, entryEmbedding);
        return { entry: rowToEntry(row), similarity };
      })
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }
}
