import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StudyCard } from '../study-card/StudyCard';
import { useFileDragStore } from '@/stores/fileDragStore';
import type { StudyInfo } from '@/stores/projectStore';

const { uploadStudyPdfFiles, openStudySheet } = vi.hoisted(() => ({
  uploadStudyPdfFiles: vi.fn(),
  openStudySheet: vi.fn(),
}));

vi.mock('@/components/project/study-sheet/uploadStudyPdfFiles', () => ({ uploadStudyPdfFiles }));
vi.mock('@/components/project/ProjectContext', () => ({
  useProjectContext: () => ({ openStudySheet }),
}));
vi.mock('../study-card/StudyCardHeader', () => ({
  StudyCardHeader: () => <div>header</div>,
}));

const study = { id: 's1', name: 'Groves2023', pdfs: [], checklists: [] } as unknown as StudyInfo;
const pdf = new File(['%PDF-1.4'], 'groves.pdf', { type: 'application/pdf' });

function fileDrag(files: File[] = [pdf]) {
  return { dataTransfer: { types: ['Files'], files, dropEffect: 'none' } };
}

function renderCard(props: Partial<React.ComponentProps<typeof StudyCard>> = {}) {
  render(<StudyCard study={study} onExportCsv={() => {}} onExportPdf={() => {}} {...props} />);
  return { card: screen.getByTestId('study-card') };
}

describe('StudyCard drop target', () => {
  beforeEach(() => {
    uploadStudyPdfFiles.mockReset();
    uploadStudyPdfFiles.mockResolvedValue(undefined);
    openStudySheet.mockReset();
    useFileDragStore.setState({ isDraggingFiles: false });
  });

  it('uploads dropped PDFs to this study, opens its sheet, and keeps the drop from the page handler', async () => {
    const documentDrop = vi.fn();
    document.addEventListener('drop', documentDrop);
    useFileDragStore.setState({ isDraggingFiles: true });
    const { card } = renderCard();

    await act(async () => {
      fireEvent.drop(card, fileDrag());
    });

    expect(uploadStudyPdfFiles).toHaveBeenCalledWith('s1', [pdf]);
    expect(openStudySheet).toHaveBeenCalledWith('s1');
    expect(documentDrop).not.toHaveBeenCalled();
    expect(useFileDragStore.getState().isDraggingFiles).toBe(false);
    document.removeEventListener('drop', documentDrop);
  });

  it('highlights while a file is dragged over it and clears on leave', () => {
    const { card } = renderCard();
    fireEvent.dragEnter(card, fileDrag());
    expect(card).toHaveAttribute('data-drop-over', 'true');
    expect(screen.getByText('Drop to add PDF to Groves2023')).toBeInTheDocument();
    fireEvent.dragLeave(card, fileDrag());
    expect(card).not.toHaveAttribute('data-drop-over');
  });

  it('ignores drags that are not files', () => {
    const { card } = renderCard();
    fireEvent.dragEnter(card, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(card).not.toHaveAttribute('data-drop-over');
    fireEvent.drop(card, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(uploadStudyPdfFiles).not.toHaveBeenCalled();
  });

  it('is inert when read only', () => {
    const { card } = renderCard({ readOnly: true });
    fireEvent.dragEnter(card, fileDrag());
    expect(card).not.toHaveAttribute('data-drop-over');
    fireEvent.drop(card, fileDrag());
    expect(uploadStudyPdfFiles).not.toHaveBeenCalled();
    expect(openStudySheet).not.toHaveBeenCalled();
  });
});
