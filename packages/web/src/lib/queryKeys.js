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
    /** Details for a specific organization */
    detail: orgId => ['org', orgId],
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

  // Billing queries
  billing: {
    /** Current org/user invoices */
    invoices: ['billing', 'invoices'],
  },

  // Members queries
  members: {
    /** Current org's members */
    current: ['members'],
  },

  // Account queries
  accounts: {
    /** Linked accounts for current user */
    linked: ['accounts', 'linked'],
  },

  // Admin queries
  admin: {
    stats: ['adminStats'],
    users: (page, limit, search) => ['adminUsers', page, limit, search],
    userDetails: userId => ['adminUserDetails', userId],
    orgs: (page, limit, search) => ['adminOrgs', page, limit, search],
    orgDetails: orgId => ['adminOrgDetails', orgId],
    orgBilling: orgId => ['adminOrgBilling', orgId],
    storageDocuments: (cursor, limit, prefix, search) => [
      'storageDocuments',
      cursor,
      limit,
      prefix,
      search,
    ],
    storageStats: ['storageStats'],
    billingLedger: params => ['adminBillingLedger', params],
    billingStuckStates: params => ['adminBillingStuckStates', params],
    orgBillingReconcile: (orgId, params) => ['adminOrgBillingReconcile', orgId, params],
    databaseTables: ['admin', 'database', 'tables'],
    tableSchema: tableName => ['admin', 'database', 'schema', tableName],
    tableRows: (tableName, page, limit, orderBy, order) => [
      'admin',
      'database',
      'rows',
      tableName,
      page,
      limit,
      orderBy,
      order,
    ],
  },
};
