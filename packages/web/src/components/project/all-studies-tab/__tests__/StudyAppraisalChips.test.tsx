import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StudyAppraisalChips } from '../study-card/StudyAppraisalChips';
import type { StudyInfo, ChecklistEntry } from '@/stores/projectStore';

vi.mock('@/components/project/ProjectContext', () => ({
  useProjectContext: () => ({ projectId: 'p1' }),
}));
vi.mock('@/project/workspace-data', () => ({
  useProjectOutcomes: () => [
    { id: 'o1', name: 'Mortality', createdAt: 1 },
    { id: 'o2', name: 'Pain', createdAt: 2 },
  ],
}));

function checklist(type: string, outcomeId: string | null, status: string): ChecklistEntry {
  return {
    id: `c-${outcomeId}`,
    type,
    kind: 'reviewer',
    title: null,
    assignedTo: 'r1',
    outcomeId,
    status,
    createdAt: 1,
    updatedAt: 1,
    score: null,
    answers: null,
  };
}

function study(overrides: Partial<StudyInfo> = {}): StudyInfo {
  return {
    id: 's1',
    name: 'Petrie 2019',
    reviewer1: 'r1',
    reviewer2: null,
    checklists: [],
    appraisals: [],
    pdfs: [],
    ...overrides,
  } as StudyInfo;
}

function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('StudyAppraisalChips', () => {
  it('shows the tool then one chip per selected outcome, with its status on hover', () => {
    render(
      <StudyAppraisalChips
        study={study({
          appraisals: [
            { type: 'ROB2', outcomeId: 'o1' },
            { type: 'ROB2', outcomeId: 'o2' },
          ],
          checklists: [checklist('ROB2', 'o1', 'in-progress')],
        })}
      />,
    );
    const chips = screen.getByTestId('study-appraisal-chips');
    expect(chips).toHaveTextContent(/^RoB 2MortalityPain$/);
  });

  it('labels a tool without outcomes by its progress instead', () => {
    render(
      <StudyAppraisalChips
        study={study({
          appraisals: [{ type: 'AMSTAR2', outcomeId: null }],
          checklists: [checklist('AMSTAR2', null, 'finalized')],
        })}
      />,
    );
    expect(screen.getByTestId('study-appraisal-chips')).toHaveTextContent(/^AMSTAR 2Complete$/);
  });

  it('says so when nothing is selected', () => {
    render(<StudyAppraisalChips study={study()} />);
    expect(screen.getByText('No appraisals')).toBeInTheDocument();
    expect(screen.queryByTestId('study-appraisal-chips')).not.toBeInTheDocument();
  });
});
