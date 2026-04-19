import { z } from 'zod';
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

const authUserSchema = z.looseObject({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
});

const authSessionSchema = z.looseObject({
  id: z.string(),
  userId: z.string(),
});

export async function getSession(
  request: Request,
  env: Env,
): Promise<{ user: AuthUser; session: AuthSession } | null> {
  const auth = createAuth(env);
  const result = await auth.api.getSession({ headers: request.headers });
  if (!result?.user) return null;
  return {
    user: authUserSchema.parse(result.user) as AuthUser,
    session: authSessionSchema.parse(result.session) as AuthSession,
  };
}
