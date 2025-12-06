/**
 * useProjectMemberHandlers - Extracted member/project management handlers
 * Handles project deletion, member removal, and related operations
 */

import { useNavigate } from '@solidjs/router';
import { API_BASE } from '@config/api.js';
import { showToast } from '@components/zag/Toast.jsx';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * @param {string} projectId - The project ID
 * @param {Object} confirmDialog - Confirm dialog instance
 */
export default function useProjectMemberHandlers(projectId, confirmDialog) {
  const navigate = useNavigate();
  const { user } = useBetterAuth();

  const handleDeleteProject = async () => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Project',
      description:
        'Are you sure you want to delete this entire project? This action cannot be undone.',
      confirmText: 'Delete Project',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }
      projectStore.removeProjectFromList(projectId);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Error deleting project:', err);
      showToast.error('Delete Failed', err.message || 'Failed to delete project');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    const currentUser = user();
    const isSelf = currentUser?.id === memberId;

    const confirmed = await confirmDialog.open({
      title: isSelf ? 'Leave Project' : 'Remove Member',
      description:
        isSelf ?
          'Are you sure you want to leave this project? You will need to be re-invited to rejoin.'
        : `Are you sure you want to remove ${memberName} from this project?`,
      confirmText: isSelf ? 'Leave Project' : 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      if (isSelf) {
        projectStore.removeProjectFromList(projectId);
        navigate('/dashboard', { replace: true });
        showToast.success('Left Project', 'You have left the project');
      } else {
        showToast.success('Member Removed', `${memberName} has been removed from the project`);
      }
    } catch (err) {
      console.error('Error removing member:', err);
      showToast.error('Remove Failed', err.message || 'Failed to remove member');
    }
  };

  return {
    handleDeleteProject,
    handleRemoveMember,
  };
}
