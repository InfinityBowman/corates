/**
 * ProjectHeaderActions - right side of the project header: the Export button
 * and Add studies as the one primary button.
 */

import { PlusIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectExport } from '@/hooks/useProjectExport';
import { useExportDialogStore } from '@/stores/exportDialogStore';
import { useProjectContext } from './ProjectContext';

export function ProjectHeaderActions() {
  const { projectId, setAddStudiesSheetOpen } = useProjectContext();
  const { hasExportableData } = useProjectExport(projectId);
  const openExportDialog = useExportDialogStore(s => s.open);

  return (
    <div className='flex shrink-0 items-center gap-1.5'>
      <Button
        variant='outline'
        size='sm'
        onClick={() => openExportDialog(projectId)}
        disabled={!hasExportableData}
      >
        <DownloadIcon className='size-4' />
        Export
      </Button>

      <Button size='sm' onClick={() => setAddStudiesSheetOpen(true)}>
        <PlusIcon className='size-4' />
        Add studies
      </Button>
    </div>
  );
}
