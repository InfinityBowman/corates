// Public type surface for @corates/workers/queue.
//
// Hand-maintained stub mirroring src/queue.ts. The signature uses `unknown`
// for batch/env so consumers don't need to pull in MessageBatch / the full
// workers Env type; the runtime cast happens inside packages/web/src/server.ts.

export declare function handleEmailQueue(batch: unknown, env: unknown): Promise<void>;
