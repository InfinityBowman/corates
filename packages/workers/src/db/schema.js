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
  role: text('role').default('member'), // owner, collaborator, member, viewer
  joinedAt: integer('joinedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const mediaFiles = sqliteTable('mediaFiles', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('originalName'),
  fileType: text('fileType'),
  fileSize: integer('fileSize'),
  uploadedBy: text('uploadedBy').references(() => user.id),
  bucketKey: text('bucketKey').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Subscriptions table (Stripe billing)
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
    .unique(),
  stripeCustomerId: text('stripeCustomerId').unique(),
  stripeSubscriptionId: text('stripeSubscriptionId').unique(),
  tier: text('tier').notNull().default('free'), // 'free', 'basic', 'pro', 'enterprise'
  status: text('status').notNull().default('active'), // 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
  currentPeriodStart: integer('currentPeriodStart', { mode: 'timestamp' }),
  currentPeriodEnd: integer('currentPeriodEnd', { mode: 'timestamp' }),
  cancelAtPeriodEnd: integer('cancelAtPeriodEnd', { mode: 'boolean' }).default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
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
// Combined invite flow: accepting ensures org membership then project membership
export const projectInvitations = sqliteTable('project_invitations', {
  id: text('id').primaryKey(),
  // Organization for this project invitation (accepting grants org membership if needed)
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').default('member'), // project role
  orgRole: text('orgRole').default('member'), // org role to assign if user isn't already a member
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
  subscriptions,
  projectInvitations,
};
