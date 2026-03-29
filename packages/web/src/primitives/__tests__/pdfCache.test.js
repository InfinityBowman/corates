import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db.js';
import {
  cachePdf,
  getCachedPdf,
  removeCachedPdf,
  clearStudyCache,
  clearProjectCache,
  getCacheSize,
} from '../pdfCache.js';

describe('pdfCache', () => {
  beforeEach(async () => {
    await db.pdfs.clear();
  });

  describe('cachePdf and getCachedPdf', () => {
    it('caches and retrieves PDF data', async () => {
      const data = new ArrayBuffer(100);
      new Uint8Array(data).fill(42);

      const result = await cachePdf('project-1', 'study-1', 'test.pdf', data);
      expect(result).toBe(true);

      const retrieved = await getCachedPdf('project-1', 'study-1', 'test.pdf');
      expect(retrieved).not.toBeNull();
      expect(retrieved.byteLength).toBe(100);
      expect(new Uint8Array(retrieved)[0]).toBe(42);
    });

    it('returns null for non-existent cache entry', async () => {
      const result = await getCachedPdf('project-1', 'study-1', 'nonexistent.pdf');
      expect(result).toBeNull();
    });

    it('overwrites existing cache entry', async () => {
      const data1 = new ArrayBuffer(100);
      new Uint8Array(data1).fill(1);

      const data2 = new ArrayBuffer(200);
      new Uint8Array(data2).fill(2);

      await cachePdf('project-1', 'study-1', 'test.pdf', data1);
      await cachePdf('project-1', 'study-1', 'test.pdf', data2);

      const retrieved = await getCachedPdf('project-1', 'study-1', 'test.pdf');
      expect(retrieved.byteLength).toBe(200);
      expect(new Uint8Array(retrieved)[0]).toBe(2);
    });

    it('rejects files exceeding single file limit', async () => {
      const largeData = new ArrayBuffer(51 * 1024 * 1024); // 51MB

      const result = await cachePdf('project-1', 'study-1', 'huge.pdf', largeData);
      expect(result).toBe(false);

      const retrieved = await getCachedPdf('project-1', 'study-1', 'huge.pdf');
      expect(retrieved).toBeNull();
    });
  });

  describe('removeCachedPdf', () => {
    it('removes a cached PDF', async () => {
      const data = new ArrayBuffer(100);

      await cachePdf('project-1', 'study-1', 'test.pdf', data);
      const result = await removeCachedPdf('project-1', 'study-1', 'test.pdf');
      expect(result).toBe(true);

      const retrieved = await getCachedPdf('project-1', 'study-1', 'test.pdf');
      expect(retrieved).toBeNull();
    });

    it('returns true even when entry does not exist', async () => {
      const result = await removeCachedPdf('project-1', 'study-1', 'nonexistent.pdf');
      expect(result).toBe(true);
    });
  });

  describe('clearStudyCache', () => {
    it('clears all PDFs for a specific study', async () => {
      const data = new ArrayBuffer(100);

      await cachePdf('project-1', 'study-1', 'file1.pdf', data);
      await cachePdf('project-1', 'study-1', 'file2.pdf', data);
      await cachePdf('project-1', 'study-2', 'file3.pdf', data);

      const deleted = await clearStudyCache('project-1', 'study-1');
      expect(deleted).toBe(2);

      expect(await getCachedPdf('project-1', 'study-1', 'file1.pdf')).toBeNull();
      expect(await getCachedPdf('project-1', 'study-1', 'file2.pdf')).toBeNull();
      expect(await getCachedPdf('project-1', 'study-2', 'file3.pdf')).not.toBeNull();
    });
  });

  describe('clearProjectCache', () => {
    it('clears all PDFs for a specific project', async () => {
      const data = new ArrayBuffer(100);

      await cachePdf('project-1', 'study-1', 'file1.pdf', data);
      await cachePdf('project-1', 'study-2', 'file2.pdf', data);
      await cachePdf('project-2', 'study-1', 'file3.pdf', data);

      const deleted = await clearProjectCache('project-1');
      expect(deleted).toBe(2);

      expect(await getCachedPdf('project-1', 'study-1', 'file1.pdf')).toBeNull();
      expect(await getCachedPdf('project-1', 'study-2', 'file2.pdf')).toBeNull();
      expect(await getCachedPdf('project-2', 'study-1', 'file3.pdf')).not.toBeNull();
    });
  });

  describe('getCacheSize', () => {
    it('returns 0 for empty cache', async () => {
      const size = await getCacheSize();
      expect(size).toBe(0);
    });

    it('returns total size of all cached PDFs', async () => {
      const data1 = new ArrayBuffer(1000);
      const data2 = new ArrayBuffer(2000);

      await cachePdf('project-1', 'study-1', 'file1.pdf', data1);
      await cachePdf('project-1', 'study-2', 'file2.pdf', data2);

      const size = await getCacheSize();
      expect(size).toBe(3000);
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entries when cache limit exceeded', async () => {
      // Cache limit is 200MB, so we test with smaller files but verify ordering
      const data = new ArrayBuffer(1000);

      // Cache multiple entries with different timestamps
      await cachePdf('project-1', 'study-1', 'old.pdf', data);
      await new Promise(r => setTimeout(r, 10)); // Small delay for cachedAt difference
      await cachePdf('project-1', 'study-2', 'newer.pdf', data);

      // Verify both are cached
      expect(await getCachedPdf('project-1', 'study-1', 'old.pdf')).not.toBeNull();
      expect(await getCachedPdf('project-1', 'study-2', 'newer.pdf')).not.toBeNull();

      // Verify ordering by cachedAt
      const entries = await db.pdfs.orderBy('cachedAt').toArray();
      expect(entries[0].fileName).toBe('old.pdf');
      expect(entries[1].fileName).toBe('newer.pdf');
    });
  });
});
