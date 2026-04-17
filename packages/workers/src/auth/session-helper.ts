import { createAuth } from './config';
import type { Env } from '../types';

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

export async function getSession(
  request: Request,
  env: Env,
): Promise<{ user: AuthUser; session: AuthSession } | null> {
  const auth = createAuth(env);
  const result = await auth.api.getSession({ headers: request.headers });
  if (!result?.user) return null;
  return {
    user: result.user as unknown as AuthUser,
    session: result.session as unknown as AuthSession,
  };
}
