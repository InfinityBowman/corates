import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      expect(retrieved!.byteLength).toBe(100);
      expect(new Uint8Array(retrieved!)[0]).toBe(42);
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
      expect(retrieved!.byteLength).toBe(200);
      expect(new Uint8Array(retrieved!)[0]).toBe(2);
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
    const MB = 1024 * 1024;

    /** Seed a row whose recorded `size` is large enough to drive eviction
     *  without allocating a matching buffer. */
    async function seed(fileName: string, size: number, lastAccessedAt: number, cachedAt = 1000) {
      await db.pdfs.put({
        id: `project-1:study-1:${fileName}`,
        projectId: 'project-1',
        studyId: 'study-1',
        fileName,
        data: new ArrayBuffer(8),
        size,
        cachedAt,
        lastAccessedAt,
      });
    }

    it('updates recency when a cached PDF is opened', async () => {
      await seed('opened.pdf', 8, 1000);

      expect(await getCachedPdf('project-1', 'study-1', 'opened.pdf')).not.toBeNull();

      await vi.waitFor(async () => {
        const row = await db.pdfs.get('project-1:study-1:opened.pdf');
        expect(row!.lastAccessedAt).toBeGreaterThan(1000);
      });
    });

    it('leaves the download time alone when a PDF is opened', async () => {
      await seed('opened.pdf', 8, 1000);

      await getCachedPdf('project-1', 'study-1', 'opened.pdf');

      await vi.waitFor(async () => {
        const row = await db.pdfs.get('project-1:study-1:opened.pdf');
        expect(row!.lastAccessedAt).toBeGreaterThan(1000);
        expect(row!.cachedAt).toBe(1000);
      });
    });

    it('evicts the least recently opened entry, not the oldest download', async () => {
      // Downloaded first but opened recently: must survive.
      await seed('old-download.pdf', 100 * MB, 9000, 1000);
      // Downloaded later but never opened since: must be evicted first.
      await seed('stale.pdf', 100 * MB, 2000, 5000);

      await cachePdf('project-1', 'study-2', 'incoming.pdf', new ArrayBuffer(1000));

      expect(await getCachedPdf('project-1', 'study-1', 'stale.pdf')).toBeNull();
      expect(await getCachedPdf('project-1', 'study-1', 'old-download.pdf')).not.toBeNull();
      expect(await getCachedPdf('project-1', 'study-2', 'incoming.pdf')).not.toBeNull();
    });

    it('promotes an entry out of the eviction path once it is opened', async () => {
      await seed('a.pdf', 100 * MB, 2000, 1000);
      await seed('b.pdf', 100 * MB, 3000, 2000);

      // Opening the older entry makes the other one the eviction candidate.
      await getCachedPdf('project-1', 'study-1', 'a.pdf');
      await vi.waitFor(async () => {
        const row = await db.pdfs.get('project-1:study-1:a.pdf');
        expect(row!.lastAccessedAt).toBeGreaterThan(3000);
      });

      await cachePdf('project-1', 'study-2', 'incoming.pdf', new ArrayBuffer(1000));

      expect(await getCachedPdf('project-1', 'study-1', 'b.pdf')).toBeNull();
      expect(await getCachedPdf('project-1', 'study-1', 'a.pdf')).not.toBeNull();
    });

    it('keeps the cache under the limit when every entry is evictable', async () => {
      await seed('a.pdf', 100 * MB, 2000);
      await seed('b.pdf', 100 * MB, 3000);

      await cachePdf('project-1', 'study-2', 'incoming.pdf', new ArrayBuffer(1000));

      expect(await getCacheSize()).toBeLessThanOrEqual(200 * MB);
    });
  });
});
