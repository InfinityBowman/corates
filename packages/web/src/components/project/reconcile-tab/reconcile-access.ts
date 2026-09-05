/**
 * Who may reconcile a checklist pair: the project owner, or a reviewer
 * assigned to one of the two checklists.
 */

export interface AssignedChecklist {
  assignedTo?: string | null;
}

export function canReconcileChecklists(
  checklists: AssignedChecklist[],
  userId: string | null | undefined,
  isOwner: boolean,
): boolean {
  if (isOwner) return true;
  if (!userId) return false;
  return checklists.some(c => c.assignedTo === userId);
}
