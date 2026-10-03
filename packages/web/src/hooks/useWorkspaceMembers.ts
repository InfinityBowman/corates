/**
 * useWorkspaceMembers - a workspace's members, pending invitations, and seat
 * usage. Defaults to the current workspace.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { getWorkspaceMembers } from '@/server/functions/workspaces.functions';
import { useOwnedWorkspace } from '@/hooks/useWorkspaces';

export function useWorkspaceMembers(orgId?: string | null) {
  const { workspace } = useOwnedWorkspace();
  const resolvedOrgId = orgId === undefined ? workspace?.id : orgId;

  const query = useQuery({
    queryKey: queryKeys.workspaces.members(resolvedOrgId),
    queryFn: () => getWorkspaceMembers({ data: { orgId: resolvedOrgId! } }),
    enabled: !!resolvedOrgId,
    ...QUERY_STABLE,
  });

  return {
    members: query.data?.members ?? [],
    pendingInvitations: query.data?.pendingInvitations ?? [],
    seats: query.data?.seats ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
