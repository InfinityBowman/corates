/**
 * Shared admin-check utilities.
 * Keep this logic consistent across Hono middleware and Better Auth admin plugin.
 */

/**
 * Check if a user is an admin.
 * Role-based only.
 * @param {Record<string, any> | null | undefined} user
 * @returns {boolean}
 */
export function isAdminUser(user) {
  if (!user) return false;

  return user.role === 'admin';
}
