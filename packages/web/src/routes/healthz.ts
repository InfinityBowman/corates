import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: () => new Response('OK', { headers: { 'Content-Type': 'text/plain' } }),
    },
  },
});
