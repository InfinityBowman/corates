import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { devModeGate } from '@/server/devModeGate';

export const handler = async () => {
  const gated = devModeGate(env);
  if (gated) return gated;
  return Response.json({ ok: true });
};

export const Route = createFileRoute('/api/test/health')({
  server: { handlers: { GET: handler } },
});
