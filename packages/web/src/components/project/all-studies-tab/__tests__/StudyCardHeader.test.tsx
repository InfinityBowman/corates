import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StudyCardHeader } from '../study-card/StudyCardHeader';
import type { StudyInfo } from '@/stores/projectStore';

const { openStudySheet } = vi.hoisted(() => ({ openStudySheet: vi.fn() }));

vi.mock('@/components/project/ProjectContext', () => ({
  useProjectContext: () => ({ projectId: 'p1', isOwner: true, openStudySheet }),
}));
vi.mock('@/project/workspace-data', () => ({ useProjectOutcomes: () => [] }));
vi.mock('@/project', () => ({ project: {} }));

const study = {
  id: 's1',
  name: 'Petrie 2019',
  reviewer1: null,
  reviewer2: null,
  checklists: [],
  appraisals: [],
  pdfs: [],
} as unknown as StudyInfo;

function renderHeader() {
  render(
    <TooltipProvider>
      <StudyCardHeader study={study} />
    </TooltipProvider>,
  );
  return screen.getByRole('button', { name: 'Open Petrie 2019' });
}

describe('StudyCardHeader', () => {
  beforeEach(() => openStudySheet.mockReset());

  it('opens the study sheet on click, but not from the menu button', () => {
    const header = renderHeader();
    fireEvent.click(screen.getByTestId('study-card-menu'));
    expect(openStudySheet).not.toHaveBeenCalled();
    fireEvent.click(header);
    expect(openStudySheet).toHaveBeenCalledWith('s1');
  });

  it('opens the study sheet from the keyboard', () => {
    const header = renderHeader();
    expect(header).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(header, { key: 'Enter' });
    fireEvent.keyDown(header, { key: ' ' });
    expect(openStudySheet).toHaveBeenCalledTimes(2);
  });

  it('leaves keys alone while the name is being edited', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Petrie 2019' }));
    fireEvent.keyDown(screen.getByDisplayValue('Petrie 2019'), { key: 'Enter' });
    expect(openStudySheet).not.toHaveBeenCalled();
  });
});
