import type { Context } from 'hono';
import type { Env } from './env';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  displayName?: string | null;
  image?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  persona?: string | null;
  profileCompletedAt?: number | null;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  banned?: boolean;
  banReason?: string | null;
  banExpires?: Date | null;
  stripeCustomerId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  impersonatedBy?: string | null;
  activeOrganizationId?: string | null;
}

export interface AppVariables {
  user: AuthUser | null;
  session: AuthSession | null;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;
