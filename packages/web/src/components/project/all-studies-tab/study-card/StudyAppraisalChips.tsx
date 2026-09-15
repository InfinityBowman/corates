/**
 * StudyAppraisalChips - a study's tool and selected outcomes as chips, with a
 * status mark per outcome, so the list shows the plan without opening the sheet.
 */

import { Fragment } from 'react';
import { getAppraisalCells, requiresOutcome } from '@corates/shared/checklists';
import { getChecklistMetadata } from '@/checklist-registry';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useProjectContext } from '@/components/project/ProjectContext';
import {
  CELL_STATE_LABEL,
  cellState,
  type CellState,
} from '@/components/project/appraisalCellState';
import { useProjectOutcomes } from '@/project/workspace-data';
import type { StudyInfo } from '@/stores/projectStore';
import { cn } from '@/lib/utils';

const MARK: Record<CellState, string> = {
  waiting: 'border-dashed border-muted-foreground/70',
  'not-started': 'border-muted-foreground',
  'in-progress': 'border-primary bg-[linear-gradient(90deg,var(--primary)_50%,transparent_50%)]',
  reconciling: 'border-[2.5px] border-warning',
  complete: 'border-success bg-success',
};

function StatusMark({ state }: { state: CellState }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full border-[1.5px]', MARK[state])}
    />
  );
}

export function StudyAppraisalChips({ study }: { study: StudyInfo }) {
  const { projectId } = useProjectContext();
  const outcomes = useProjectOutcomes(projectId);
  const cells = getAppraisalCells(study);

  if (cells.length === 0) {
    return <span className='text-muted-foreground/70 shrink-0 text-xs italic'>No appraisals</span>;
  }

  const hasReviewers = !!study.reviewer1 || !!study.reviewer2;
  const tools = [...new Set(cells.map(c => c.type))];

  return (
    <div
      className='flex flex-wrap items-center justify-end gap-1.5'
      data-testid='study-appraisal-chips'
    >
      {tools.map(type => {
        const toolName = getChecklistMetadata(type).shortName;
        return (
          <Fragment key={type}>
            <Badge variant='secondary'>{toolName}</Badge>
            {cells
              .filter(c => c.type === type)
              .map(cell => {
                const state = cellState(cell, hasReviewers);
                const stateLabel = CELL_STATE_LABEL[state];
                const outcomeName =
                  requiresOutcome(type) ?
                    (outcomes.find(o => o.id === cell.outcomeId)?.name ?? 'Outcome')
                  : null;
                return (
                  <Tooltip key={cell.outcomeId ?? 'single'}>
                    <TooltipTrigger asChild>
                      <Badge variant='outline' className='font-normal'>
                        <StatusMark state={state} />
                        {outcomeName ?? stateLabel}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {outcomeName ? `${outcomeName}: ${stateLabel}` : `${toolName}: ${stateLabel}`}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
          </Fragment>
        );
      })}
    </div>
  );
}
