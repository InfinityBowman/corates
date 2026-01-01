/**
 * Centralized Query Key Factory
 *
 * Provides consistent query keys across the application to prevent
 * cache invalidation bugs from inconsistent key usage.
 */

export const queryKeys = {
  // Organization queries
  orgs: {
    /** All orgs for current user */
    list: ['orgs'],
  },

  // Project queries
  projects: {
    /** All projects for current user */
    all: ['projects'],
    /** Projects for a specific user (legacy) */
    list: userId => ['projects', userId],
    /** Projects within an organization (legacy, kept for backward compatibility) */
    byOrg: orgId => ['projects', 'org', orgId],
  },

  // Subscription queries
  subscription: {
    /** Current user's subscription */
    current: ['subscription'],
  },

  // Admin queries
  admin: {
    stats: ['adminStats'],
    users: (page, limit, search) => ['adminUsers', page, limit, search],
    userDetails: userId => ['adminUserDetails', userId],
    storageDocuments: (cursor, limit, prefix, search) => [
      'storageDocuments',
      cursor,
      limit,
      prefix,
      search,
    ],
    storageStats: ['storageStats'],
  },
};
