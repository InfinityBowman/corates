/**
 * Project Actions Store - Centralized write operations for projects
 *
 * This store manages all write operations (mutations) for project data.
 * Components import and use it directly - no prop drilling or context needed.
 *
 * Pattern: projectStore = reads, projectActionsStore = writes
 *
 * Key Features:
 * - Tracks the "active" project AND org, so components don't need to pass IDs
 * - Gets current user internally via useBetterAuth singleton
 * - Components call methods directly without any parameters for common operations
 *
 * The Y.js connection is registered by useProject hook when connecting.
 * High-level handlers include error handling and toasts.
 */

import { useBetterAuth } from '@api/better-auth-store.js';
import { createStudyActions } from './studies.js';
import { createChecklistActions } from './checklists.js';
import { createPdfActions } from './pdfs.js';
import { createProjectActions } from './project.js';
import { createMemberActions } from './members.js';
import { createReconciliationActions } from './reconciliation.js';
import { createOutcomeActions } from './outcomes.js';

function createProjectActionsStore() {
  /**
   * Map of projectId -> Y.js connection operations
   * Set by useProject hook when connecting
   * @type {Map<string, Object>}
   */
  const connections = new Map();

  /**
   * The currently active project ID.
   * Set by ProjectView when a project is opened.
   * Most methods use this automatically so components don't need to pass it.
   */
  let activeProjectId = null;

  /**
   * The currently active organization ID.
   * Set alongside activeProjectId for org-scoped API calls.
   */
  let activeOrgId = null;

  // ============================================================================
  // Internal: Active Project & Org & User Access
  // ============================================================================

  /**
   * Set the active project and its org (called by ProjectView on mount)
   * @param {string} projectId - The project ID
   * @param {string} orgId - The organization ID (required for org-scoped APIs)
   */
  function _setActiveProject(projectId, orgId = null) {
    activeProjectId = projectId;
    activeOrgId = orgId;
  }

  /**
   * Clear the active project (called by ProjectView on unmount)
   */
  function _clearActiveProject() {
    activeProjectId = null;
    activeOrgId = null;
  }

  /**
   * Get the active project ID, throws if none set
   */
  function getActiveProjectId() {
    if (!activeProjectId) {
      throw new Error('No active project - are you inside a ProjectView?');
    }
    return activeProjectId;
  }

  /**
   * Get active project ID or null (for components that just need to check)
   */
  function getActiveProjectIdOrNull() {
    return activeProjectId;
  }

  /**
   * Get the active org ID, throws if none set
   */
  function getActiveOrgId() {
    if (!activeOrgId) {
      throw new Error('No active org - are you inside an org-scoped route?');
    }
    return activeOrgId;
  }

  /**
   * Get active org ID or null (for components that just need to check)
   */
  function getActiveOrgIdOrNull() {
    return activeOrgId;
  }

  /**
   * Get current user ID from auth store
   */
  function getCurrentUserId() {
    const auth = useBetterAuth();
    return auth.user()?.id || null;
  }

  // ============================================================================
  // Internal: Connection Management (called by useProject hook)
  // ============================================================================

  function _setConnection(projectId, ops) {
    connections.set(projectId, ops);
  }

  function _removeConnection(projectId) {
    connections.delete(projectId);
  }

  function _getConnection(projectId) {
    return connections.get(projectId);
  }

  /**
   * Get connection for active project
   */
  function getActiveConnection() {
    const projectId = getActiveProjectId();
    return connections.get(projectId);
  }

  // ============================================================================
  // Create Action Modules
  // ============================================================================

  const study = createStudyActions(
    getActiveConnection,
    getActiveProjectId,
    getActiveOrgId,
    getCurrentUserId,
  );
  const checklist = createChecklistActions(getActiveConnection);
  const pdf = createPdfActions(
    getActiveConnection,
    getActiveProjectId,
    getActiveOrgId,
    getCurrentUserId,
  );
  const project = createProjectActions(getActiveConnection, getActiveProjectId, getActiveOrgId);
  const member = createMemberActions(getActiveProjectId, getActiveOrgId, getCurrentUserId);
  const reconciliation = createReconciliationActions(getActiveConnection);
  const outcome = createOutcomeActions(getActiveConnection);

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    // Internal - called by useProject hook and ProjectView
    _setConnection,
    _removeConnection,
    _getConnection,
    _setActiveProject,
    _clearActiveProject,

    // Utility
    getActiveProjectId: getActiveProjectIdOrNull,
    getActiveOrgId: getActiveOrgIdOrNull,

    // Action modules
    study,
    checklist,
    pdf,
    project,
    member,
    reconciliation,
    outcome,
  };
}

// Singleton - no createRoot needed (same pattern as projectStore.js)
const projectActionsStore = createProjectActionsStore();

export default projectActionsStore;
