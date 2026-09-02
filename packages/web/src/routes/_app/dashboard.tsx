import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
  errorComponent: RouteError,
});
