import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StudySheet } from '../StudySheet';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import type { StudyInfo } from '@/stores/projectStore';

const { uploadStudyPdfFiles, updateStudy } = vi.hoisted(() => ({
  uploadStudyPdfFiles: vi.fn(),
  updateStudy: vi.fn(),
}));

vi.mock('../uploadStudyPdfFiles', () => ({ uploadStudyPdfFiles }));
vi.mock('../StudyAppraisals', () => ({ StudyAppraisals: () => <div>appraisals</div> }));
vi.mock('../StudyPdfs', () => ({ StudyPdfs: () => <div>pdfs</div> }));
vi.mock('@/project', () => ({ project: { study: { update: updateStudy } } }));
vi.mock('@/components/project/ProjectContext', () => ({
  useProjectContext: () => ({
    projectId: 'p1',
    isOwner: true,
    getMember: () => null,
    openAssignSheet: vi.fn(),
    setOutcomesSheetOpen: vi.fn(),
  }),
}));
vi.mock('@/project/workspace-data', () => ({
  useAllStudies: () => [
    {
      id: 's1',
      name: 'Groves 2023',
      pdfs: [],
      checklists: [],
      appraisals: [],
    } as unknown as StudyInfo,
  ],
  useProjectOutcomes: () => [],
}));

const pdf = new File(['%PDF-1.4'], 'groves.pdf', { type: 'application/pdf' });

describe('StudySheet', () => {
  beforeEach(() => {
    uploadStudyPdfFiles.mockReset();
    updateStudy.mockReset();
    usePdfPreviewStore.setState({ isOpen: false });
  });

  it('shows the study with its appraisals and PDFs', () => {
    render(<StudySheet studyId='s1' onClose={() => {}} />);
    expect(screen.getByText('Groves 2023')).toBeInTheDocument();
    expect(screen.getByText('appraisals')).toBeInTheDocument();
    expect(screen.getByText('pdfs')).toBeInTheDocument();
  });

  it('renames the study from its title', () => {
    render(<StudySheet studyId='s1' onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Groves 2023' }));
    const input = screen.getByDisplayValue('Groves 2023');
    fireEvent.change(input, { target: { value: ' Groves 2024 ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateStudy).toHaveBeenCalledWith('s1', { name: 'Groves 2024' });
  });

  it('steps aside while a PDF preview is open and comes back when it closes', () => {
    render(<StudySheet studyId='s1' onClose={() => {}} />);
    act(() => usePdfPreviewStore.setState({ isOpen: true }));
    expect(screen.queryByTestId('study-sheet')).not.toBeInTheDocument();
    act(() => usePdfPreviewStore.setState({ isOpen: false }));
    expect(screen.getByTestId('study-sheet')).toBeInTheDocument();
  });

  it('uploads a PDF dropped anywhere on it to this study', async () => {
    render(<StudySheet studyId='s1' onClose={() => {}} />);
    await act(async () => {
      fireEvent.drop(screen.getByText('appraisals'), {
        dataTransfer: { types: ['Files'], files: [pdf], dropEffect: 'none' },
      });
    });
    expect(uploadStudyPdfFiles).toHaveBeenCalledWith('s1', [pdf]);
  });
});
