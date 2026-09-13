import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StudyCard } from '../study-card/StudyCard';
import { useFileDragStore } from '@/stores/fileDragStore';
import type { StudyInfo } from '@/stores/projectStore';

const { uploadStudyPdfFiles } = vi.hoisted(() => ({ uploadStudyPdfFiles: vi.fn() }));

vi.mock('../study-card/uploadStudyPdfFiles', () => ({ uploadStudyPdfFiles }));
vi.mock('../study-card/StudyCardHeader', () => ({
  StudyCardHeader: () => <div>header</div>,
}));
vi.mock('../study-card/StudyPdfSection', () => ({
  StudyPdfSection: ({ uploading }: { uploading: boolean }) => (
    <div>{uploading ? 'uploading' : 'idle'}</div>
  ),
}));

const study = { id: 's1', name: 'Groves2023', pdfs: [], checklists: [] } as unknown as StudyInfo;
const pdf = new File(['%PDF-1.4'], 'groves.pdf', { type: 'application/pdf' });

function fileDrag(files: File[] = [pdf]) {
  return { dataTransfer: { types: ['Files'], files, dropEffect: 'none' } };
}

function renderCard(props: Partial<React.ComponentProps<typeof StudyCard>> = {}) {
  const onToggleExpanded = vi.fn();
  render(
    <StudyCard
      study={study}
      expanded={false}
      onToggleExpanded={onToggleExpanded}
      onExportCsv={() => {}}
      onExportPdf={() => {}}
      {...props}
    />,
  );
  return { card: screen.getByTestId('study-card'), onToggleExpanded };
}

describe('StudyCard drop target', () => {
  beforeEach(() => {
    uploadStudyPdfFiles.mockReset();
    uploadStudyPdfFiles.mockResolvedValue(undefined);
    useFileDragStore.setState({ isDraggingFiles: false });
  });

  it('uploads dropped PDFs to this study, expands it, and keeps the drop from the page handler', async () => {
    const documentDrop = vi.fn();
    document.addEventListener('drop', documentDrop);
    useFileDragStore.setState({ isDraggingFiles: true });
    const { card, onToggleExpanded } = renderCard();

    await act(async () => {
      fireEvent.drop(card, fileDrag());
    });

    expect(uploadStudyPdfFiles).toHaveBeenCalledWith('s1', [pdf]);
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(documentDrop).not.toHaveBeenCalled();
    expect(useFileDragStore.getState().isDraggingFiles).toBe(false);
    document.removeEventListener('drop', documentDrop);
  });

  it('does not re-toggle a card that is already expanded', async () => {
    const { card, onToggleExpanded } = renderCard({ expanded: true });
    await act(async () => {
      fireEvent.drop(card, fileDrag());
    });
    expect(uploadStudyPdfFiles).toHaveBeenCalledTimes(1);
    expect(onToggleExpanded).not.toHaveBeenCalled();
  });

  it('shows the uploading state until the upload settles', async () => {
    let finish: () => void = () => {};
    uploadStudyPdfFiles.mockImplementation(() => new Promise<void>(r => (finish = r)));
    const { card } = renderCard({ expanded: true });

    await act(async () => {
      fireEvent.drop(card, fileDrag());
    });
    expect(screen.getByText('uploading')).toBeInTheDocument();

    await act(async () => finish());
    expect(screen.getByText('idle')).toBeInTheDocument();
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
    const { card, onToggleExpanded } = renderCard({ readOnly: true });
    fireEvent.dragEnter(card, fileDrag());
    expect(card).not.toHaveAttribute('data-drop-over');
    fireEvent.drop(card, fileDrag());
    expect(uploadStudyPdfFiles).not.toHaveBeenCalled();
    expect(onToggleExpanded).not.toHaveBeenCalled();
  });
});
