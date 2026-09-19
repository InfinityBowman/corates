import { ChevronDownIcon, CopyIcon } from 'lucide-react';
import { getStatusLabel, getStatusStyle } from '@corates/shared/checklists';
import type { CopyPlanEntry } from '@corates/shared/sync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showToast } from '@/lib/toast';
import { useWorkspaceProjectId } from '@/project/workspace-data';
import { copyAnswersFrom, useCopySources, type CopySource } from './useCopySources';

interface CopyAnswersMenuProps {
  studyId: string;
  checklistId: string;
  instrumentName: string;
}

function sectionList(entries: CopyPlanEntry[]): string {
  const labels = entries.map(entry => entry.section.label);
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function blockedReason(source: CopySource): string {
  return source.plan.every(entry => entry.blocker === 'source-empty') ?
      'No answers yet'
    : 'Already answered here';
}

/**
 * Offers the reviewer's other appraisals of this study as sources to copy
 * the study-level sections from. Rendered only when such a sibling exists,
 * so it never appears on a single-outcome project or on AMSTAR 2.
 */
export function CopyAnswersMenu({ studyId, checklistId, instrumentName }: CopyAnswersMenuProps) {
  const projectId = useWorkspaceProjectId();
  const sources = useCopySources(projectId, studyId, checklistId);
  if (sources.length === 0) return null;

  const handleCopy = (source: CopySource) => {
    copyAnswersFrom(
      projectId,
      source.checklist.id,
      checklistId,
      source.copyable.map(entry => entry.section.id),
    );
    showToast.success(
      `Copied from ${source.outcomeName}`,
      `${sectionList(source.copyable)}. Every copied answer can still be changed.`,
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='sm' data-testid='copy-answers-trigger'>
          <CopyIcon />
          Copy answers from
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-80'>
        <DropdownMenuLabel className='flex flex-col gap-0.5'>
          <span className='text-foreground text-sm'>
            Your other {instrumentName} appraisals of this study
          </span>
          <span className='font-normal'>
            Only study-level sections are copied, and only where this appraisal is still blank.
            Outcome-specific domains stay yours to answer.
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sources.map(source => (
          <DropdownMenuItem
            key={source.checklist.id}
            disabled={source.copyable.length === 0}
            onSelect={() => handleCopy(source)}
            className='items-start gap-3 px-2 py-1.5'
            data-testid='copy-answers-source'
          >
            <div className='min-w-0 flex-1'>
              <div className='truncate'>{source.outcomeName}</div>
              <div className='text-muted-foreground text-xs'>
                {source.copyable.length > 0 ?
                  `Copies ${sectionList(source.copyable)}`
                : blockedReason(source)}
              </div>
            </div>
            <Badge
              variant='secondary'
              className={`shrink-0 ${getStatusStyle(source.checklist.status)}`}
            >
              {getStatusLabel(source.checklist.status)}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
