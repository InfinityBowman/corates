/**
 * Tests for projectStore - Central store for project data
 *
 * P0 Priority: Core state management
 * Tests the store's ability to manage project data, connection states,
 * and project list for dashboard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';

// Reset module cache before importing to get fresh store
let projectStore;

describe('projectStore - Project Data Management', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../stores/projectStore.js');
    projectStore = module.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProject / setProjectData', () => {
    it('should return undefined for non-existent project', () => {
      createRoot(dispose => {
        const result = projectStore.getProject('non-existent');
        expect(result).toBeUndefined();
        dispose();
      });
    });

    it('should store and retrieve project data', () => {
      createRoot(dispose => {
        const projectId = 'test-project-1';
        const data = {
          studies: [{ id: 'study-1', name: 'Test Study' }],
          members: [{ userId: 'user-1', role: 'owner' }],
          meta: { name: 'Test Project', description: 'A test project' },
        };

        projectStore.setProjectData(projectId, data);
        const result = projectStore.getProject(projectId);

        expect(result).toEqual(data);
        dispose();
      });
    });

    it('should initialize project with empty arrays if not set', () => {
      createRoot(dispose => {
        const projectId = 'test-project-2';
        projectStore.setProjectData(projectId, {});

        const result = projectStore.getProject(projectId);
        expect(result.studies).toEqual([]);
        expect(result.members).toEqual([]);
        expect(result.meta).toEqual({});
        dispose();
      });
    });

    it('should update existing project data without overwriting unset fields', () => {
      createRoot(dispose => {
        const projectId = 'test-project-3';

        // Initial data
        projectStore.setProjectData(projectId, {
          studies: [{ id: 'study-1', name: 'Study 1' }],
          members: [{ userId: 'user-1', role: 'owner' }],
          meta: { name: 'Original Name' },
        });

        // Update only studies
        projectStore.setProjectData(projectId, {
          studies: [
            { id: 'study-1', name: 'Study 1' },
            { id: 'study-2', name: 'Study 2' },
          ],
        });

        const result = projectStore.getProject(projectId);
        expect(result.studies.length).toBe(2);
        expect(result.members.length).toBe(1);
        expect(result.meta.name).toBe('Original Name');
        dispose();
      });
    });
  });

  describe('hasProject', () => {
    it('should return false for non-existent project', () => {
      createRoot(dispose => {
        expect(projectStore.hasProject('non-existent')).toBe(false);
        dispose();
      });
    });

    it('should return true for existing project', () => {
      createRoot(dispose => {
        projectStore.setProjectData('existing-project', { meta: {} });
        expect(projectStore.hasProject('existing-project')).toBe(true);
        dispose();
      });
    });
  });

  describe('clearProject', () => {
    it('should remove project from cache', () => {
      createRoot(dispose => {
        const projectId = 'to-clear';
        projectStore.setProjectData(projectId, { meta: { name: 'To Clear' } });
        expect(projectStore.hasProject(projectId)).toBe(true);

        projectStore.clearProject(projectId);
        expect(projectStore.hasProject(projectId)).toBe(false);
        expect(projectStore.getProject(projectId)).toBeUndefined();
        dispose();
      });
    });

    it('should clear active project if it matches', () => {
      createRoot(dispose => {
        const projectId = 'active-to-clear';
        projectStore.setProjectData(projectId, { meta: {} });
        projectStore.setActiveProject(projectId);

        projectStore.clearProject(projectId);

        expect(projectStore.store.activeProjectId).toBeNull();
        dispose();
      });
    });

    it('should also clear connection state', () => {
      createRoot(dispose => {
        const projectId = 'clear-with-connection';
        projectStore.setProjectData(projectId, { meta: {} });
        projectStore.setConnectionState(projectId, { connected: true });

        projectStore.clearProject(projectId);

        const connState = projectStore.getConnectionState(projectId);
        expect(connState.connected).toBe(false);
        dispose();
      });
    });
  });

  describe('getStudies / getMembers / getMeta', () => {
    it('should return empty arrays/objects for non-existent project', () => {
      createRoot(dispose => {
        expect(projectStore.getStudies('none')).toEqual([]);
        expect(projectStore.getMembers('none')).toEqual([]);
        expect(projectStore.getMeta('none')).toEqual({});
        dispose();
      });
    });

    it('should return correct data for existing project', () => {
      createRoot(dispose => {
        const projectId = 'getter-test';
        const studies = [{ id: 's1' }, { id: 's2' }];
        const members = [{ userId: 'u1' }];
        const meta = { name: 'Test' };

        projectStore.setProjectData(projectId, { studies, members, meta });

        expect(projectStore.getStudies(projectId)).toEqual(studies);
        expect(projectStore.getMembers(projectId)).toEqual(members);
        expect(projectStore.getMeta(projectId)).toEqual(meta);
        dispose();
      });
    });
  });

  describe('getStudy', () => {
    it('should return null for non-existent project', () => {
      createRoot(dispose => {
        expect(projectStore.getStudy('none', 'study-1')).toBeNull();
        dispose();
      });
    });

    it('should return null for non-existent study', () => {
      createRoot(dispose => {
        projectStore.setProjectData('proj', {
          studies: [{ id: 'study-1', name: 'Study 1' }],
        });

        expect(projectStore.getStudy('proj', 'non-existent')).toBeNull();
        dispose();
      });
    });

    it('should return the correct study', () => {
      createRoot(dispose => {
        const studies = [
          { id: 'study-1', name: 'Study 1' },
          { id: 'study-2', name: 'Study 2' },
        ];
        projectStore.setProjectData('proj', { studies });

        const study = projectStore.getStudy('proj', 'study-2');
        expect(study).toEqual({ id: 'study-2', name: 'Study 2' });
        dispose();
      });
    });
  });

  describe('getChecklist', () => {
    it('should return null for non-existent study', () => {
      createRoot(dispose => {
        projectStore.setProjectData('proj', { studies: [] });
        expect(projectStore.getChecklist('proj', 'study-1', 'checklist-1')).toBeNull();
        dispose();
      });
    });

    it('should return null for non-existent checklist', () => {
      createRoot(dispose => {
        projectStore.setProjectData('proj', {
          studies: [
            {
              id: 'study-1',
              checklists: [{ id: 'checklist-1', type: 'AMSTAR2' }],
            },
          ],
        });

        expect(projectStore.getChecklist('proj', 'study-1', 'non-existent')).toBeNull();
        dispose();
      });
    });

    it('should return the correct checklist', () => {
      createRoot(dispose => {
        const checklist = { id: 'checklist-1', type: 'AMSTAR2', status: 'pending' };
        projectStore.setProjectData('proj', {
          studies: [{ id: 'study-1', checklists: [checklist] }],
        });

        const result = projectStore.getChecklist('proj', 'study-1', 'checklist-1');
        expect(result).toEqual(checklist);
        dispose();
      });
    });
  });
});

describe('projectStore - Connection State Management', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../stores/projectStore.js');
    projectStore = module.default;
  });

  describe('getConnectionState', () => {
    it('should return default state for unknown project', () => {
      createRoot(dispose => {
        const state = projectStore.getConnectionState('unknown');
        expect(state).toEqual({
          connected: false,
          connecting: false,
          synced: false,
          error: null,
        });
        dispose();
      });
    });
  });

  describe('setConnectionState', () => {
    it('should initialize and update connection state', () => {
      createRoot(dispose => {
        const projectId = 'conn-test';

        projectStore.setConnectionState(projectId, { connecting: true });
        expect(projectStore.getConnectionState(projectId).connecting).toBe(true);
        expect(projectStore.getConnectionState(projectId).connected).toBe(false);

        projectStore.setConnectionState(projectId, { connecting: false, connected: true });
        expect(projectStore.getConnectionState(projectId).connecting).toBe(false);
        expect(projectStore.getConnectionState(projectId).connected).toBe(true);
        dispose();
      });
    });

    it('should set error state', () => {
      createRoot(dispose => {
        const projectId = 'error-test';

        projectStore.setConnectionState(projectId, {
          error: 'Connection failed',
          connected: false,
        });

        const state = projectStore.getConnectionState(projectId);
        expect(state.error).toBe('Connection failed');
        expect(state.connected).toBe(false);
        dispose();
      });
    });

    it('should update synced state', () => {
      createRoot(dispose => {
        const projectId = 'sync-test';

        projectStore.setConnectionState(projectId, { synced: true });
        expect(projectStore.getConnectionState(projectId).synced).toBe(true);
        dispose();
      });
    });
  });
});

describe('projectStore - Active Project', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../stores/projectStore.js');
    projectStore = module.default;
  });

  describe('setActiveProject / getActiveProject', () => {
    it('should return null when no active project', () => {
      createRoot(dispose => {
        expect(projectStore.getActiveProject()).toBeNull();
        dispose();
      });
    });

    it('should return null if active project not in cache', () => {
      createRoot(dispose => {
        projectStore.setActiveProject('not-cached');
        expect(projectStore.getActiveProject()).toBeNull();
        dispose();
      });
    });

    it('should return active project data when cached', () => {
      createRoot(dispose => {
        const projectId = 'active-test';
        projectStore.setProjectData(projectId, {
          meta: { name: 'Active Project' },
          studies: [],
          members: [],
        });
        projectStore.setActiveProject(projectId);

        const active = projectStore.getActiveProject();
        expect(active.meta.name).toBe('Active Project');
        dispose();
      });
    });
  });
});

// Note: Project list (dashboard) functionality is now handled by TanStack Query
// via useProjectList and useOrgProjectList hooks. Those hooks are tested separately.
