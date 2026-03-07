export const PROJECT_ROLES = ['owner', 'member'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const EDIT_ROLES = ['owner', 'member'] as const;
export type EditRole = (typeof EDIT_ROLES)[number];

export const ADMIN_ROLES = ['owner'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const SUBSCRIPTION_TIERS = ['free', 'basic', 'pro', 'team', 'enterprise'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'canceled',
  'past_due',
  'trialing',
  'incomplete',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const DEFAULT_SUBSCRIPTION_TIER: SubscriptionTier = 'free';

export const DEFAULT_SUBSCRIPTION_STATUS: SubscriptionStatus = 'active';

export const ACTIVE_STATUSES: readonly SubscriptionStatus[] = [
  SUBSCRIPTION_STATUSES[0],
  SUBSCRIPTION_STATUSES[3],
];

export const FILE_SIZE_LIMITS = {
  PDF: 50 * 1024 * 1024,
  IMAGE: 10 * 1024 * 1024,
  AVATAR: 2 * 1024 * 1024,
  DEFAULT: 25 * 1024 * 1024,
} as const;

export const RATE_LIMITS = {
  AUTH: {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  },
  EMAIL: {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  },
  SEARCH: {
    limit: 30,
    windowMs: 60 * 1000,
  },
  API: {
    limit: 100,
    windowMs: 60 * 1000,
  },
} as const;

export const SESSION_CONFIG = {
  CLEANUP_HOURS: 24,
  ALARM_INTERVAL_MS: 60 * 60 * 1000,
} as const;

export const TIME_DURATIONS = {
  INVITATION_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  INVITATION_EXPIRY_SEC: 7 * 24 * 60 * 60,
  MERGE_VERIFICATION_EXPIRY_MS: 15 * 60 * 1000,
  IMPERSONATION_SESSION_SEC: 60 * 60,
  STATS_RECENT_DAYS: 7,
  STATS_RECENT_DAYS_SEC: 7 * 24 * 60 * 60,
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  ONE_DAY_SEC: 24 * 60 * 60,
  ONE_HOUR_MS: 60 * 60 * 1000,
  ONE_HOUR_SEC: 60 * 60,
} as const;

export const GRANT_CONFIG = {
  DURATION_MONTHS: 6,
  TRIAL_DAYS: 14,
} as const;

export const CACHE_DURATIONS = {
  CORS_PREFLIGHT_SEC: 24 * 60 * 60,
  AVATAR_SEC: 365 * 24 * 60 * 60,
  PDF_SEC: 60 * 60,
  HSTS_SEC: 180 * 24 * 60 * 60,
} as const;

export const QUERY_LIMITS = {
  R2_LIST_BATCH_SIZE: 1000,
  LEDGER_QUERY_LIMIT: 100,
  STORAGE_PROCESSING_CAP: 10000,
  RECENT_FAILURES_DISPLAY: 5,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
} as const;

export const ORG_LIMITS = {
  MEMBERSHIP_LIMIT: 100,
} as const;

export const WEBHOOK_CONFIG = {
  FAILURE_THRESHOLD: 100,
} as const;

export function isValidRole(role: string): role is ProjectRole {
  return (PROJECT_ROLES as readonly string[]).includes(role);
}

export function canEdit(role: string): role is EditRole {
  return (EDIT_ROLES as readonly string[]).includes(role);
}

export function canManageMembers(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export function isValidSubscriptionTier(tier: string): tier is SubscriptionTier {
  return (SUBSCRIPTION_TIERS as readonly string[]).includes(tier);
}

export function isValidSubscriptionStatus(status: string): status is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}
