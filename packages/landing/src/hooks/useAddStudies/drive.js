/**
 * Google Drive operations for useAddStudies (React version)
 */

import { useState, useCallback } from 'react';

export function useDriveOperations() {
  const [selectedDriveFiles, setSelectedDriveFiles] = useState([]);

  const driveCount = selectedDriveFiles.length;

  const toggleDriveFile = useCallback(file => {
    setSelectedDriveFiles(prev => {
      const exists = prev.some(f => f.id === file.id);
      return exists ? prev.filter(f => f.id !== file.id) : [...prev, file];
    });
  }, []);

  const removeDriveFile = useCallback(fileId => {
    setSelectedDriveFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const clearDriveFiles = useCallback(() => {
    setSelectedDriveFiles([]);
  }, []);

  const getSerializableState = useCallback(
    () => ({
      selectedDriveFiles: selectedDriveFiles.map(f => ({ id: f.id, name: f.name })),
    }),
    [selectedDriveFiles],
  );

  const restoreState = useCallback(savedState => {
    if (savedState.selectedDriveFiles?.length > 0) {
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
