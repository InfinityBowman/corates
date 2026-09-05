import { useAuthStore, selectUser } from '@/stores/authStore';
import { useProjectContext } from '../ProjectContext';
import { canReconcileChecklists, type AssignedChecklist } from './reconcile-access';

export function useCanReconcileChecklists() {
  const { projectId, isOwner } = useProjectContext();
  const user = useAuthStore(selectUser);
  // Local practice has no member list and leaves checklists unassigned
  const unrestricted = isOwner || projectId.startsWith('local-');
  return (checklists: AssignedChecklist[]) =>
    canReconcileChecklists(checklists, user?.id, unrestricted);
}
