import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  username: text('username').unique(),
  displayName: text('displayName'),
  avatarUrl: text('avatarUrl'),
  role: text('role'), // Better Auth admin/plugin role (e.g. 'user', 'admin')
  persona: text('persona'), // optional: researcher, student, librarian, other
  profileCompletedAt: integer('profileCompletedAt'), // unix timestamp (seconds)
  twoFactorEnabled: integer('twoFactorEnabled', { mode: 'boolean' }).default(false),
  // Admin plugin fields
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('banReason'),
  banExpires: integer('banExpires', { mode: 'timestamp' }),
  // Better Auth Stripe plugin field
  stripeCustomerId: text('stripeCustomerId'),
});

// Organizations table (Better Auth organization plugin)
export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  metadata: text('metadata'), // JSON string for additional org data
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Organization members table (Better Auth organization plugin)
export const member = sqliteTable('member', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // owner, admin, member
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Organization invitations table (Better Auth organization plugin)
export const invitation = sqliteTable('invitation', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  inviterId: text('inviterId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('pending'), // pending, accepted, rejected, canceled
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Sessions table
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: text('impersonatedBy').references(() => user.id, { onDelete: 'set null' }),
  // Organization plugin field - tracks user's active organization
  activeOrganizationId: text('activeOrganizationId').references(() => organization.id, {
    onDelete: 'set null',
  }),
});

// Accounts table (for OAuth)
export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'), // For email/password auth
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Verification table
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// App-specific tables

// Projects table (for user's research projects)
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  // Organization that owns this project
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  createdBy: text('createdBy')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Project membership table (which users have access to which projects)
export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member'), // owner, member
  joinedAt: integer('joinedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const mediaFiles = sqliteTable('mediaFiles', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('originalName'),
  fileType: text('fileType'),
  fileSize: integer('fileSize'),
  uploadedBy: text('uploadedBy').references(() => user.id, { onDelete: 'set null' }),
  bucketKey: text('bucketKey').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Better Auth Stripe subscription table
export const subscription = sqliteTable('subscription', {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(), // Plan name (e.g., 'starter_team', 'team', 'unlimited_team')
  referenceId: text('referenceId').notNull(), // Org ID (orgId) for org-scoped billing
  stripeCustomerId: text('stripeCustomerId'),
  stripeSubscriptionId: text('stripeSubscriptionId'),
  status: text('status').notNull().default('incomplete'), // active, trialing, past_due, canceled, paused, unpaid, incomplete, incomplete_expired
  periodStart: integer('periodStart', { mode: 'timestamp' }),
  periodEnd: integer('periodEnd', { mode: 'timestamp' }),
  cancelAtPeriodEnd: integer('cancelAtPeriodEnd', { mode: 'boolean' }).default(false),
  cancelAt: integer('cancelAt', { mode: 'timestamp' }),
  canceledAt: integer('canceledAt', { mode: 'timestamp' }),
  endedAt: integer('endedAt', { mode: 'timestamp' }),
  seats: integer('seats'),
  trialStart: integer('trialStart', { mode: 'timestamp' }),
  trialEnd: integer('trialEnd', { mode: 'timestamp' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Org access grants table (for trial and single_project grants)
export const orgAccessGrants = sqliteTable('org_access_grants', {
  id: text('id').primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'trial' | 'single_project'
  startsAt: integer('startsAt', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  revokedAt: integer('revokedAt', { mode: 'timestamp' }), // null if not revoked
  // Idempotency field for Stripe checkout sessions (prevents duplicate grants from webhook retries)
  stripeCheckoutSessionId: text('stripeCheckoutSessionId').unique(),
  metadata: text('metadata'), // JSON string for additional data
});

// Two-Factor Authentication table
export const twoFactor = sqliteTable('twoFactor', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(), // JSON array of backup codes
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Project invitations table (for inviting users to projects)
// Projects are always invite-only: accepting grants project membership only by default.
// Optional: grantOrgMembership can be set to true by org admins/owners for governance/billing.
export const projectInvitations = sqliteTable('project_invitations', {
  id: text('id').primaryKey(),
  // Organization for this project invitation
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').default('member'), // project role
  orgRole: text('orgRole').default('member'), // org role if grantOrgMembership is true
  grantOrgMembership: integer('grantOrgMembership', { mode: 'boolean' }).default(false).notNull(), // if true, accepting invite also grants org membership
  token: text('token').notNull().unique(),
  invitedBy: text('invitedBy')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  acceptedAt: integer('acceptedAt', { mode: 'timestamp' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Export all tables
export const dbSchema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  organization,
  member,
  invitation,
  projects,
  projectMembers,
  mediaFiles,
  subscription,
  orgAccessGrants,
  projectInvitations,
};
