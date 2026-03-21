/**
 * Hono RPC Client
 * Type-safe API client using hc from hono/client with AppType from the workers package.
 * Run `pnpm --filter workers build:rpc` to regenerate types after backend route changes.
 * See docs/audits/hono-rpc-migration.md for architecture details.
 */

import { hc } from 'hono/client';
import type { AppType } from '@workers/rpc';
import { API_BASE } from '@/config/api';

// Pre-computed client type for IDE performance (official Hono recommendation).
// Moves type instantiation to compile time so tsserver doesn't re-compute
// all route types on every use.
type Client = ReturnType<typeof hc<AppType>>;
const hcWithType = (...args: Parameters<typeof hc>): Client => hc<AppType>(...args);

export const api = hcWithType(API_BASE, {
  init: { credentials: 'include' },
});
