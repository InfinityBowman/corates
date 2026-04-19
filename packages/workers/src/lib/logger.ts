import { initWorkersLogger } from 'evlog/workers';

interface InitOptions {
  service: string;
  environment?: string;
  enabled?: boolean;
}

let initialized = false;

// Idempotent. Safe to call from every Worker fetch handler -- first call wins.
// Needed because TanStack Start's bundle layout doesn't reliably evaluate
// user module-scope code before the first route emit.
export function ensureWorkersLog({ service, environment, enabled = true }: InitOptions): void {
  if (initialized) return;
  initialized = true;
  const env = environment ?? 'production';
  const isDev = env !== 'production';
  initWorkersLogger({
    enabled,
    env: { service, environment: env },
    pretty: isDev,
    stringify: false,
    redact: !isDev,
  });
}

export { createWorkersLogger } from 'evlog/workers';
export { createError, log } from 'evlog';
export { identifyUser, maskEmail } from 'evlog/better-auth';
export type { RequestLogger } from 'evlog';
