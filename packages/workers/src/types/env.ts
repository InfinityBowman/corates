/**
 * Env type for Cloudflare Workers
 * This extends the globally declared Env from worker-configuration.d.ts
 */

// Re-export from Cloudflare namespace which is declared in worker-configuration.d.ts
export type Env = Cloudflare.Env;
