/**
 * Bug hunt: stale async PDF delivery contaminates the currently open preview.
 *
 * Reachable flow (today): every "View PDF" button (StudyPdfSection, ToDoTab,
 * ReconcileTab, CompletedTab) calls pdfActions.view(), which opens the drawer
 * and then asynchronously downloads the PDF. Neither closePreview() nor a
 * subsequent openPreview() cancels or invalidates the in-flight download, and
 * setData()/setError() carry no identity of which view() they belong to.
 *
 * Scenario: user clicks View on PDF A (uncached, slow download), closes the
 * drawer, clicks View on PDF B (fast). When A's download finally resolves,
 * pdfActions.view's continuation calls setData(bytesOfA), which overwrites
 * the drawer that is currently showing PDF B. The drawer header says B but
 * the rendered document is A. If A's download instead fails, setError()
 * replaces B's already-rendered document with an error panel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/pdf-api', () => ({
  uploadPdf: vi.fn(),
  downloadPdf: vi.fn(),
  deletePdf: vi.fn(),
}));
vi.mock('@/primitives/pdfCache.js', () => ({
  cachePdf: vi.fn(async () => {}),
  removeCachedPdf: vi.fn(async () => {}),
  getCachedPdf: vi.fn(async () => null),
}));
vi.mock('@/lib/errorLogger.js', () => ({
  bestEffort: vi.fn(async (p: Promise<unknown>) => {
    try {
      await p;
    } catch {
      // swallowed, mirrors production bestEffort
    }
  }),
}));
vi.mock('@/lib/pdfUtils.js', () => ({
  extractPdfDoi: vi.fn(async () => null),
  extractPdfTitle: vi.fn(async () => null),
}));
vi.mock('@/lib/referenceLookup.js', () => ({
  fetchFromDOI: vi.fn(async () => null),
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({}) },
  selectUser: () => ({ id: 'user-1' }),
}));
vi.mock('@/project/ConnectionPool', () => ({
  connectionPool: {
    getActiveProjectId: () => 'proj-1',
    getActiveOrgId: () => 'org-1',
    getActiveOps: () => null,
    getEntry: () => null,
  },
}));

import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import { pdfActions } from '@/project/actions/pdfs';
import { downloadPdf } from '@/api/pdf-api';
import type { PdfEntry } from '@/stores/projectStore';

function makePdf(id: string, fileName: string): PdfEntry {
  return {
    id,
    fileName,
    key: `key-${id}`,
    size: 100,
    uploadedBy: 'user-1',
    uploadedAt: 1,
    tag: 'primary',
    title: null,
    firstAuthor: null,
    publicationYear: null,
    journal: null,
    doi: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('pdf preview stale-response race (pdfActions.view + pdfPreviewStore)', () => {
  beforeEach(() => {
    usePdfPreviewStore.setState({
      isOpen: false,
      projectId: null,
      studyId: null,
      pdf: null,
      pdfData: null,
      loading: false,
      error: null,
    });
    vi.mocked(downloadPdf).mockReset();
  });

  it('a late download for a superseded preview must not replace the currently open PDF data', async () => {
    const slowA = deferred<ArrayBuffer>();
    const fastB = deferred<ArrayBuffer>();
    vi.mocked(downloadPdf).mockImplementation((_org, _proj, _study, fileName) =>
      fileName === 'a.pdf' ? slowA.promise : fastB.promise,
    );

    // User clicks View on PDF A; download is slow.
    const viewA = pdfActions.view('study-1', makePdf('pdf-a', 'a.pdf'));

    // User closes the drawer while A is still downloading, then views PDF B.
    usePdfPreviewStore.getState().closePreview();
    const viewB = pdfActions.view('study-1', makePdf('pdf-b', 'b.pdf'));

    const dataB = new ArrayBuffer(8);
    fastB.resolve(dataB);
    await viewB;

    // Sanity: drawer now shows B with B's bytes.
    expect(usePdfPreviewStore.getState().pdf?.id).toBe('pdf-b');
    expect(usePdfPreviewStore.getState().pdfData).toBe(dataB);

    // A's download finally resolves.
    const dataA = new ArrayBuffer(4);
    slowA.resolve(dataA);
    await viewA;

    const state = usePdfPreviewStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.pdf?.id).toBe('pdf-b');
    // The drawer titled "b.pdf" must still display B's bytes, not A's.
    expect(state.pdfData).toBe(dataB);
  });

  it('a late download FAILURE for a superseded preview must not put the current PDF into an error state', async () => {
    const slowA = deferred<ArrayBuffer>();
    const fastB = deferred<ArrayBuffer>();
    vi.mocked(downloadPdf).mockImplementation((_org, _proj, _study, fileName) =>
      fileName === 'a.pdf' ? slowA.promise : fastB.promise,
    );

    const viewA = pdfActions.view('study-1', makePdf('pdf-a', 'a.pdf'));
    usePdfPreviewStore.getState().closePreview();
    const viewB = pdfActions.view('study-1', makePdf('pdf-b', 'b.pdf'));

    const dataB = new ArrayBuffer(8);
    fastB.resolve(dataB);
    await viewB;
    expect(usePdfPreviewStore.getState().pdfData).toBe(dataB);
    expect(usePdfPreviewStore.getState().error).toBeNull();

    slowA.reject(new Error('network dropped'));
    await viewA;

    const state = usePdfPreviewStore.getState();
    expect(state.pdf?.id).toBe('pdf-b');
    // B rendered successfully; A's stale failure must not surface an error over it.
    expect(state.error).toBeNull();
  });
});
