import { createFileRoute } from '@tanstack/react-router';
import { CreateOrgPage } from '@/components/org/CreateOrgPage';

export const Route = createFileRoute('/_app/_protected/orgs/new')({
  component: CreateOrgPage,
});
