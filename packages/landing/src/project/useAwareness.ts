/**
 * useAwareness - Returns the Y.js Awareness instance for the active project.
 * Used for presence features in reconciliation views.
 */

import { connectionPool } from './ConnectionPool';

export function useAwareness(projectId: string): unknown {
  return connectionPool.getAwareness(projectId);
}
