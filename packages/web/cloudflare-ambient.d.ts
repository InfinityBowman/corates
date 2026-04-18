// Narrow declarations for Cloudflare Worker APIs that src/server.ts and
// src/routes/api/*.ts use. Kept minimal on purpose — importing
// @cloudflare/workers-types or the full `wrangler types --include-runtime`
// output overrides DOM types (Response.json() etc.) and surfaces latent
// strictness issues across web client code. These stubs are enough for
// the small server-side surface without affecting client code.

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  readonly props?: unknown;
}

declare interface MessageBatch<Body = unknown> {
  readonly messages: ReadonlyArray<{
    readonly id: string;
    readonly timestamp: Date;
    readonly body: Body;
    ack(): void;
    retry(options?: { delaySeconds?: number }): void;
  }>;
  readonly queue: string;
  ackAll(): void;
  retryAll(options?: { delaySeconds?: number }): void;
}

declare module 'cloudflare:workers' {
  export const env: Cloudflare.Env;
}
