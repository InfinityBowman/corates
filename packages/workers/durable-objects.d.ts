// Public type surface for @corates/workers/durable-objects.
//
// Hand-maintained stub mirroring the runtime exports from
// src/durable-objects/index.ts. Same firewall pattern as types.d.ts — keeps
// internal Cloudflare runtime types out of consumers' tsc passes (web does
// not pull in @cloudflare/workers-types).

export declare class UserSession {
  fetch(request: Request): Promise<Response>;
}

export declare class ProjectDoc {
  fetch(request: Request): Promise<Response>;
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void>;
  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void>;
}

// The sync-engine workspace DO (@cf-sync/server createWorkspaceDO over the
// @corates/shared/sync app). Opaque on purpose: traffic reaches it through
// the routers in @corates/workers/sync, never instance methods.
export declare class WorkspaceDO {
  fetch(request: Request): Promise<Response>;
}
