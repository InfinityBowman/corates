import { createFileRoute, notFound } from '@tanstack/react-router';

// A workspace has no page of its own; Home is /dashboard.
export const Route = createFileRoute('/_app/_protected/$workspace/')({
  beforeLoad: () => {
    throw notFound();
  },
});
