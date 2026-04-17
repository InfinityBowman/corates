// Public API surface for @corates/workers, intentionally hand-maintained.
//
// Consumers (packages/web, etc.) resolve types through this file via the
// "exports.types" entry in package.json — NOT through src/index.ts. That
// firewall keeps workers' internal source (Cloudflare runtime types, pre-
// existing @ts-expect-error directives, complex better-auth inferred types)
// from bleeding into consumers' tsc passes.
//
// Runtime imports still resolve to src/index.ts via vite/wrangler bundlers;
// those bundlers don't typecheck, so source-side type smells don't affect
// consumers at bundle time.
//
// Keep this file in sync with the named exports in src/index.ts. The public
// surface is small on purpose.

export declare class UserSession {
  fetch(request: Request): Promise<Response>;
}

export declare class ProjectDoc {
  fetch(request: Request): Promise<Response>;
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void>;
  webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void>;
}

export declare const app: {
  fetch(request: Request, env: unknown, ctx?: unknown): Promise<Response>;
};

export declare const workerHandler: {
  fetch(request: Request, env: unknown, ctx?: unknown): Promise<Response>;
  queue(batch: unknown, env: unknown): Promise<void>;
};
