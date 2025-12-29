/**
 * Centralized Query Key Factory
 *
 * Provides consistent query keys across the application to prevent
 * cache invalidation bugs from inconsistent key usage.
 */

export const queryKeys = {
  // Project queries
  projects: {
    /** All projects (for removal operations) */
    all: ['projects'],
    /** Projects for a specific user */
    list: userId => ['projects', userId],
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
