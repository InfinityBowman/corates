// Narrow public surface for the `@corates/workers/auth` subpath export.
// Same rationale as ./types.d.ts — keeps internal better-auth types from
// leaking into consumer tsc passes.

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  [key: string]: unknown;
}

export interface AuthSession {
  id: string;
  userId: string;
  [key: string]: unknown;
}

export declare function getSession(
  request: Request,
  env: unknown,
): Promise<{ user: AuthUser; session: AuthSession } | null>;
