/**
 * Google Drive operations for useAddStudies
 */

import { createSignal } from 'solid-js';

/**
 * Create Google Drive operations
 * @returns {Object}
 */
export function createDriveOperations() {
  const [selectedDriveFiles, setSelectedDriveFiles] = createSignal([]);

  const driveCount = () => selectedDriveFiles().length;

  const toggleDriveFile = file => {
    setSelectedDriveFiles(prev => {
      const exists = prev.some(f => f.id === file.id);
      if (exists) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  const removeDriveFile = fileId => {
    setSelectedDriveFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearDriveFiles = () => {
    setSelectedDriveFiles([]);
  };

  // Serialization
  const getSerializableState = () => ({
    selectedDriveFiles: selectedDriveFiles().map(f => ({ id: f.id, name: f.name })),
  });

  const restoreState = savedState => {
    if (savedState.selectedDriveFiles?.length > 0) {
      setSelectedDriveFiles(savedState.selectedDriveFiles);
    }
  };

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
