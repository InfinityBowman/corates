import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { StudyAppraisals, switchToolCopy } from '../StudyAppraisals';
import type { StudyInfo, ChecklistEntry, OutcomeEntry } from '@/stores/projectStore';

const outcomes: OutcomeEntry[] = [
  { id: 'o1', name: 'Mortality', createdAt: 1 },
  { id: 'o2', name: 'Pain', createdAt: 2 },
];

function checklist(outcomeId: string, status: string, assignedTo = 'r1'): ChecklistEntry {
  return {
    id: `c-${outcomeId}-${assignedTo}`,
    type: 'ROB2',
    kind: 'reviewer',
    title: null,
    assignedTo,
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
    name: 'Groves 2023',
    reviewer1: 'r1',
    reviewer2: 'r2',
    checklists: [],
    appraisals: [],
    pdfs: [],
    ...overrides,
  } as StudyInfo;
}

function renderIt(props: Partial<React.ComponentProps<typeof StudyAppraisals>> = {}) {
  const handlers = {
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    cellHasAnswers: vi.fn(() => false),
    onAssignReviewers: vi.fn(),
    onManageOutcomes: vi.fn(),
  };
  render(
    <Sheet open>
      <SheetContent>
        <StudyAppraisals
          study={study()}
          outcomes={outcomes}
          defaultTool='ROB2'
          readOnly={false}
          getMember={id => (id ? { userId: id, name: `User ${id}` } : null)}
          {...handlers}
          {...props}
        />
      </SheetContent>
    </Sheet>,
  );
  return handlers;
}

describe('StudyAppraisals', () => {
  it('ticking an outcome adds that cell for the current tool', () => {
    const { onCreate } = renderIt();
    fireEvent.click(screen.getByTestId('appraisal-toggle-o1'));
    expect(onCreate).toHaveBeenCalledWith([{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }]);
  });

  it('unticking a cell without answers removes it straight away', () => {
    const { onDelete } = renderIt({
      study: study({ appraisals: [{ type: 'ROB2', outcomeId: 'o1' }] }),
    });
    expect(screen.getByTestId('appraisal-toggle-o1')).toHaveAttribute('data-state', 'checked');
    fireEvent.click(screen.getByTestId('appraisal-toggle-o1'));
    expect(onDelete).toHaveBeenCalledWith(
      [{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }],
      false,
    );
    expect(screen.queryByTestId('appraisal-confirm')).not.toBeInTheDocument();
  });

  it('unticking a cell with answers asks first, then removes with force', () => {
    const { onDelete } = renderIt({
      study: study({
        appraisals: [{ type: 'ROB2', outcomeId: 'o1' }],
        checklists: [checklist('o1', 'in-progress')],
      }),
      cellHasAnswers: vi.fn(() => true),
    });
    fireEvent.click(screen.getByTestId('appraisal-toggle-o1'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId('appraisal-confirm')).toHaveTextContent(
      'Mortality already has answers',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove anyway' }));
    expect(onDelete).toHaveBeenCalledWith([{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }], true);
  });

  it('describes each cell by how far the reviewers have got', () => {
    renderIt({
      study: study({
        appraisals: [
          { type: 'ROB2', outcomeId: 'o1' },
          { type: 'ROB2', outcomeId: 'o2' },
        ],
        checklists: [checklist('o1', 'in-progress'), checklist('o1', 'pending', 'r2')],
      }),
    });
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  it('says a planned cell is waiting when nobody is assigned', () => {
    renderIt({
      study: study({
        reviewer1: null,
        reviewer2: null,
        appraisals: [{ type: 'ROB2', outcomeId: 'o1' }],
      }),
    });
    expect(screen.getByText('Waiting for reviewers')).toBeInTheDocument();
  });

  it('shows a single row for a tool that is not linked to outcomes', () => {
    const { onCreate } = renderIt({ defaultTool: 'AMSTAR2' });
    fireEvent.click(screen.getByTestId('appraisal-toggle-single'));
    expect(onCreate).toHaveBeenCalledWith([{ studyId: 's1', type: 'AMSTAR2', outcomeId: null }]);
  });

  it('takes the tool from existing appraisals over the default', () => {
    renderIt({
      defaultTool: 'ROB2',
      study: study({ appraisals: [{ type: 'AMSTAR2', outcomeId: null }] }),
    });
    expect(screen.getByTestId('appraisal-toggle-single')).toHaveAttribute('data-state', 'checked');
    expect(screen.queryByTestId('appraisal-toggle-o1')).not.toBeInTheDocument();
  });

  it('keeps the tool once the last tick is removed', () => {
    const props = {
      outcomes,
      defaultTool: 'AMSTAR2',
      readOnly: false,
      getMember: () => null,
      onCreate: vi.fn(),
      onDelete: vi.fn(),
      cellHasAnswers: vi.fn(() => false),
      onAssignReviewers: vi.fn(),
      onManageOutcomes: vi.fn(),
    };
    const { rerender } = render(
      <StudyAppraisals
        {...props}
        study={study({ appraisals: [{ type: 'ROB2', outcomeId: 'o1' }] })}
      />,
    );
    fireEvent.click(screen.getByTestId('appraisal-toggle-o1'));
    rerender(<StudyAppraisals {...props} study={study()} />);
    expect(screen.getByRole('combobox', { name: 'Tool' })).toHaveTextContent('RoB 2');
    expect(screen.getByTestId('appraisal-toggle-o1')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.queryByTestId('appraisal-toggle-single')).not.toBeInTheDocument();
  });

  it('points at Outcomes when an outcome-linked tool has none to tick', () => {
    const { onManageOutcomes } = renderIt({ outcomes: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Manage outcomes' }));
    expect(onManageOutcomes).toHaveBeenCalled();
    expect(screen.queryByTestId('appraisal-toggle-o1')).not.toBeInTheDocument();
  });

  it('names the outcomes in the switch confirm while there are few enough to read', () => {
    const base = { from: 'RoB 2', to: 'AMSTAR 2', outcomeLinked: true };
    expect(switchToolCopy({ ...base, labels: ['Mortality', 'Pain'], withAnswers: false })).toBe(
      'Its RoB 2 appraisals on Mortality and Pain will be removed, along with the checklists the reviewers were given for them. You can then choose what to appraise with AMSTAR 2.',
    );
    expect(switchToolCopy({ ...base, labels: ['Mortality'], withAnswers: true })).toBe(
      "Its RoB 2 appraisal on Mortality will be removed, along with the reviewers' checklists and the answers already recorded in it. You can then choose what to appraise with AMSTAR 2.",
    );
    expect(switchToolCopy({ ...base, labels: ['A', 'B', 'C', 'D'], withAnswers: false })).toMatch(
      /^Its 4 RoB 2 appraisals will be removed/,
    );
    expect(
      switchToolCopy({
        ...base,
        from: 'AMSTAR 2',
        to: 'RoB 2',
        outcomeLinked: false,
        labels: ['x'],
        withAnswers: false,
      }),
    ).toMatch(/^Its AMSTAR 2 appraisal will be removed/);
  });

  it('is read-only for non-owners', () => {
    const { onCreate } = renderIt({ readOnly: true });
    const toggle = screen.getByTestId('appraisal-toggle-o1');
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
    expect(screen.getByText('RoB 2')).toBeInTheDocument();
  });
});
