import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { RouteError } from '@/components/RouteError';
import { NOINDEX_META } from '@/config/app';

export const Route = createFileRoute('/_app/dashboard')({
  head: () => ({ meta: [NOINDEX_META] }),
  component: Dashboard,
  errorComponent: RouteError,
});
