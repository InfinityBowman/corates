import type { MemberEntry, ProjectMeta } from '@/stores/projectStore';

export function resolveExportReviewer(assignedTo: string | null, members: MemberEntry[]): string {
  if (!assignedTo) return 'Reconciled';
  const member = members.find(m => m.userId === assignedTo);
  if (!member) return assignedTo;
  const name = [member.givenName, member.familyName].filter(Boolean).join(' ');
  return name || member.email;
}

export function resolveExportOutcome(outcomeId: string | null, meta?: ProjectMeta): string {
  if (!outcomeId || !meta) return '';
  const outcome = meta.outcomes?.find(o => o.id === outcomeId);
  return outcome?.name || '';
}
