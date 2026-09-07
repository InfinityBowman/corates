/**
 * ProjectHeaderActions - right side of the project header: an overflow menu
 * for export and Add studies as the one primary button.
 */

import { PlusIcon, FileSpreadsheetIcon, FileIcon, EllipsisIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useProjectExport } from '@/hooks/useProjectExport';
import { useProjectContext } from './ProjectContext';

export function ProjectHeaderActions() {
  const { projectId, setAddStudiesSheetOpen } = useProjectContext();
  const { hasExportableData, exportAllCsv, exportAllPdf } = useProjectExport(projectId);

  return (
    <div className='flex shrink-0 items-center gap-1.5'>
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
