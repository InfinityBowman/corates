/**
 * Centralized Query Key Factory
 *
 * Provides consistent query keys across the application to prevent
 * cache invalidation bugs from inconsistent key usage.
 */

export const queryKeys = {
  // Workspace (org) queries
  workspaces: {
    /** Workspaces the current user belongs to */
    list: ['workspaces'] as const,
    /** Members, pending invitations, and seat usage of one workspace */
    members: (orgId: string | null | undefined) => ['workspaces', 'members', orgId] as const,
  },

  // Project queries
  projects: {
    /** All projects for current user */
    all: ['projects'] as const,
    /** Projects for a specific user (legacy) */
    list: (userId: string | null | undefined) => ['projects', userId] as const,
    /** Members of a project (D1 projectMembers joined with user) */
    members: (projectId: string) => ['projects', 'members', projectId] as const,
    /** Pending invitations for a project */
    invitations: (projectId: string) => ['projects', 'invitations', projectId] as const,
    /** Projects within an organization (legacy, kept for backward compatibility) */
    byOrg: (orgId: string | null | undefined) => ['projects', 'org', orgId] as const,
  },

  // Subscription queries
  subscription: {
    /** Every workspace's subscription, for invalidation */
    all: ['subscription'] as const,
    /** One workspace's subscription */
    byOrg: (orgId: string | null | undefined) => ['subscription', orgId] as const,
  },

  // Billing queries
  billing: {
    /** A workspace's invoices; the bare key invalidates all of them */
    invoices: (orgId?: string | null) =>
      orgId === undefined ?
        (['billing', 'invoices'] as const)
      : (['billing', 'invoices', orgId] as const),
    /** A workspace's usage (projects, collaborators) */
    usage: (orgId: string | null | undefined) => ['billing', 'usage', orgId] as const,
  },

  // Notification center queries
  notifications: {
    all: ['notifications'] as const,
    /** Most recent page of the current user's notifications */
    list: ['notifications', 'list'] as const,
    /** Current user's unread count */
    unreadCount: ['notifications', 'unreadCount'] as const,
  },

  // Invitation queries
  invitations: {
    /** Pending, unexpired invitations addressed to the current user's email */
    pendingForMe: ['invitations', 'pendingForMe'] as const,
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
    projectDetails: (projectId: string | null | undefined) =>
      ['adminProjectDetails', projectId] as const,
    syncStats: (projectId: string | null | undefined) => ['adminSyncStats', projectId] as const,
    storageDocuments: (cursor: string | null, limit: number, prefix: string, search: string) =>
      ['storageDocuments', cursor, limit, prefix, search] as const,
    storageSummary: ['adminStorageSummary'] as const,
    billingLedger: (params: Record<string, unknown>) => ['adminBillingLedger', params] as const,
    billingStuckStates: (params: Record<string, unknown>) =>
      ['adminBillingStuckStates', params] as const,
    orgBillingReconcile: (orgId: string | null | undefined, params: Record<string, unknown>) =>
      ['adminOrgBillingReconcile', orgId, params] as const,
    databaseTables: ['admin', 'database', 'tables'] as const,
    tableSchema: (tableName: string | null | undefined) =>
      ['admin', 'database', 'schema', tableName] as const,
    tableRows: (
      tableName: string | undefined,
      page: number,
      limit: number,
      orderBy: string,
      order: string,
      filterBy: string | null,
      filterValue: string | null,
    ) =>
      [
        'admin',
        'database',
        'rows',
        tableName,
        page,
        limit,
        orderBy,
        order,
        filterBy,
        filterValue,
      ] as const,
  },
};
