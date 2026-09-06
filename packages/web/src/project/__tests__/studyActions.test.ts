import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStudyCreate = vi.fn().mockResolvedValue(undefined);
const mockStudyUpdate = vi.fn().mockResolvedValue(undefined);
const mockPdfAttach = vi.fn().mockResolvedValue(undefined);

vi.mock('@/project/ConnectionPool', () => ({
  connectionPool: {
    getActiveProjectId: () => 'proj-1',
    getActiveOrgId: () => 'org-1',
    getActiveClient: () => ({
      mutate: {
        study: { create: mockStudyCreate, update: mockStudyUpdate },
        pdf: { attach: mockPdfAttach },
      },
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

vi.mock('@/server/functions/google-drive.functions', () => ({
  importFromDrive: vi.fn().mockResolvedValue({
    success: true,
    id: 'media-1',
    file: {
      key: 'projects/proj-1/studies/study-1/Witt2019.pdf',
      fileName: 'Witt2019.pdf',
      size: 1024,
      source: 'google-drive',
    },
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
  normalizeTitle: (t: string) =>
    t
      ?.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim() ?? '',
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

vi.mock('@/lib/toast', () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { studyActions } from '../actions/studies';
import { extractPdfTitle, extractPdfDoi } from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import { importFromDrive } from '@/server/functions/google-drive.functions';
import { uploadPdf } from '@/api/pdf-api';

describe('studyActions.addBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudyCreate.mockResolvedValue(undefined);
  });

  it('derives study name from googleDriveFileName when pdfFileName is absent', async () => {
    await studyActions.addBatch([
      { googleDriveFileId: 'drive-1', googleDriveFileName: 'Witt2019.pdf', title: 'Witt2019' },
    ]);

    expect(mockStudyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Witt2019', description: '' }),
    );
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

    expect(mockStudyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'LocalFile', description: '' }),
    );
  });

  it('falls back to Untitled Study when no filename is available', async () => {
    await studyActions.addBatch([{ title: 'Some Paper', doi: '10.1234/test' }]);

    expect(mockStudyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Untitled Study' }),
    );
    expect(importFromDrive).not.toHaveBeenCalled();
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

    const studyId = mockStudyCreate.mock.calls[0][0].id;
    expect(importFromDrive).toHaveBeenCalledWith({
      data: { fileId: 'drive-1', projectId: 'proj-1', studyId },
    });
    expect(mockPdfAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        studyId,
        pdf: expect.objectContaining({ fileName: 'Witt2019.pdf' }),
        tag: 'primary',
      }),
    );
    expect(mockStudyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: studyId,
        updates: expect.objectContaining({
          originalTitle: 'Actual Paper Title',
          doi: '10.1234/extracted',
          firstAuthor: 'Witt C',
          // Coerced to a string for the mutator's schema.
          publicationYear: '2019',
          journal: 'Nature',
        }),
      }),
    );
  });

  it('skips the study.update mutation when the PDF has no extractable metadata', async () => {
    vi.mocked(extractPdfTitle).mockResolvedValueOnce(null);
    vi.mocked(extractPdfDoi).mockResolvedValueOnce(null);

    await studyActions.addBatch([
      { googleDriveFileId: 'drive-1', googleDriveFileName: 'Witt2019.pdf', title: 'Witt2019' },
    ]);

    expect(mockPdfAttach).toHaveBeenCalledTimes(1);
    expect(mockStudyUpdate).not.toHaveBeenCalled();
  });

  it('routes local PDFs through uploadPdf', async () => {
    await studyActions.addBatch([
      { pdfData: new ArrayBuffer(8), pdfFileName: 'Local.pdf', title: 'Local' },
    ]);

    const studyId = mockStudyCreate.mock.calls[0][0].id;
    expect(uploadPdf).toHaveBeenCalledWith(
      'org-1',
      'proj-1',
      studyId,
      expect.any(ArrayBuffer),
      'Local.pdf',
    );
    expect(importFromDrive).not.toHaveBeenCalled();
  });

  it('counts successes and manual PDFs correctly across a mixed batch', async () => {
    mockStudyCreate
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockResolvedValueOnce(undefined);

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
