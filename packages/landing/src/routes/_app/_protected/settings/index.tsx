import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/_protected/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile' });
  },
});
