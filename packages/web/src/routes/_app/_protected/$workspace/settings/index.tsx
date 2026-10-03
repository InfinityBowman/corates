import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/_protected/$workspace/settings/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$workspace/settings/general', params });
  },
});
