/**
 * useProjectChecklistHandlers - Extracted checklist handlers for ProjectView
 * Handles checklist creation, updating, and deletion
 */

import { showToast } from '@components/zag/Toast.jsx';

/**
 * @param {Object} options
 * @param {string} options.projectId - The project ID
 * @param {Object} options.projectActions - Actions from useProject hook
 * @param {Object} options.confirmDialog - Confirm dialog instance
 * @param {Function} options.navigate - Navigation function
 * @param {Function} options.setShowChecklistForm - Signal setter
 * @param {Function} options.setCreatingChecklist - Signal setter
 */
export default function useProjectChecklistHandlers(options) {
  const {
    projectId,
    projectActions,
    confirmDialog,
    navigate,
    setShowChecklistForm,
    setCreatingChecklist,
  } = options;

  const { createChecklist, updateChecklist, deleteChecklist } = projectActions;

  const handleCreateChecklist = async (studyId, type, assigneeId) => {
    setCreatingChecklist(true);
    try {
      createChecklist(studyId, type, assigneeId);
      setShowChecklistForm(null);
    } catch (err) {
      console.error('Error adding checklist:', err);
      showToast.error('Addition Failed', 'Failed to add checklist');
    } finally {
      setCreatingChecklist(false);
    }
  };

  const handleUpdateChecklist = (studyId, checklistId, updates) => {
    try {
      updateChecklist(studyId, checklistId, updates);
    } catch (err) {
      console.error('Error updating checklist:', err);
      showToast.error('Update Failed', 'Failed to update checklist');
    }
  };

  const handleDeleteChecklist = async (studyId, checklistId) => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Checklist',
      description: 'Are you sure you want to delete this checklist?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      deleteChecklist(studyId, checklistId);
    } catch (err) {
      console.error('Error deleting checklist:', err);
      showToast.error('Delete Failed', 'Failed to delete checklist');
    }
  };

  const openChecklist = (studyId, checklistId) => {
    navigate(`/projects/${projectId}/studies/${studyId}/checklists/${checklistId}`);
  };

  const openReconciliation = (studyId, checklist1Id, checklist2Id) => {
    navigate(`/projects/${projectId}/studies/${studyId}/reconcile/${checklist1Id}/${checklist2Id}`);
  };

  return {
    handleCreateChecklist,
    handleUpdateChecklist,
    handleDeleteChecklist,
    openChecklist,
    openReconciliation,
  };
}
