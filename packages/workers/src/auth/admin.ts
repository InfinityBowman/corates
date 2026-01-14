/**
 * Shared admin-check utilities.
 * Keep this logic consistent across Hono middleware and Better Auth admin plugin.
 */

/**
 * Check if a user is an admin.
 * Role-based only.
 * Accepts any object with a role property.
 */
export function isAdminUser(user: { role?: string | null } | null | undefined): boolean {
  if (!user) return false;

  return user.role === 'admin';
}
