/**
 * OutcomesPanel - project outcomes with how many checklists use each
 */

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectOutcomes } from '@/project/workspace-data';
import type { StudyInfo } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';
import { OutcomeManager } from '../outcomes/OutcomeManager';

interface OutcomesPanelProps {
  studies: StudyInfo[];
}

export function OutcomesPanel({ studies }: OutcomesPanelProps) {
  const { projectId } = useProjectContext();
  const outcomes = useProjectOutcomes(projectId);
  const [adding, setAdding] = useState(false);

  const checklistCounts: Record<string, number> = {};
  for (const study of studies) {
    for (const checklist of study.checklists || []) {
      if (!checklist.outcomeId) continue;
      checklistCounts[checklist.outcomeId] = (checklistCounts[checklist.outcomeId] ?? 0) + 1;
    }
  }

  return (
    <section aria-labelledby='overview-outcomes-heading'>
      <div className='mb-2 flex items-center justify-between'>
        <h2 id='overview-outcomes-heading' className='text-muted-foreground text-xs font-semibold'>
          Outcomes
          <span className='ml-1.5 font-medium tabular-nums'>{outcomes.length}</span>
        </h2>
        <Button
          variant='ghost'
          size='xs'
          className='text-primary hover:text-primary'
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <PlusIcon className='size-3.5' />
          Add outcome
        </Button>
      </div>
      <OutcomeManager
        checklistCounts={checklistCounts}
        adding={adding}
        onAddingChange={setAdding}
      />
    </section>
  );
}
