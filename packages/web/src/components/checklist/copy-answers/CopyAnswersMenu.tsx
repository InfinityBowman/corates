import { useId, useState } from 'react';
import { ChevronDownIcon, CopyIcon } from 'lucide-react';
import type { CopyBlocker, CopyPlanEntry } from '@corates/shared/sync';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { showToast } from '@/lib/toast';
import { useWorkspaceProjectId } from '@/project/workspace-data';
import { copyAnswersFrom, joinNames, useCopySources, type CopySource } from './useCopySources';

interface CopyAnswersMenuProps {
  studyId: string;
  checklistId: string;
  instrumentName: string;
}

const BLOCKER_REASON: Record<CopyBlocker, string> = {
  'source-empty': 'Not answered there',
  'target-answered': 'Already answered here',
  mismatch: 'Needs the same effect of interest',
};

function SourceSections({
  source,
  onCopy,
}: {
  source: CopySource;
  onCopy: (source: CopySource, sections: CopyPlanEntry[]) => void;
}) {
  const groupId = useId();
  // Tracking what was unchecked rather than what is checked keeps a section
  // that only just became copyable selected by default.
  const [unchecked, setUnchecked] = useState<string[]>([]);
  const chosen = source.copyable
    .map(entry => entry.section.id)
    .filter(id => !unchecked.includes(id));
  const effective = source.replan(chosen);
  const landing = effective.filter(entry => !entry.blocker);

  const toggle = (id: string) =>
    setUnchecked(current =>
      current.includes(id) ? current.filter(other => other !== id) : [...current, id],
    );

  return (
    <div className='flex flex-col gap-2 py-2.5' data-testid='copy-answers-source'>
      <div className='truncate font-medium'>{source.outcomeName}</div>
      <div className='flex flex-col gap-2'>
        {source.plan.map(entry => {
          const id = entry.section.id;
          const blocker =
            entry.blocker ?? effective.find(other => other.section.id === id)?.blocker ?? null;
          return (
            <div key={id} className='flex items-center gap-2'>
              <Checkbox
                id={`${groupId}-${id}`}
                checked={!entry.blocker && !unchecked.includes(id)}
                disabled={entry.blocker !== null}
                onCheckedChange={() => toggle(id)}
              />
              <Label htmlFor={`${groupId}-${id}`} className='min-w-0 flex-1 font-normal'>
                <span className='truncate'>{entry.section.label}</span>
              </Label>
              {blocker && (
                <span className='text-muted-foreground shrink-0 text-xs'>
                  {BLOCKER_REASON[blocker]}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <Button
        size='sm'
        className='self-start'
        disabled={landing.length === 0}
        onClick={() => onCopy(source, landing)}
      >
        <CopyIcon />
        Copy {landing.length} {landing.length === 1 ? 'section' : 'sections'}
      </Button>
    </div>
  );
}

/**
 * Offers the reviewer's other appraisals of this study as sources to copy
 * the study-level sections from, a section at a time. Rendered only when
 * such a sibling exists, so it never appears on a single-outcome project or
 * on AMSTAR 2.
 */
export function CopyAnswersMenu({ studyId, checklistId, instrumentName }: CopyAnswersMenuProps) {
  const projectId = useWorkspaceProjectId();
  const sources = useCopySources(projectId, studyId, checklistId);
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  const handleCopy = (source: CopySource, sections: CopyPlanEntry[]) => {
    copyAnswersFrom(projectId, source.checklist.id, checklistId, {
      sections: sections.map(entry => entry.section.id),
    });
    setOpen(false);
    showToast.success(
      `Copied from ${source.outcomeName}`,
      `${joinNames(sections.map(entry => entry.section.label))}. Every copied answer can still be changed.`,
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' data-testid='copy-answers-trigger'>
          <CopyIcon />
          Copy answers from
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-96 gap-0'>
        <PopoverHeader className='pb-2.5'>
          <PopoverTitle>Your other {instrumentName} appraisals of this study</PopoverTitle>
          <PopoverDescription>
            Only study-level sections can be copied, and only where this appraisal is still blank.
            Outcome-specific domains stay yours to answer.
          </PopoverDescription>
        </PopoverHeader>
        <div className='divide-border -mb-2.5 divide-y border-t'>
          {sources.map(source => (
            <SourceSections key={source.checklist.id} source={source} onCopy={handleCopy} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
