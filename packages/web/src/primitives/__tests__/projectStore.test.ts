/**
 * Tests for projectStore - Connection state and active project tracking (Zustand)
 *
 * Collaborative data (studies, members, meta) is managed by @tldraw/state atoms
 * in projectAtoms.ts, not in this Zustand store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/stores/projectStore.ts';

describe('projectStore - Connection State Management', () => {
  beforeEach(() => {
    useProjectStore.setState({
      activeProjectId: null,
      connections: {},
      projectStats: {},
    });
  });

  describe('getConnectionState via selector', () => {
    it('should return default state for unknown project', () => {
      const state = useProjectStore.getState().connections['unknown'];
      expect(state).toBeUndefined();
    });
  });

  describe('dispatchConnectionEvent', () => {
    it('should transition through connection phases', () => {
      const projectId = 'conn-test';

      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'CONNECT_REQUESTED' });
      let conn = useProjectStore.getState().connections[projectId];
      expect(conn.phase).toBe('connecting');

      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'REMOTE_CONNECTED' });
      conn = useProjectStore.getState().connections[projectId];
      expect(conn.phase).toBe('connected');

      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'SYNC_COMPLETE' });
      conn = useProjectStore.getState().connections[projectId];
      expect(conn.phase).toBe('synced');
    });

    it('should set error state on access denied', () => {
      const projectId = 'error-test';

      useProjectStore.getState().dispatchConnectionEvent(projectId, {
        type: 'ACCESS_DENIED',
        reason: 'Connection failed',
      });

      const conn = useProjectStore.getState().connections[projectId];
      expect(conn.phase).toBe('error');
      expect(conn.error).toBe('Connection failed');
    });

    it('should reset to idle', () => {
      const projectId = 'reset-test';

      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'CONNECT_REQUESTED' });
      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'SYNC_COMPLETE' });
      expect(useProjectStore.getState().connections[projectId].phase).toBe('synced');

      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'RESET' });
      expect(useProjectStore.getState().connections[projectId].phase).toBe('idle');
    });
  });
});

describe('projectStore - Active Project', () => {
  beforeEach(() => {
    useProjectStore.setState({
      activeProjectId: null,
      connections: {},
      projectStats: {},
    });
  });

  describe('setActiveProject', () => {
    it('should return null when no active project', () => {
      expect(useProjectStore.getState().activeProjectId).toBeNull();
    });

    it('should set active project ID', () => {
      useProjectStore.getState().setActiveProject('project-123');
      expect(useProjectStore.getState().activeProjectId).toBe('project-123');
    });
  });

  describe('clearProject', () => {
    it('should clear connection state', () => {
      const projectId = 'clear-with-connection';
      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'CONNECT_REQUESTED' });

      useProjectStore.getState().clearProject(projectId);

      const connState = useProjectStore.getState().connections[projectId];
      expect(connState).toBeUndefined();
    });

    it('should clear active project if it matches', () => {
      const projectId = 'active-to-clear';
      useProjectStore.getState().setActiveProject(projectId);

      useProjectStore.getState().clearProject(projectId);

      expect(useProjectStore.getState().activeProjectId).toBeNull();
    });

    it('should not clear active project if it does not match', () => {
      useProjectStore.getState().setActiveProject('other-project');

      useProjectStore.getState().clearProject('different-project');

      expect(useProjectStore.getState().activeProjectId).toBe('other-project');
    });
  });
});
