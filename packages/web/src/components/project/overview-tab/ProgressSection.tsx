/**
 * ProgressSection - how far the review has come, as a bar and a tile per
 * stage that opens the matching tab. An empty project shows every stage
 * ghosted so the workflow is visible before any study exists.
 */

import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProjectContext } from '../ProjectContext';
import { STAGES, type StageKey } from './studyStage';

interface ProgressSectionProps {
  counts: Record<StageKey, number>;
  total: number;
}

const TILE_CLASS = 'border-border flex flex-col gap-0.5 rounded-lg border px-3.5 py-3';

export function ProgressSection({ counts, total }: ProgressSectionProps) {
  const { projectId, setAddStudiesSheetOpen } = useProjectContext();
  const empty = total === 0;
  const stages = empty ? STAGES : STAGES.filter(stage => counts[stage.key] > 0);
  const filled = total - counts.unassigned;
  const width = (n: number) => (filled === 0 ? 0 : (n / filled) * 100);

  return (
    <section aria-labelledby='overview-progress-heading'>
      <div className='mb-2.5 flex items-baseline justify-between gap-4'>
        <h2 id='overview-progress-heading' className='text-sm font-semibold'>
          Progress
        </h2>
        {!empty && (
          <span className='text-muted-foreground text-sm tabular-nums'>
            {counts.final} of {total} {total === 1 ? 'study' : 'studies'} finalized
          </span>
        )}
      </div>

      <div
        className='bg-muted h-1.5 w-full rounded-full'
        role='img'
        aria-label={empty ? 'No studies yet' : `${counts.final} of ${total} studies finalized`}
      >
        <div
          className='flex h-full overflow-hidden rounded-full'
          style={{ width: `${empty ? 0 : (filled / total) * 100}%` }}
        >
          <span className='bg-success h-full' style={{ width: `${width(counts.final)}%` }} />
          <span
            className='bg-warning h-full'
            style={{ width: `${width(counts.reconciling + counts.ready)}%` }}
          />
          <span className='bg-info h-full' style={{ width: `${width(counts.review)}%` }} />
        </div>
      </div>

      <div className='mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5'>
        {stages.map(stage => {
          const body = (
            <>
              <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                <span className={`size-1.5 rounded-full ${stage.dotClass}`} aria-hidden='true' />
                {stage.label}
                {!empty && (
                  <ChevronRightIcon className='ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
                )}
              </span>
              <span
                className={cn(
                  'text-xl font-semibold tabular-nums',
                  empty && 'text-muted-foreground/60',
                )}
              >
                {counts[stage.key]}
              </span>
              <span className='text-muted-foreground text-xs'>{stage.hint}</span>
            </>
          );
          return empty ?
              <div key={stage.key} className={cn(TILE_CLASS, 'border-dashed')}>
                {body}
              </div>
            : <Link
                key={stage.key}
                to={`/projects/${projectId}?tab=${stage.tab}` as string}
                className={cn(
                  TILE_CLASS,
                  'group hover:bg-muted/50 focus-visible:ring-primary transition-colors focus-visible:ring-2 focus-visible:outline-none',
                )}
              >
                {body}
              </Link>;
        })}
      </div>

      {empty && (
        <div className='mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2'>
          <p className='text-muted-foreground text-xs'>
            No studies yet. Each study moves through these stages as reviewers work.
          </p>
          <Button variant='outline' size='xs' onClick={() => setAddStudiesSheetOpen(true)}>
            <PlusIcon className='size-3.5' />
            Add studies
          </Button>
        </div>
      )}
    </section>
  );
}
