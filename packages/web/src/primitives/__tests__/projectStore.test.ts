/**
 * Tests for projectStore - Central store for project data (Zustand)
 *
 * P0 Priority: Core state management
 * Tests the store's ability to manage project data, connection states,
 * and active project tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/stores/projectStore.ts';
import type { StudyInfo, MemberEntry } from '@/stores/projectStore.ts';

describe('projectStore - Project Data Management', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useProjectStore.setState({
      projects: {},
      activeProjectId: null,
      connections: {},
      projectStats: {},
    });
  });

  describe('setProjectData / getState', () => {
    it('should store and retrieve project data', () => {
      const projectId = 'test-project-1';
      const data = {
        studies: [{ id: 'study-1', name: 'Test Study' } as StudyInfo],
        members: [{ userId: 'user-1', role: 'owner' } as MemberEntry],
        meta: { name: 'Test Project', description: 'A test project' },
      };

      useProjectStore.getState().setProjectData(projectId, data);
      const state = useProjectStore.getState();

      expect(state.projects[projectId]).toBeDefined();
      expect(state.projects[projectId].studies).toEqual(data.studies);
      expect(state.projects[projectId].members).toEqual(data.members);
      expect(state.projects[projectId].meta).toEqual(data.meta);
    });

    it('should initialize project with empty arrays if not set', () => {
      const projectId = 'test-project-2';
      useProjectStore.getState().setProjectData(projectId, {});

      const project = useProjectStore.getState().projects[projectId];
      expect(project.studies).toEqual([]);
      expect(project.members).toEqual([]);
      expect(project.meta).toEqual({});
    });

    it('should update existing project data without overwriting unset fields', () => {
      const projectId = 'test-project-3';

      useProjectStore.getState().setProjectData(projectId, {
        studies: [{ id: 'study-1', name: 'Study 1' } as StudyInfo],
        members: [{ userId: 'user-1', role: 'owner' } as MemberEntry],
        meta: { name: 'Original Name' },
      });

      // Update only studies
      useProjectStore.getState().setProjectData(projectId, {
        studies: [
          { id: 'study-1', name: 'Study 1' } as StudyInfo,
          { id: 'study-2', name: 'Study 2' } as StudyInfo,
        ],
      });

      const project = useProjectStore.getState().projects[projectId];
      expect(project.studies.length).toBe(2);
      expect(project.members.length).toBe(1);
      expect(project.meta.name).toBe('Original Name');
    });
  });

  describe('clearProject', () => {
    it('should remove project from cache', () => {
      const projectId = 'to-clear';
      useProjectStore.getState().setProjectData(projectId, { meta: { name: 'To Clear' } });
      expect(useProjectStore.getState().projects[projectId]).toBeDefined();

      useProjectStore.getState().clearProject(projectId);
      expect(useProjectStore.getState().projects[projectId]).toBeUndefined();
    });

    it('should clear active project if it matches', () => {
      const projectId = 'active-to-clear';
      useProjectStore.getState().setProjectData(projectId, { meta: {} });
      useProjectStore.getState().setActiveProject(projectId);

      useProjectStore.getState().clearProject(projectId);

      expect(useProjectStore.getState().activeProjectId).toBeNull();
    });

    it('should also clear connection state', () => {
      const projectId = 'clear-with-connection';
      useProjectStore.getState().setProjectData(projectId, { meta: {} });
      useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'CONNECT_REQUESTED' });

      useProjectStore.getState().clearProject(projectId);

      const connState = useProjectStore.getState().connections[projectId];
      expect(connState).toBeUndefined();
    });
  });
});

describe('projectStore - Connection State Management', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: {},
      activeProjectId: null,
      connections: {},
      projectStats: {},
    });
  });

  describe('getConnectionState via selector', () => {
    it('should return default state for unknown project', () => {
      const state = useProjectStore.getState().connections['unknown'];
      // No entry exists, should be undefined (selector handles the default)
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
      projects: {},
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

    it('should return active project data when cached', () => {
      const projectId = 'active-test';
      useProjectStore.getState().setProjectData(projectId, {
        meta: { name: 'Active Project' },
        studies: [],
        members: [],
      });
      useProjectStore.getState().setActiveProject(projectId);

      const state = useProjectStore.getState();
      expect(state.activeProjectId).toBe(projectId);
      expect(state.projects[projectId].meta.name).toBe('Active Project');
    });
  });
});
