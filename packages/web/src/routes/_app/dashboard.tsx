/**
 * /dashboard: signed out it is the local-appraisals home; signed in it sends
 * the user to their workspace, where the dashboard now lives.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { RouteError } from '@/components/RouteError';
import { WorkspaceRedirect } from '@/components/workspace/WorkspaceRedirect';
import { PageLoader } from '@/components/ui/spinner';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { workspaceHomePath } from '@/lib/workspacePaths';

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardRoute,
  errorComponent: RouteError,
});

function DashboardRoute() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);
  if (isAuthLoading) return <PageLoader label='Loading...' />;
  if (isLoggedIn) return <WorkspaceRedirect toPath={workspaceHomePath} fallback={<Dashboard />} />;
  return <Dashboard />;
}
