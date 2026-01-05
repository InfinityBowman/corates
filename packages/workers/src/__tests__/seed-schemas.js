/**
 * Zod validation schemas for seed functions
 * Ensures type safety and validation for test data seeding
 */

import { z } from 'zod';
import { PROJECT_ROLES } from '../config/constants.js';

/**
 * Helper to convert Date or number (timestamp) to number (Unix timestamp in seconds)
 */
const dateOrTimestampToNumber = z.union([z.date(), z.number().int()]).transform(val => {
  if (val instanceof Date) {
    return Math.floor(val.getTime() / 1000); // Convert Date to Unix timestamp (seconds)
  }
  return val;
});

/**
 * Schema for seeding a user
 */
export const seedUserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  createdAt: dateOrTimestampToNumber,
  updatedAt: dateOrTimestampToNumber,
  role: z.string().optional().default('researcher'),
  displayName: z.string().nullable().optional().default(null),
  username: z.string().nullable().optional().default(null),
  banned: z
    .union([z.boolean(), z.number()])
    .transform(val => (val === true || val === 1 ? 1 : 0))
    .default(0),
  banReason: z.string().nullable().optional().default(null),
  banExpires: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  emailVerified: z
    .union([z.boolean(), z.number()])
    .transform(val => (val === true || val === 1 ? 1 : 0))
    .default(0),
  // All accounts should have a Stripe customer ID (Better Auth creates one on signup)
  stripeCustomerId: z.string().nullable().optional().default('cus_test_default'),
});

/**
 * Schema for seeding an organization
 */
export const seedOrganizationSchema = z.object({
  id: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().nullable().optional().default(null),
  logo: z.string().nullable().optional().default(null),
  metadata: z.string().nullable().optional().default(null),
  createdAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding an organization member
 */
export const seedOrgMemberSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
  createdAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding a project
 */
export const seedProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().nullable().optional().default(null),
  orgId: z.string().nullable().optional().default(null),
  createdBy: z.string().min(1, 'Created by user ID is required'),
  createdAt: dateOrTimestampToNumber,
  updatedAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding a project member
 */
export const seedProjectMemberSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  role: z
    .enum(PROJECT_ROLES, {
      error: `Role must be one of: ${PROJECT_ROLES.join(', ')}`,
    })
    .default('member'),
  joinedAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding a session
 */
export const seedSessionSchema = z.object({
  id: z.string().min(1, 'Session ID is required'),
  token: z.string().min(1, 'Token is required'),
  userId: z.string().min(1, 'User ID is required'),
  expiresAt: dateOrTimestampToNumber,
  createdAt: dateOrTimestampToNumber,
  updatedAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding a subscription
 */
export const seedSubscriptionSchema = z.object({
  id: z.string().min(1, 'Subscription ID is required'),
  // Better Auth Stripe table fields (org-scoped via referenceId = orgId)
  plan: z.string().min(1, 'Plan is required'),
  referenceId: z.string().min(1, 'Reference ID is required'),
  status: z.string().optional().default('active'),
  stripeCustomerId: z.string().nullable().optional().default(null),
  stripeSubscriptionId: z.string().nullable().optional().default(null),
  periodStart: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  periodEnd: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  cancelAtPeriodEnd: z
    .union([z.boolean(), z.number()])
    .transform(val => (val === true || val === 1 ? 1 : 0))
    .default(0),
  cancelAt: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  canceledAt: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  endedAt: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  seats: z.number().int().nullable().optional().default(null),
  trialStart: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  trialEnd: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  createdAt: dateOrTimestampToNumber,
  updatedAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding a media file
 */
export const seedMediaFileSchema = z.object({
  id: z.string().min(1, 'Media file ID is required'),
  filename: z.string().min(1, 'Filename is required'),
  originalName: z.string().nullable().optional().default(null),
  fileType: z.string().nullable().optional().default(null),
  fileSize: z.number().int().nullable().optional().default(null),
  uploadedBy: z.string().nullable().optional().default(null),
  bucketKey: z.string().min(1, 'Bucket key is required'),
  orgId: z.string().min(1, 'Organization ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  studyId: z.string().nullable().optional().default(null),
  createdAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding a project invitation
 */
export const seedProjectInvitationSchema = z.object({
  id: z.string().min(1, 'Invitation ID is required'),
  orgId: z.string().min(1, 'Organization ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  email: z.string().email('Invalid email address'),
  role: z
    .enum(PROJECT_ROLES, {
      error: `Role must be one of: ${PROJECT_ROLES.join(', ')}`,
    })
    .default('member'),
  orgRole: z.enum(['owner', 'admin', 'member']).default('member'),
  grantOrgMembership: z
    .union([z.boolean(), z.number()])
    .transform(val => (val === true || val === 1 ? 1 : 0))
    .default(0),
  token: z.string().min(1, 'Token is required'),
  invitedBy: z.string().min(1, 'Invited by user ID is required'),
  expiresAt: dateOrTimestampToNumber,
  acceptedAt: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  createdAt: dateOrTimestampToNumber,
});

/**
 * Schema for seeding a Stripe event ledger entry
 */
export const seedStripeEventLedgerSchema = z.object({
  id: z.string().min(1, 'Ledger entry ID is required'),
  payloadHash: z.string().min(1, 'Payload hash is required'),
  signaturePresent: z
    .union([z.boolean(), z.number()])
    .transform(val => (val === true || val === 1 ? 1 : 0))
    .default(1),
  receivedAt: dateOrTimestampToNumber,
  route: z.string().min(1, 'Route is required'),
  requestId: z.string().min(1, 'Request ID is required'),
  status: z
    .enum(['received', 'processed', 'skipped_duplicate', 'failed', 'ignored_unverified'])
    .default('received'),
  error: z.string().nullable().optional().default(null),
  httpStatus: z.number().int().nullable().optional().default(null),
  stripeEventId: z.string().nullable().optional().default(null),
  type: z.string().nullable().optional().default(null),
  livemode: z
    .union([z.boolean(), z.number(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      return val === true || val === 1 ? 1 : 0;
    })
    .default(null),
  apiVersion: z.string().nullable().optional().default(null),
  created: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  processedAt: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  orgId: z.string().nullable().optional().default(null),
  stripeCustomerId: z.string().nullable().optional().default(null),
  stripeSubscriptionId: z.string().nullable().optional().default(null),
  stripeCheckoutSessionId: z.string().nullable().optional().default(null),
});
