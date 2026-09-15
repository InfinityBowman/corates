/**
 * StudyCard - one study row. Clicking it opens the study sheet. The card is
 * a drop target for PDFs while files are dragged over the page; a drop opens
 * the sheet so the upload shows up where the PDFs live.
 */

import { type ProjectMember, useProjectContext } from '@/components/project/ProjectContext';
import { useStudyPdfDrop } from '@/components/project/study-sheet/useStudyPdfDrop';
import type { StudyInfo } from '@/stores/projectStore';
import { useFileDragStore } from '@/stores/fileDragStore';
import { cn } from '@/lib/utils';
import { StudyCardHeader } from './StudyCardHeader';

interface StudyCardProps {
  study: StudyInfo;
  onExportCsv: () => void;
  onExportPdf: () => void;
  getMember?: (userId: string) => ProjectMember | null;
  onAssignReviewers?: (study: StudyInfo) => void;
  readOnly?: boolean;
}

export function StudyCard({
  study,
  onExportCsv,
  onExportPdf,
  getMember,
  onAssignReviewers,
  readOnly,
}: StudyCardProps) {
  const { openStudySheet } = useProjectContext();
  const isDraggingFiles = useFileDragStore(s => s.isDraggingFiles);
  const canDrop = !readOnly;
  const { isOver, dropProps } = useStudyPdfDrop(study.id, () => openStudySheet(study.id));
  const showTargets = canDrop && isDraggingFiles;

  return (
    <div
      data-testid='study-card'
      data-drop-over={isOver || undefined}
      className={cn(
        'border-border bg-card relative rounded-lg border transition-colors',
        showTargets && 'border-primary/50 border-dashed',
        isOver && 'border-primary bg-primary/5 border-solid',
      )}
      {...(canDrop ? dropProps : {})}
    >
      <StudyCardHeader
        study={study}
        onAssignReviewers={() => onAssignReviewers?.(study)}
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
        getMember={getMember}
      />

      {isOver && (
        <div className='bg-card/80 pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg'>
          <p className='text-primary text-sm font-medium'>
            Drop to add PDF to {study.name || 'this study'}
          </p>
        </div>
      )}
    </div>
  );
}
