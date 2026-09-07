/**
 * ProjectHeaderActions - right side of the project header: Assign reviewers
 * while there is something to assign, Outcomes, an overflow menu for export,
 * and Add studies as the one primary button.
 */

import {
  PlusIcon,
  UsersIcon,
  TargetIcon,
  FileSpreadsheetIcon,
  FileIcon,
  EllipsisIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAllStudies, useProjectOutcomes } from '@/project/workspace-data';
import { useProjectExport } from '@/hooks/useProjectExport';
import { useProjectContext } from './ProjectContext';

export function ProjectHeaderActions() {
  const { projectId, isOwner, setAddStudiesSheetOpen, openAssignSheet, setOutcomesSheetOpen } =
    useProjectContext();

  const studies = useAllStudies(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const { hasExportableData, exportAllCsv, exportAllPdf } = useProjectExport(projectId);

  const unassignedCount = studies.filter(s => !s.reviewer1 && !s.reviewer2).length;

  return (
    <div className='flex shrink-0 items-center gap-1.5'>
      {isOwner && unassignedCount > 0 && (
        <Button variant='outline' size='sm' onClick={() => openAssignSheet()}>
          <UsersIcon className='size-4' />
          Assign reviewers
          <Badge variant='info' className='min-w-5 px-1.5 tabular-nums'>
            {unassignedCount}
          </Badge>
        </Button>
      )}

      <Button variant='outline' size='sm' onClick={() => setOutcomesSheetOpen(true)}>
        <TargetIcon className='size-4' />
        Outcomes
        {outcomes.length > 0 && (
          <Badge variant='secondary' className='min-w-5 px-1.5 tabular-nums'>
            {outcomes.length}
          </Badge>
        )}
      </Button>

      <DropdownMenu>
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon-sm'
                className='text-muted-foreground'
                aria-label='More actions'
              >
                <EllipsisIcon className='size-4' />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>More actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align='end' className='w-48'>
          <DropdownMenuItem onClick={exportAllCsv} disabled={!hasExportableData}>
            <FileSpreadsheetIcon />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAllPdf} disabled={!hasExportableData}>
            <FileIcon />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size='sm' onClick={() => setAddStudiesSheetOpen(true)}>
        <PlusIcon className='size-4' />
        Add studies
      </Button>
    </div>
  );
}
