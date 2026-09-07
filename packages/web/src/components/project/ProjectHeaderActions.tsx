/**
 * ProjectHeaderActions - right side of the project header: the Export menu
 * and Add studies as the one primary button.
 */

import { PlusIcon, FileSpreadsheetIcon, FileIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectExport } from '@/hooks/useProjectExport';
import { useProjectContext } from './ProjectContext';

export function ProjectHeaderActions() {
  const { projectId, setAddStudiesSheetOpen } = useProjectContext();
  const { hasExportableData, exportAllCsv, exportAllPdf } = useProjectExport(projectId);

  return (
    <div className='flex shrink-0 items-center gap-1.5'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' size='sm'>
            <DownloadIcon className='size-4' />
            Export
          </Button>
        </DropdownMenuTrigger>
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
