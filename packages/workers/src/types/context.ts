import type { Context } from 'hono';
import type { Env } from './env';
import type { Entitlements, Quotas, GrantType } from '@corates/shared/plans';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  givenName?: string | null;
  familyName?: string | null;
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

export interface OrgContext {
  id: string;
  name: string;
  slug: string;
}

export interface ProjectContext {
  id: string;
  name: string;
}

export interface OrgBilling {
  effectivePlanId: string;
  source: 'subscription' | 'grant' | 'free';
  accessMode: 'full' | 'readOnly' | 'free';
  entitlements: Entitlements;
  quotas: Quotas;
  subscription: {
    id: string;
    status: string;
    periodEnd: Date | number | null;
    cancelAtPeriodEnd: boolean | null;
  } | null;
  grant: {
    id: string;
    type: GrantType;
    expiresAt: Date | number | null;
  } | null;
}

export interface AppVariables {
  user: AuthUser | null;
  session: AuthSession | null;
  orgId?: string;
  orgRole?: string;
  org?: OrgContext;
  projectId?: string;
  projectRole?: string;
  project?: ProjectContext;
  orgBilling?: OrgBilling;
  entitlements?: Entitlements;
  quotas?: Quotas;
  isAdmin?: boolean;
  subscription?: unknown;
  tier?: string;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;
