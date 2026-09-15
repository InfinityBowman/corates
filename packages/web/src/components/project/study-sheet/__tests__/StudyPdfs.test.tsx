import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudyPdfs } from '../StudyPdfs';
import type { StudyInfo, PdfEntry } from '@/stores/projectStore';

const { uploadStudyPdfFiles, uploading, drive } = vi.hoisted(() => ({
  uploadStudyPdfFiles: vi.fn(),
  uploading: { value: false },
  drive: vi.fn(),
}));

vi.mock('../uploadStudyPdfFiles', () => ({
  uploadStudyPdfFiles,
  useStudyPdfUploading: () => uploading.value,
}));
vi.mock('@/components/project/ProjectContext', () => ({
  useProjectContext: () => ({ projectId: 'p1' }),
}));
vi.mock('@/project', () => ({ project: { pdf: {} } }));
vi.mock('../../google-drive/GoogleDrivePickerModal', () => ({
  GoogleDrivePickerModal: (props: { open: boolean; studyId: string }) => {
    drive(props);
    return props.open ? <div>drive picker</div> : null;
  },
}));

function pdf(id: string, tag: string): PdfEntry {
  return {
    id,
    fileName: `${id}.pdf`,
    key: id,
    size: 2048,
    uploadedBy: 'u1',
    uploadedAt: 1,
    tag,
    title: null,
    firstAuthor: null,
    publicationYear: null,
    journal: null,
    doi: null,
  };
}

function study(pdfs: PdfEntry[] = []): StudyInfo {
  return {
    id: 's1',
    name: 'Groves 2023',
    pdfs,
    checklists: [],
    appraisals: [],
  } as unknown as StudyInfo;
}

describe('StudyPdfs', () => {
  beforeEach(() => {
    uploadStudyPdfFiles.mockReset();
    uploading.value = false;
    drive.mockReset();
  });

  it('lists the PDFs with the primary first and the count in the heading', () => {
    render(<StudyPdfs study={study([pdf('b', 'secondary'), pdf('a', 'primary')])} />);
    expect(screen.getByText('PDFs (2)')).toBeInTheDocument();
    const names = screen.getAllByText(/\.pdf$/).map(el => el.textContent);
    expect(names).toEqual(['a.pdf', 'b.pdf']);
  });

  it('uploads chosen files to this study', () => {
    render(<StudyPdfs study={study()} />);
    const file = new File(['%PDF-1.4'], 'new.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('study-pdf-input'), { target: { files: [file] } });
    expect(uploadStudyPdfFiles).toHaveBeenCalledWith('s1', [file]);
  });

  it('shows the uploading state while a file is in flight', () => {
    uploading.value = true;
    render(<StudyPdfs study={study()} />);
    expect(screen.getByRole('button', { name: 'Upload PDF' })).toBeDisabled();
    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('opens the Google Drive picker for this study from the empty state', () => {
    render(<StudyPdfs study={study()} />);
    expect(screen.getByText(/No PDFs on this study yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Import from Google Drive', { selector: 'button' }));
    expect(screen.getByText('drive picker')).toBeInTheDocument();
    expect(drive).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, studyId: 's1' }));
  });
});
