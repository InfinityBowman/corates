/**
 * ProjectHeaderActions - Add studies / Assign reviewers cluster in the sticky
 * project header, with the sheets they open.
 */

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import {
  PlusIcon,
  UsersIcon,
  TargetIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AddStudiesSheet } from './add-studies/AddStudiesSheet';
import { AssignReviewersSheet } from './assign-reviewers/AssignReviewersSheet';
import { OutcomesSheet } from './outcomes/OutcomesSheet';
import { useAllStudies, useProjectMembers, useProjectOutcomes } from '@/project/workspace-data';
import { useProjectExport } from '@/hooks/useProjectExport';
import { useProjectContext } from './ProjectContext';

// Native disabled buttons drop pointer events, so the tooltip would never fire.
function DisabledActionButton({ reason, children }: { reason: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(buttonVariants({ variant: 'outline' }), 'cursor-not-allowed opacity-50')}
          aria-disabled='true'
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function ProjectHeaderActions() {
  const { projectId, isOwner, outcomesSheetOpen, setOutcomesSheetOpen } = useProjectContext();

  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const { hasExportableData, exportAllCsv, exportAllPdf } = useProjectExport(projectId);

  const unassignedCount = useMemo(
    () => studies.filter(s => !s.reviewer1 && !s.reviewer2).length,
    [studies],
  );

  // addBatch already shows its own result toast; this one is just the handoff
  // into bulk assignment for the studies that arrived unassigned.
  const handleAdded = useCallback(
    (count: number) => {
      if (!isOwner || members.length < 2 || count === 0) return;
      toast('Assign two reviewers to the new studies?', {
        duration: 10000,
        action: {
          label: 'Assign reviewers',
          onClick: () => setAssignOpen(true),
        },
      });
    },
    [isOwner, members.length],
  );

  const assignBlockedReason =
    !isOwner ? 'Only the project owner can assign reviewers.'
    : studies.length === 0 ? 'Add studies first.'
    : null;
  const exportBlockedReason =
    hasExportableData ? null : 'Start an appraisal on at least one study first.';

  const assignButton = (
    <>
      <UsersIcon className='size-4' />
      Assign reviewers
      {unassignedCount > 0 && (
        <Badge variant='info' className='min-w-5 px-1.5 tabular-nums'>
          {unassignedCount}
        </Badge>
      )}
    </>
  );

  return (
    <div className='flex shrink-0 items-center gap-2'>
      <Button
        variant='ghost'
        onClick={() => setOutcomesSheetOpen(true)}
        className='text-muted-foreground'
      >
        <TargetIcon className='size-4' />
        Outcomes
        {outcomes.length > 0 && (
          <Badge variant='secondary' className='min-w-5 px-1.5 tabular-nums'>
            {outcomes.length}
          </Badge>
        )}
      </Button>

      {assignBlockedReason ?
        <DisabledActionButton reason={assignBlockedReason}>{assignButton}</DisabledActionButton>
      : <Button variant='outline' onClick={() => setAssignOpen(true)}>
          {assignButton}
        </Button>
      }

      {exportBlockedReason ?
        <DisabledActionButton reason={exportBlockedReason}>
          <DownloadIcon className='size-4' />
          Export
        </DisabledActionButton>
      : <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline'>
              <DownloadIcon className='size-4' />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={exportAllCsv}>
              <FileSpreadsheetIcon />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportAllPdf}>
              <FileIcon />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }

      <Button onClick={() => setAddOpen(true)}>
        <PlusIcon className='size-4' />
        Add studies
      </Button>

      <AddStudiesSheet open={addOpen} onOpenChange={setAddOpen} onAdded={handleAdded} />
      {isOwner && <AssignReviewersSheet open={assignOpen} onOpenChange={setAssignOpen} />}
      <OutcomesSheet open={outcomesSheetOpen} onOpenChange={setOutcomesSheetOpen} />
    </div>
  );
}
