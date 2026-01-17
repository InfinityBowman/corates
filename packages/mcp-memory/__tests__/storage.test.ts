/**
 * Tests for SQLite storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStorage } from '../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('SqliteStorage', () => {
  let storage: SqliteStorage;
  let testDir: string;

  beforeEach(async () => {
    // Create temp directory for test database
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-memory-test-'));
    storage = new SqliteStorage(testDir);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    // Clean up test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create database and tables', async () => {
      const dbPath = path.join(testDir, '.mcp', 'memory.db');
      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new entry and return id', async () => {
      const id = await storage.create({
        type: 'fact',
        title: 'Test Fact',
        content: 'This is a test fact about the codebase.',
        tags: ['test', 'example'],
        confidence: 0.7,
        embedding: new Array(384).fill(0.1),
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should store entry with all fields', async () => {
      const id = await storage.create({
        type: 'decision',
        title: 'Use TypeScript',
        content: 'We use TypeScript for type safety.',
        tags: ['architecture'],
        source: {
          type: 'discussion',
          reference: 'PR #42',
        },
        confidence: 0.8,
        embedding: new Array(384).fill(0.2),
      });

      const entry = await storage.getById(id);
      expect(entry).not.toBeNull();
      expect(entry!.type).toBe('decision');
      expect(entry!.title).toBe('Use TypeScript');
      expect(entry!.source?.type).toBe('discussion');
      expect(entry!.source?.reference).toBe('PR #42');
    });
  });

  describe('getById', () => {
    it('should return null for non-existent id', async () => {
      const entry = await storage.getById('non-existent-id');
      expect(entry).toBeNull();
    });

    it('should return entry for valid id', async () => {
      const id = await storage.create({
        type: 'pattern',
        title: 'Test Pattern',
        content: 'This is a pattern.',
        tags: [],
        confidence: 0.5,
        embedding: new Array(384).fill(0),
      });

      const entry = await storage.getById(id);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(id);
    });
  });

  describe('update', () => {
    it('should update entry content and increment version', async () => {
      const id = await storage.create({
        type: 'procedure',
        title: 'Deploy Process',
        content: 'Step 1: Build',
        tags: [],
        confidence: 0.6,
        embedding: new Array(384).fill(0.3),
      });

      await storage.update(id, {
        content: 'Step 1: Build\nStep 2: Deploy',
      });

      const entry = await storage.getById(id);
      expect(entry!.content).toBe('Step 1: Build\nStep 2: Deploy');
      expect(entry!.version).toBe(2);
    });

    it('should throw for non-existent entry', async () => {
      await expect(storage.update('non-existent', { content: 'new content' })).rejects.toThrow(
        'Entry not found',
      );
    });
  });

  describe('supersede', () => {
    it('should create new entry and mark old as superseded', async () => {
      const oldId = await storage.create({
        type: 'fact',
        title: 'Old Fact',
        content: 'This is outdated.',
        tags: [],
        confidence: 0.5,
        embedding: new Array(384).fill(0.1),
      });

      const newId = await storage.supersede(oldId, {
        type: 'fact',
        title: 'New Fact',
        content: 'This is the updated information.',
        tags: [],
        confidence: 0.7,
        embedding: new Array(384).fill(0.2),
      });

      const oldEntry = await storage.getById(oldId);
      expect(oldEntry!.supersededBy).toBe(newId);

      const newEntry = await storage.getById(newId);
      expect(newEntry!.supersededBy).toBeUndefined();
    });

    it('should throw if entry already superseded', async () => {
      const oldId = await storage.create({
        type: 'fact',
        title: 'Old Fact',
        content: 'This is outdated.',
        tags: [],
        confidence: 0.5,
        embedding: new Array(384).fill(0.1),
      });

      await storage.supersede(oldId, {
        type: 'fact',
        title: 'New Fact',
        content: 'Updated.',
        tags: [],
        confidence: 0.7,
        embedding: new Array(384).fill(0.2),
      });

      await expect(
        storage.supersede(oldId, {
          type: 'fact',
          title: 'Another Fact',
          content: 'Cannot supersede twice.',
          tags: [],
          confidence: 0.7,
          embedding: new Array(384).fill(0.3),
        }),
      ).rejects.toThrow('Entry already superseded');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Create test entries with different embeddings
      await storage.create({
        type: 'fact',
        title: 'Database Uses SQLite',
        content: 'The project uses SQLite for local storage.',
        tags: ['database', 'architecture'],
        confidence: 0.8,
        embedding: [1, 0, 0, ...new Array(381).fill(0)],
      });

      await storage.create({
        type: 'decision',
        title: 'Chose React over Vue',
        content: 'We chose React because of ecosystem.',
        tags: ['frontend', 'architecture'],
        confidence: 0.7,
        embedding: [0, 1, 0, ...new Array(381).fill(0)],
      });

      await storage.create({
        type: 'pattern',
        title: 'Error Handling Pattern',
        content: 'All errors use AppError class.',
        tags: ['patterns', 'errors'],
        confidence: 0.6,
        embedding: [0, 0, 1, ...new Array(381).fill(0)],
      });
    });

    it('should return entries sorted by relevance', async () => {
      // Query embedding similar to first entry
      const queryEmbedding = [0.9, 0.1, 0, ...new Array(381).fill(0)];

      const results = await storage.search({ query: 'database' }, queryEmbedding);

      expect(results.results.length).toBeGreaterThan(0);
      expect(results.results[0].title).toBe('Database Uses SQLite');
    });

    it('should filter by type', async () => {
      const queryEmbedding = [0.5, 0.5, 0.5, ...new Array(381).fill(0)];

      const results = await storage.search(
        { query: 'architecture', types: ['decision'] },
        queryEmbedding,
      );

      expect(results.results.every(r => r.type === 'decision')).toBe(true);
    });

    it('should filter by confidence', async () => {
      const queryEmbedding = [0.5, 0.5, 0.5, ...new Array(381).fill(0)];

      const results = await storage.search({ query: 'test', minConfidence: 0.75 }, queryEmbedding);

      expect(results.results.every(r => r.confidence >= 0.75)).toBe(true);
    });

    it('should exclude superseded entries by default', async () => {
      const oldId = await storage.create({
        type: 'fact',
        title: 'Old Entry',
        content: 'This will be superseded.',
        tags: [],
        confidence: 0.9,
        embedding: [0.8, 0.8, 0.8, ...new Array(381).fill(0)],
      });

      await storage.supersede(oldId, {
        type: 'fact',
        title: 'New Entry',
        content: 'This replaces the old one.',
        tags: [],
        confidence: 0.9,
        embedding: [0.8, 0.8, 0.8, ...new Array(381).fill(0)],
      });

      const queryEmbedding = [0.8, 0.8, 0.8, ...new Array(381).fill(0)];
      const results = await storage.search({ query: 'test' }, queryEmbedding);

      const titles = results.results.map(r => r.title);
      expect(titles).not.toContain('Old Entry');
      expect(titles).toContain('New Entry');
    });
  });

  describe('findSimilar', () => {
    it('should find entries above similarity threshold', async () => {
      await storage.create({
        type: 'fact',
        title: 'Similar Entry',
        content: 'This is similar.',
        tags: [],
        confidence: 0.7,
        embedding: [1, 0, 0, ...new Array(381).fill(0)],
      });

      await storage.create({
        type: 'fact',
        title: 'Different Entry',
        content: 'This is different.',
        tags: [],
        confidence: 0.7,
        embedding: [0, 1, 0, ...new Array(381).fill(0)],
      });

      const similar = await storage.findSimilar(
        [0.99, 0.01, 0, ...new Array(381).fill(0)],
        0.9,
        10,
      );

      expect(similar.length).toBe(1);
      expect(similar[0].entry.title).toBe('Similar Entry');
    });
  });
});
