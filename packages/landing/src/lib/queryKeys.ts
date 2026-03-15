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
    list: ['orgs'] as const,
    /** Details for a specific organization */
    detail: (orgId: string) => ['org', orgId] as const,
  },

  // Project queries
  projects: {
    /** All projects for current user */
    all: ['projects'] as const,
    /** Projects for a specific user (legacy) */
    list: (userId: string | null | undefined) => ['projects', userId] as const,
    /** Projects within an organization (legacy, kept for backward compatibility) */
    byOrg: (orgId: string | null | undefined) => ['projects', 'org', orgId] as const,
  },

  // Subscription queries
  subscription: {
    /** Current user's subscription */
    current: ['subscription'] as const,
  },

  // Billing queries
  billing: {
    /** Current org/user invoices */
    invoices: ['billing', 'invoices'] as const,
    /** Current org usage (projects, collaborators) */
    usage: ['billing', 'usage'] as const,
  },

  // Members queries
  members: {
    /** Current org's members */
    current: ['members'] as const,
  },

  // Account queries
  accounts: {
    /** Linked accounts for current user */
    linked: ['accounts', 'linked'] as const,
  },

  // Admin queries
  admin: {
    stats: ['adminStats'] as const,
    users: (page: number, limit: number, search: string) =>
      ['adminUsers', page, limit, search] as const,
    userDetails: (userId: string | null | undefined) => ['adminUserDetails', userId] as const,
    orgs: (page: number, limit: number, search: string) =>
      ['adminOrgs', page, limit, search] as const,
    orgDetails: (orgId: string | null | undefined) => ['adminOrgDetails', orgId] as const,
    orgBilling: (orgId: string | null | undefined) => ['adminOrgBilling', orgId] as const,
    projects: (page: number, limit: number, search: string, orgId?: string) =>
      ['adminProjects', page, limit, search, orgId] as const,
    projectDetails: (projectId: string | null | undefined) => ['adminProjectDetails', projectId] as const,
    storageDocuments: (
      cursor: string | null,
      limit: number,
      prefix: string,
      search: string,
    ) => ['storageDocuments', cursor, limit, prefix, search] as const,
    storageStats: ['storageStats'] as const,
    billingLedger: (params: Record<string, unknown>) => ['adminBillingLedger', params] as const,
    billingStuckStates: (params: Record<string, unknown>) =>
      ['adminBillingStuckStates', params] as const,
    orgBillingReconcile: (orgId: string | null | undefined, params: Record<string, unknown>) =>
      ['adminOrgBillingReconcile', orgId, params] as const,
    databaseTables: ['admin', 'database', 'tables'] as const,
    tableSchema: (tableName: string | null | undefined) => ['admin', 'database', 'schema', tableName] as const,
    tableRows: (
      tableName: string | undefined,
      page: number,
      limit: number,
      orderBy: string,
      order: string,
      filterBy: string | null,
      filterValue: string | null,
    ) => ['admin', 'database', 'rows', tableName, page, limit, orderBy, order, filterBy, filterValue] as const,
  },
};
