/**
 * Tests for db.js - Unified Dexie database
 *
 * Phase 1 of Dexie migration: Verify database schema and basic operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Reset the database before importing to get a fresh instance
let db, deleteProjectData, clearAllData;

describe('db.js - Unified Dexie Database', () => {
  beforeEach(async () => {
    // Import db instance and helper functions
    // Test isolation achieved via afterEach cleanup (deleteProjectData/clearAllData)
    const module = await import('../db.js');
    db = module.db;
    deleteProjectData = module.deleteProjectData;
    clearAllData = module.clearAllData;

    // Ensure database is open
    if (!db.isOpen()) {
      await db.open();
    }
  });

  afterEach(async () => {
    // Clear all data between tests
    if (db.isOpen()) {
      await db.projects.clear();
      await db.pdfs.clear();
      await db.avatars.clear();
      await db.formStates.clear();
      await db.localChecklists.clear();
      await db.localChecklistPdfs.clear();
    }
  });

  describe('Database Initialization', () => {
    it('should open database successfully', () => {
      expect(db.isOpen()).toBe(true);
      expect(db.name).toBe('corates');
    });

    it('should have all expected tables', () => {
      // y-dexie creates internal tables for Y.Doc updates (prefixed with $)
      const userTables = db.tables
        .map(t => t.name)
        .filter(n => !n.startsWith('$'))
        .sort();
      expect(userTables).toEqual([
        'avatars',
        'formStates',
        'localChecklistPdfs',
        'localChecklists',
        'pdfs',
        'projects',
      ]);
    });
  });

  describe('Projects Table', () => {
    it('should add and retrieve a project', async () => {
      const project = {
        id: 'proj-123',
        orgId: 'org-456',
        updatedAt: Date.now(),
      };

      await db.projects.add(project);
      const retrieved = await db.projects.get('proj-123');

      expect(retrieved.id).toBe('proj-123');
      expect(retrieved.orgId).toBe('org-456');
    });

    it('should query projects by orgId', async () => {
      await db.projects.bulkAdd([
        { id: 'proj-1', orgId: 'org-A', updatedAt: 1 },
        { id: 'proj-2', orgId: 'org-A', updatedAt: 2 },
        { id: 'proj-3', orgId: 'org-B', updatedAt: 3 },
      ]);

      const orgAProjects = await db.projects.where('orgId').equals('org-A').toArray();

      expect(orgAProjects).toHaveLength(2);
      expect(orgAProjects.map(p => p.id).sort()).toEqual(['proj-1', 'proj-2']);
    });
  });

  describe('PDFs Table', () => {
    it('should add and retrieve a PDF cache entry', async () => {
      const pdfEntry = {
        id: 'proj-1:study-1:test.pdf',
        projectId: 'proj-1',
        studyId: 'study-1',
        fileName: 'test.pdf',
        data: new ArrayBuffer(100),
        size: 100,
        cachedAt: Date.now(),
      };

      await db.pdfs.add(pdfEntry);
      const retrieved = await db.pdfs.get('proj-1:study-1:test.pdf');

      expect(retrieved.projectId).toBe('proj-1');
      expect(retrieved.studyId).toBe('study-1');
      expect(retrieved.fileName).toBe('test.pdf');
      expect(retrieved.size).toBe(100);
    });

    it('should query PDFs by projectId', async () => {
      await db.pdfs.bulkAdd([
        {
          id: 'proj-1:study-1:a.pdf',
          projectId: 'proj-1',
          studyId: 'study-1',
          fileName: 'a.pdf',
          data: new ArrayBuffer(10),
          size: 10,
          cachedAt: 1,
        },
        {
          id: 'proj-1:study-2:b.pdf',
          projectId: 'proj-1',
          studyId: 'study-2',
          fileName: 'b.pdf',
          data: new ArrayBuffer(20),
          size: 20,
          cachedAt: 2,
        },
        {
          id: 'proj-2:study-1:c.pdf',
          projectId: 'proj-2',
          studyId: 'study-1',
          fileName: 'c.pdf',
          data: new ArrayBuffer(30),
          size: 30,
          cachedAt: 3,
        },
      ]);

      const proj1Pdfs = await db.pdfs.where('projectId').equals('proj-1').toArray();

      expect(proj1Pdfs).toHaveLength(2);
      expect(proj1Pdfs.map(p => p.fileName).sort()).toEqual(['a.pdf', 'b.pdf']);
    });

    it('should order PDFs by cachedAt for LRU eviction', async () => {
      await db.pdfs.bulkAdd([
        {
          id: 'p:s:newest.pdf',
          projectId: 'p',
          studyId: 's',
          fileName: 'newest.pdf',
          data: new ArrayBuffer(10),
          size: 10,
          cachedAt: 3000,
        },
        {
          id: 'p:s:oldest.pdf',
          projectId: 'p',
          studyId: 's',
          fileName: 'oldest.pdf',
          data: new ArrayBuffer(10),
          size: 10,
          cachedAt: 1000,
        },
        {
          id: 'p:s:middle.pdf',
          projectId: 'p',
          studyId: 's',
          fileName: 'middle.pdf',
          data: new ArrayBuffer(10),
          size: 10,
          cachedAt: 2000,
        },
      ]);

      const ordered = await db.pdfs.orderBy('cachedAt').toArray();

      expect(ordered.map(p => p.fileName)).toEqual(['oldest.pdf', 'middle.pdf', 'newest.pdf']);
    });
  });

  describe('deleteProjectData', () => {
    it('should delete project and associated PDFs', async () => {
      await db.projects.add({ id: 'proj-to-delete', orgId: 'org-1', updatedAt: 1 });
      await db.projects.add({ id: 'proj-to-keep', orgId: 'org-1', updatedAt: 2 });

      await db.pdfs.bulkAdd([
        {
          id: 'proj-to-delete:s1:a.pdf',
          projectId: 'proj-to-delete',
          studyId: 's1',
          fileName: 'a.pdf',
          data: new ArrayBuffer(10),
          size: 10,
          cachedAt: 1,
        },
        {
          id: 'proj-to-delete:s2:b.pdf',
          projectId: 'proj-to-delete',
          studyId: 's2',
          fileName: 'b.pdf',
          data: new ArrayBuffer(10),
          size: 10,
          cachedAt: 2,
        },
        {
          id: 'proj-to-keep:s1:c.pdf',
          projectId: 'proj-to-keep',
          studyId: 's1',
          fileName: 'c.pdf',
          data: new ArrayBuffer(10),
          size: 10,
          cachedAt: 3,
        },
      ]);

      await deleteProjectData('proj-to-delete');

      const projects = await db.projects.toArray();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('proj-to-keep');

      const pdfs = await db.pdfs.toArray();
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0].projectId).toBe('proj-to-keep');
    });
  });

  describe('clearAllData', () => {
    it('should clear all session tables', async () => {
      await db.projects.add({ id: 'p1', orgId: 'o1', updatedAt: 1 });
      await db.pdfs.add({
        id: 'p1:s1:a.pdf',
        projectId: 'p1',
        studyId: 's1',
        fileName: 'a.pdf',
        data: new ArrayBuffer(10),
        size: 10,
        cachedAt: 1,
      });

      await clearAllData();

      expect(await db.projects.count()).toBe(0);
      expect(await db.pdfs.count()).toBe(0);
    });

    it('should not clear local checklists', async () => {
      await db.localChecklists.add({
        id: 'local-123',
        name: 'Practice',
        type: 'AMSTAR2',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await clearAllData();

      expect(await db.localChecklists.count()).toBe(1);
    });
  });
});
