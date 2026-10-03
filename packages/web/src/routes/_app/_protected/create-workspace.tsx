import { createFileRoute } from '@tanstack/react-router';
import { CreateWorkspacePage } from '@/components/workspace/CreateWorkspacePage';

export const Route = createFileRoute('/_app/_protected/create-workspace')({
  component: CreateWorkspacePage,
});
