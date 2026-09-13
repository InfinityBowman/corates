/**
 * fileDragStore - Whether the user is dragging files over the page
 *
 * The add-studies sheet owns the document-level drag listeners and sets
 * this; study cards read it to light up as drop targets. Study cards also
 * register here so the drop hint can say they are available.
 */

import { create } from 'zustand';

interface FileDragState {
  isDraggingFiles: boolean;
  studyDropTargetsMounted: boolean;
  setDraggingFiles: (dragging: boolean) => void;
  setStudyDropTargetsMounted: (mounted: boolean) => void;
}

export const useFileDragStore = create<FileDragState>()(set => ({
  isDraggingFiles: false,
  studyDropTargetsMounted: false,
  setDraggingFiles: dragging => set({ isDraggingFiles: dragging }),
  setStudyDropTargetsMounted: mounted => set({ studyDropTargetsMounted: mounted }),
}));
