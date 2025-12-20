/**
 * Zod validation schemas for seed functions
 * Ensures type safety and validation for test data seeding
 */

import { z } from 'zod/v4';
import { PROJECT_ROLES } from '../config/constants.js';

/**
 * Subscription tier enum
 */
const SUBSCRIPTION_TIERS = ['free', 'basic', 'pro', 'team', 'enterprise'];

/**
 * Subscription status enum
 */
const SUBSCRIPTION_STATUSES = ['active', 'canceled', 'past_due', 'trialing', 'incomplete'];

/**
 * Helper to convert Date or number (timestamp) to Date
 */
const dateOrTimestamp = z.union([z.date(), z.number().int()]).transform(val => {
  if (typeof val === 'number') {
    return new Date(val * 1000); // Convert Unix timestamp (seconds) to Date
  }
  return val;
});

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
});

/**
 * Schema for seeding a project
 */
export const seedProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().nullable().optional().default(null),
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
  userId: z.string().min(1, 'User ID is required'),
  tier: z
    .enum(SUBSCRIPTION_TIERS, {
      error: `Tier must be one of: ${SUBSCRIPTION_TIERS.join(', ')}`,
    })
    .default('free'),
  status: z
    .enum(SUBSCRIPTION_STATUSES, {
      error: `Status must be one of: ${SUBSCRIPTION_STATUSES.join(', ')}`,
    })
    .default('active'),
  stripeCustomerId: z.string().nullable().optional().default(null),
  stripeSubscriptionId: z.string().nullable().optional().default(null),
  currentPeriodStart: z
    .union([z.date(), z.number().int(), z.null()])
    .optional()
    .transform(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      return Math.floor(val.getTime() / 1000);
    })
    .default(null),
  currentPeriodEnd: z
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
  createdAt: dateOrTimestampToNumber,
  updatedAt: dateOrTimestampToNumber,
});
