/**
 * useStudyPdfDrop - makes an element a drop target for PDFs bound for one
 * study. Both the study card and the study sheet use it so a file dropped on
 * either lands on the same study.
 */

import { useRef, useState } from 'react';
import { useFileDragStore } from '@/stores/fileDragStore';
import { uploadStudyPdfFiles } from './uploadStudyPdfFiles';

function hasFiles(e: React.DragEvent) {
  return Array.from(e.dataTransfer?.types || []).includes('Files');
}

export function useStudyPdfDrop(studyId: string, onDropped?: () => void) {
  const [isOver, setIsOver] = useState(false);
  // dragenter/dragleave fire for every child element crossed, so track depth
  // rather than trusting the last event.
  const dragDepth = useRef(0);

  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current += 1;
    setIsOver(true);
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsOver(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    // The document-level handler would otherwise stage these as new studies.
    e.stopPropagation();
    dragDepth.current = 0;
    setIsOver(false);
    useFileDragStore.getState().setDraggingFiles(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    onDropped?.();
    void uploadStudyPdfFiles(studyId, files);
  };

  return { isOver, dropProps: { onDragEnter, onDragLeave, onDragOver, onDrop } };
}
