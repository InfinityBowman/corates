/**
 * Google Drive operations for useAddStudies (React version)
 */

import { useState, useCallback } from 'react';
import type { DriveFile } from './deduplication';

interface DriveSerializableState {
  selectedDriveFiles: DriveFile[];
}

interface DriveOperations {
  selectedDriveFiles: DriveFile[];
  driveCount: number;
  toggleDriveFile: (file: DriveFile) => void;
  removeDriveFile: (fileId: string) => void;
  clearDriveFiles: () => void;
  getSerializableState: () => DriveSerializableState;
  restoreState: (savedState: Partial<DriveSerializableState>) => void;
}

export function useDriveOperations(): DriveOperations {
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<DriveFile[]>([]);

  const driveCount = selectedDriveFiles.length;

  const toggleDriveFile = useCallback((file: DriveFile) => {
    setSelectedDriveFiles(prev => {
      const exists = prev.some(f => f.id === file.id);
      return exists ? prev.filter(f => f.id !== file.id) : [...prev, file];
    });
  }, []);

  const removeDriveFile = useCallback((fileId: string) => {
    setSelectedDriveFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const clearDriveFiles = useCallback(() => {
    setSelectedDriveFiles([]);
  }, []);

  const getSerializableState = useCallback(
    (): DriveSerializableState => ({
      selectedDriveFiles: selectedDriveFiles.map(f => ({ id: f.id, name: f.name })),
    }),
    [selectedDriveFiles],
  );

  const restoreState = useCallback((savedState: Partial<DriveSerializableState>) => {
    if (savedState.selectedDriveFiles && savedState.selectedDriveFiles.length > 0) {
      setSelectedDriveFiles(savedState.selectedDriveFiles);
    }
  }, []);

  return {
    selectedDriveFiles,
    driveCount,
    toggleDriveFile,
    removeDriveFile,
    clearDriveFiles,
    getSerializableState,
    restoreState,
  };
}
