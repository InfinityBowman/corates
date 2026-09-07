/**
 * OutcomesCard - project outcomes managed inline on Overview, beside the team
 */

import { useProjectOutcomes } from '@/project/workspace-data';
import { useProjectContext } from '../ProjectContext';
import { OutcomeManager } from '../outcomes/OutcomeManager';

export function OutcomesCard() {
  const { projectId } = useProjectContext();
  const outcomes = useProjectOutcomes(projectId);

  return (
    <section
      aria-labelledby='overview-outcomes-heading'
      className='border-border bg-card mb-6 rounded-xl border p-5'
    >
      <div className='mb-4'>
        <h3 id='overview-outcomes-heading' className='text-foreground text-base font-semibold'>
          Outcomes ({outcomes.length})
        </h3>
        <p className='text-muted-foreground mt-1 text-sm'>
          An outcome is the result you appraise, such as all-cause mortality. RoB 2 and ROBINS-I
          checklists are completed once per outcome.
        </p>
      </div>
      <OutcomeManager />
    </section>
  );
}
