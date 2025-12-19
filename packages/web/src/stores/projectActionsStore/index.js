/**
 * Project Actions Store - Centralized write operations for projects
 *
 * This store manages all write operations (mutations) for project data.
 * Components import and use it directly - no prop drilling or context needed.
 *
 * Pattern: projectStore = reads, projectActionsStore = writes
 *
 * Key Features:
 * - Tracks the "active" project, so components don't need to pass projectId
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

  // ============================================================================
  // Internal: Active Project & User Access
  // ============================================================================

  /**
   * Set the active project (called by ProjectView on mount)
   */
  function _setActiveProject(projectId) {
    activeProjectId = projectId;
  }

  /**
   * Clear the active project (called by ProjectView on unmount)
   */
  function _clearActiveProject() {
    activeProjectId = null;
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

  const study = createStudyActions(getActiveConnection, getActiveProjectId, getCurrentUserId);
  const checklist = createChecklistActions(getActiveConnection);
  const pdf = createPdfActions(getActiveConnection, getActiveProjectId, getCurrentUserId);
  const project = createProjectActions(getActiveConnection, getActiveProjectId);
  const member = createMemberActions(getActiveProjectId, getCurrentUserId);
  const reconciliation = createReconciliationActions(getActiveConnection);

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

    // Action modules
    study,
    checklist,
    pdf,
    project,
    member,
    reconciliation,
  };
}

// Singleton - no createRoot needed (same pattern as projectStore.js)
const projectActionsStore = createProjectActionsStore();

export default projectActionsStore;
