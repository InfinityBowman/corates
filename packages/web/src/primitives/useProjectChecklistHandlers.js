/**
 * useProjectChecklistHandlers - Extracted checklist handlers
 * Handles checklist creation, updating, deletion, and navigation
 */

import { useNavigate } from '@solidjs/router';
import { showToast } from '@components/zag/Toast.jsx';

/**
 * @param {string} projectId - The project ID
 * @param {Object} projectActions - Actions from useProject hook (createChecklist, updateChecklist, deleteChecklist)
 * @param {Object} confirmDialog - Confirm dialog instance
 */
export default function useProjectChecklistHandlers(projectId, projectActions, confirmDialog) {
  const navigate = useNavigate();
  const { createChecklist, updateChecklist, deleteChecklist } = projectActions;

  const handleCreateChecklist = async (studyId, type, assigneeId) => {
    try {
      createChecklist(studyId, type, assigneeId);
      return true;
    } catch (err) {
      console.error('Error adding checklist:', err);
      showToast.error('Addition Failed', 'Failed to add checklist');
      return false;
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
