/**
 * User factory for tests
 */

import { seedUser } from '../helpers.js';
import { generateId, nowSec, withDefaults, emailFromId, nextCounter } from './utils.js';

/**
 * Build a user with sensible defaults
 *
 * @param {Object} [overrides] - Override any user field
 * @returns {Promise<Object>} Created user record
 *
 * @example
 * // Create user with defaults
 * const user = await buildUser();
 *
 * // Create user with specific email
 * const admin = await buildUser({ email: 'admin@example.com', role: 'admin' });
 */
export async function buildUser(overrides = {}) {
  const n = nextCounter();
  const id = overrides.id || generateId('user');
  const ts = nowSec();

  const defaults = {
    id,
    name: `Test User ${n}`,
    email: emailFromId(id),
    displayName: `Test User ${n}`,
    username: `testuser${n}`,
    role: 'user',
    emailVerified: 1,
    banned: 0,
    banReason: null,
    banExpires: null,
    stripeCustomerId: `cus_test_${id}`,
    createdAt: ts,
    updatedAt: ts,
  };

  const userData = withDefaults(defaults, overrides);
  await seedUser(userData);

  return userData;
}

/**
 * Build an admin user
 *
 * @param {Object} [overrides] - Override any user field
 * @returns {Promise<Object>} Created admin user record
 */
export async function buildAdminUser(overrides = {}) {
  return buildUser({
    role: 'admin',
    ...overrides,
  });
}

/**
 * Build a banned user
 *
 * @param {Object} [overrides] - Override any user field
 * @returns {Promise<Object>} Created banned user record
 */
export async function buildBannedUser(overrides = {}) {
  const ts = nowSec();
  return buildUser({
    banned: 1,
    banReason: overrides.banReason || 'Test ban',
    banExpires: overrides.banExpires || ts + 86400, // 1 day from now
    ...overrides,
  });
}
