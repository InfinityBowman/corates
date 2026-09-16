import { describe, it, expect, vi } from 'vitest';
import { drainLoads, type DocumentLoader } from '../document-loader';

vi.mock('@/config/sentry', () => ({ captureException: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const task = <T>(promise: Promise<T>) => ({ toPromise: () => promise });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function fakeManager() {
  const opens: Array<{ name: string; pages: ReturnType<typeof deferred<void>> }> = [];
  const closed: string[] = [];
  const manager = {
    closeDocument: vi.fn((id: string) => {
      closed.push(id);
      return task(Promise.resolve());
    }),
    openDocumentBuffer: vi.fn(({ name }: { name: string }) => {
      const pages = deferred<void>();
      opens.push({ name, pages });
      return task(
        Promise.resolve({ documentId: `doc-${opens.length}`, task: task(pages.promise) }),
      );
    }),
  };
  const loader: DocumentLoader = {
    docManager: manager as unknown as DocumentLoader['docManager'],
    activeDocumentId: null,
    loadedPdfId: undefined,
    pending: null,
    loading: false,
  };
  return { manager, opens, closed, loader };
}

const request = (id: string) => ({
  pdfData: new ArrayBuffer(1),
  selectedPdfId: id,
  pdfFileName: `${id}.pdf`,
});

describe('drainLoads', () => {
  it('opens the queued request and stays busy until the pages are in', async () => {
    const { loader, opens } = fakeManager();
    loader.pending = request('a');
    const done = drainLoads(loader);
    await flush();
    expect(opens.map(o => o.name)).toEqual(['a.pdf']);
    expect(loader.activeDocumentId).toBe('doc-1');
    expect(loader.loading).toBe(true);
    opens[0].pages.resolve();
    await done;
    expect(loader.loading).toBe(false);
    expect(loader.loadedPdfId).toBe('a');
  });

  it('a request arriving mid-load is not dropped, only the newest opens, and the first closes', async () => {
    const { loader, opens, closed } = fakeManager();
    loader.pending = request('a');
    const done = drainLoads(loader);
    await flush();
    loader.pending = request('b');
    void drainLoads(loader);
    loader.pending = request('c');
    await flush();
    expect(opens).toHaveLength(1);
    opens[0].pages.resolve();
    await flush();
    expect(closed).toEqual(['doc-1']);
    expect(opens.map(o => o.name)).toEqual(['a.pdf', 'c.pdf']);
    opens[1].pages.resolve();
    await done;
    expect(loader.activeDocumentId).toBe('doc-2');
    expect(loader.loadedPdfId).toBe('c');
  });

  it('forgets both documents after a failed open so either can be requested again', async () => {
    const { loader, manager, closed } = fakeManager();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    manager.openDocumentBuffer.mockImplementationOnce(() => task(Promise.reject(new Error('bad'))));
    loader.loadedPdfId = 'old';
    loader.activeDocumentId = 'doc-old';
    loader.pending = request('a');
    await drainLoads(loader);
    expect(closed).toEqual(['doc-old']);
    expect(loader.activeDocumentId).toBeNull();
    expect(loader.loadedPdfId).toBeUndefined();
    expect(loader.loading).toBe(false);
    expect(loader.pending).toBeNull();
  });
});
