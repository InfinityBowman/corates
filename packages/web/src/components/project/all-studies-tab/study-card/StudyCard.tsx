/**
 * StudyCard - Expandable study card with header and PDF section.
 * The whole card is a drop target for PDFs while files are dragged over the page.
 */

import { useRef, useState } from 'react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { type ProjectMember } from '@/components/project/ProjectContext';
import type { StudyInfo } from '@/stores/projectStore';
import { useFileDragStore } from '@/stores/fileDragStore';
import { cn } from '@/lib/utils';
import { StudyCardHeader } from './StudyCardHeader';
import { StudyPdfSection } from './StudyPdfSection';
import { uploadStudyPdfFiles } from './uploadStudyPdfFiles';

interface StudyCardProps {
  study: StudyInfo;
  expanded: boolean;
  onToggleExpanded: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  getMember?: (userId: string) => ProjectMember | null;
  onAssignReviewers?: (study: StudyInfo) => void;
  onOpenGoogleDrive?: (studyId: string) => void;
  readOnly?: boolean;
}

function hasFiles(e: React.DragEvent) {
  return Array.from(e.dataTransfer?.types || []).includes('Files');
}

export function StudyCard({
  study,
  expanded,
  onToggleExpanded,
  onExportCsv,
  onExportPdf,
  getMember,
  onAssignReviewers,
  onOpenGoogleDrive,
  readOnly,
}: StudyCardProps) {
  const isDraggingFiles = useFileDragStore(s => s.isDraggingFiles);
  const [isOver, setIsOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  // dragenter/dragleave fire for every child element crossed, so track depth
  // rather than trusting the last event.
  const dragDepth = useRef(0);
  const canDrop = !readOnly;

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    try {
      await uploadStudyPdfFiles(study.id, files);
    } finally {
      setUploading(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!canDrop || !hasFiles(e)) return;
    dragDepth.current += 1;
    setIsOver(true);
  };

  const handleDragLeave = () => {
    if (!canDrop) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrop || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!canDrop || !hasFiles(e)) return;
    e.preventDefault();
    // The document-level handler would otherwise stage these as new studies.
    e.stopPropagation();
    dragDepth.current = 0;
    setIsOver(false);
    useFileDragStore.getState().setDraggingFiles(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    if (!expanded) onToggleExpanded();
    void uploadFiles(files);
  };

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
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Collapsible open={expanded} onOpenChange={onToggleExpanded}>
        <StudyCardHeader
          study={study}
          expanded={expanded}
          onToggle={onToggleExpanded}
          onAssignReviewers={() => onAssignReviewers?.(study)}
          onExportCsv={onExportCsv}
          onExportPdf={onExportPdf}
          getMember={getMember}
        />
        <CollapsibleContent>
          <div className='border-border border-t'>
            <StudyPdfSection
              study={study}
              uploading={uploading}
              onUploadFiles={files => void uploadFiles(files)}
              onOpenGoogleDrive={onOpenGoogleDrive}
              readOnly={readOnly}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

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
