import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateStudy = vi.fn().mockReturnValue('study-1');
const mockUpdateStudy = vi.fn();
const mockAddPdfToStudy = vi.fn();

vi.mock('@/project/ConnectionPool', () => ({
  connectionPool: {
    getActiveProjectId: () => 'proj-1',
    getActiveOrgId: () => 'org-1',
    getActiveOps: () => ({
      study: { createStudy: mockCreateStudy, updateStudy: mockUpdateStudy },
      pdf: { addPdfToStudy: mockAddPdfToStudy },
    }),
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
  selectUser: (state: any) => state.user,
}));

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: { getState: () => ({ projects: {} }) },
}));

vi.mock('@/api/google-drive', () => ({
  importFromGoogleDrive: vi.fn().mockResolvedValue({
    success: true,
    id: 'media-1',
    file: { key: 'projects/proj-1/studies/study-1/Witt2019.pdf', fileName: 'Witt2019.pdf', size: 1024, source: 'google-drive' },
  }),
}));

vi.mock('@/api/pdf-api', () => ({
  uploadPdf: vi.fn().mockResolvedValue({ key: 'k', fileName: 'f.pdf', size: 1 }),
  downloadPdf: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  fetchPdfViaProxy: vi.fn(),
  deletePdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/pdfUtils.js', () => ({
  extractPdfTitle: vi.fn().mockResolvedValue(null),
  extractPdfDoi: vi.fn().mockResolvedValue(null),
  normalizeTitle: (t: string) => t?.toLowerCase().replace(/[^\w\s]/g, '').trim() ?? '',
}));

vi.mock('@/lib/referenceLookup.js', () => ({
  fetchFromDOI: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/primitives/pdfCache.js', () => ({
  cachePdf: vi.fn().mockResolvedValue(undefined),
  clearStudyCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/errorLogger.js', () => ({
  bestEffort: (p: Promise<any>) => p?.catch?.(() => {}),
}));

vi.mock('@/components/ui/toast', () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { studyActions } from '../actions/studies';
import { extractPdfTitle, extractPdfDoi } from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import { importFromGoogleDrive } from '@/api/google-drive';
import { uploadPdf } from '@/api/pdf-api';

describe('studyActions.addBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateStudy.mockReturnValue('study-1');
  });

  it('derives study name from googleDriveFileName when pdfFileName is absent', async () => {
    await studyActions.addBatch([
      { googleDriveFileId: 'drive-1', googleDriveFileName: 'Witt2019.pdf', title: 'Witt2019' },
    ]);

    expect(mockCreateStudy).toHaveBeenCalledWith('Witt2019', '', expect.any(Object));
  });

  it('prefers pdfFileName over googleDriveFileName for study name', async () => {
    await studyActions.addBatch([
      {
        pdfData: new ArrayBuffer(8),
        pdfFileName: 'LocalFile.pdf',
        googleDriveFileId: 'drive-1',
        googleDriveFileName: 'DriveFile.pdf',
      },
    ]);

    expect(mockCreateStudy).toHaveBeenCalledWith('LocalFile', '', expect.any(Object));
  });

  it('falls back to Untitled Study when no filename is available', async () => {
    await studyActions.addBatch([{ title: 'Some Paper', doi: '10.1234/test' }]);

    expect(mockCreateStudy).toHaveBeenCalledWith('Untitled Study', '', expect.any(Object));
    expect(importFromGoogleDrive).not.toHaveBeenCalled();
    expect(uploadPdf).not.toHaveBeenCalled();
  });

  it('routes Google Drive files through import and downloads for metadata extraction', async () => {
    vi.mocked(extractPdfTitle).mockResolvedValueOnce('Actual Paper Title');
    vi.mocked(extractPdfDoi).mockResolvedValueOnce('10.1234/extracted');
    vi.mocked(fetchFromDOI).mockResolvedValueOnce({
      title: 'Actual Paper Title',
      doi: '10.1234/extracted',
      firstAuthor: 'Witt C',
      publicationYear: 2019,
      authors: 'Witt C, Lee D',
      journal: 'Nature',
      abstract: 'We studied...',
      url: null,
      type: 'journal-article',
      volume: null,
      issue: null,
      pages: null,
    });

    await studyActions.addBatch([
      { googleDriveFileId: 'drive-1', googleDriveFileName: 'Witt2019.pdf', title: 'Witt2019' },
    ]);

    expect(importFromGoogleDrive).toHaveBeenCalledWith('drive-1', 'proj-1', 'study-1');
    expect(mockAddPdfToStudy).toHaveBeenCalledWith(
      'study-1',
      expect.objectContaining({ source: 'google-drive', fileName: 'Witt2019.pdf' }),
      'primary',
    );
    expect(mockUpdateStudy).toHaveBeenCalledWith(
      'study-1',
      expect.objectContaining({
        originalTitle: 'Actual Paper Title',
        doi: '10.1234/extracted',
        firstAuthor: 'Witt C',
        publicationYear: 2019,
        journal: 'Nature',
        fileName: 'Witt2019.pdf',
      }),
    );
  });

  it('sets fileName on study even when PDF has no extractable metadata', async () => {
    vi.mocked(extractPdfTitle).mockResolvedValueOnce(null);
    vi.mocked(extractPdfDoi).mockResolvedValueOnce(null);

    await studyActions.addBatch([
      { googleDriveFileId: 'drive-1', googleDriveFileName: 'Witt2019.pdf', title: 'Witt2019' },
    ]);

    expect(mockUpdateStudy).toHaveBeenCalledTimes(1);
    const updates = mockUpdateStudy.mock.calls[0][1];
    expect(updates.fileName).toBe('Witt2019.pdf');
    expect(updates.originalTitle).toBeUndefined();
  });

  it('routes local PDFs through uploadPdf', async () => {
    await studyActions.addBatch([
      { pdfData: new ArrayBuffer(8), pdfFileName: 'Local.pdf', title: 'Local' },
    ]);

    expect(uploadPdf).toHaveBeenCalledWith(
      'org-1', 'proj-1', 'study-1',
      expect.any(ArrayBuffer),
      'Local.pdf',
    );
    expect(importFromGoogleDrive).not.toHaveBeenCalled();
  });

  it('counts successes and manual PDFs correctly across a mixed batch', async () => {
    mockCreateStudy
      .mockReturnValueOnce('s1')
      .mockReturnValueOnce('s2')
      .mockImplementationOnce(() => { throw new Error('boom'); })
      .mockReturnValueOnce('s4');

    const result = await studyActions.addBatch([
      { googleDriveFileId: 'd1', googleDriveFileName: 'A.pdf', title: 'A' },
      { title: 'B', pdfUrl: 'https://x.com/b.pdf', pdfAccessible: false },
      { title: 'Fails' },
      { title: 'D' },
    ]);

    expect(result.successCount).toBe(3);
    expect(result.manualPdfCount).toBe(1);
  });
});
