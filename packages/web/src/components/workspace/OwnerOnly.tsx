/** Renders a workspace settings page for its owner, and the owner-only notice for anyone else. */

import { useCurrentWorkspace } from '@/hooks/useWorkspaces';
import { OwnerOnlyNotice } from './OwnerOnlyNotice';

export function OwnerOnly({ title, children }: { title: string; children: React.ReactNode }) {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;
  if (workspace.role !== 'owner') return <OwnerOnlyNotice title={title} />;
  return children;
}
