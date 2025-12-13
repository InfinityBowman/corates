/**
 * Tests for useProject hook - Y.js sync and core operations
 *
 * Note: Full WebSocket connection lifecycle is tested through integration tests.
 * These unit tests focus on the core business logic and Y.js operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { useProject } from '../useProject/index.js';
import * as Y from 'yjs';

// Mock dependencies
vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: vi.fn(function (name, doc) {
    this.name = name;
    this.doc = doc;
    this.destroy = vi.fn();
    this.clearData = vi.fn();
    this.whenSynced = Promise.resolve();
    return this;
  }),
}));

vi.mock('../projectStore.js', () => ({
  default: {
    getConnectionState: vi.fn(() => ({
      connected: false,
      connecting: false,
      synced: true, // Default to synced so operations work
      error: null,
    })),
    getProject: vi.fn(() => ({
      studies: [],
      meta: {},
      members: [],
    })),
    setActiveProject: vi.fn(),
    setConnectionState: vi.fn(),
    setProjectData: vi.fn(),
  },
}));

vi.mock('../useOnlineStatus.js', () => ({
  default: () => () => true, // Return a function that returns true
}));

vi.mock('@config/api.js', () => ({
  getWsBaseUrl: vi.fn(() => 'ws://localhost:8787'),
}));

// Mock WebSocket - prevent actual connection attempts
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }
  send() {}
  close() {}
};
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSED = 3;

describe('useProject - Local Project Mode', () => {
  let cleanup;

  beforeEach(() => {
    vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('test-uuid-123');
  });

  afterEach(() => {
    if (cleanup) cleanup();
    vi.restoreAllMocks();
  });

  it('should identify local projects correctly', () => {
    createRoot(dispose => {
      cleanup = dispose;
      const project = useProject('local-test-project');

      expect(project.isLocalProject()).toBe(true);
    });
  });

  it('should identify remote projects correctly', () => {
    createRoot(dispose => {
      cleanup = dispose;
      const project = useProject('remote-project-123');

      expect(project.isLocalProject()).toBe(false);
    });
  });
});

describe('useProject - Study CRUD Operations', () => {
  let cleanup;
  let projectStore;

  beforeEach(async () => {
    projectStore = (await import('../projectStore.js')).default;
    vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('study-uuid-123');
  });

  afterEach(() => {
    if (cleanup) cleanup();
    vi.restoreAllMocks();
  });

  it('should create a study with basic info', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study', 'Test description');

      expect(studyId).toBe('study-uuid-123');
      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should create a study with metadata', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const metadata = {
        firstAuthor: 'Smith',
        publicationYear: 2023,
        authors: 'Smith J, Jones A',
        journal: 'Nature',
        doi: '10.1234/test',
        abstract: 'Test abstract',
        importSource: 'doi',
      };

      const studyId = project.createStudy('Test Study', 'Description', metadata);

      expect(studyId).toBe('study-uuid-123');
    });
  });

  it('should not create study if not synced', async () => {
    projectStore.getConnectionState.mockReturnValue({
      connected: false,
      connecting: false,
      synced: false,
      error: null,
    });

    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');

      expect(studyId).toBeNull();
    });
  });

  it('should update a study', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Original Name');
      projectStore.setProjectData.mockClear();

      project.updateStudy(studyId, {
        name: 'Updated Name',
        description: 'Updated description',
        reviewer1: 'user-1',
        reviewer2: 'user-2',
      });

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should delete a study', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      projectStore.setProjectData.mockClear();

      project.deleteStudy(studyId);

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });
});

describe('useProject - PDF Operations', () => {
  let cleanup;
  let projectStore;

  beforeEach(async () => {
    projectStore = (await import('../projectStore.js')).default;
    vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('study-123');
  });

  afterEach(() => {
    if (cleanup) cleanup();
    vi.restoreAllMocks();
  });

  it('should add PDF metadata to study', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      projectStore.setProjectData.mockClear();

      project.addPdfToStudy(studyId, {
        fileName: 'test.pdf',
        key: 'r2-storage-key',
        size: 123456,
        uploadedBy: 'user-1',
        uploadedAt: Date.now(),
      });

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should remove PDF metadata from study', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');

      project.addPdfToStudy(studyId, {
        fileName: 'test.pdf',
        key: 'r2-key',
        size: 12345,
        uploadedBy: 'user-1',
      });

      projectStore.setProjectData.mockClear();

      project.removePdfFromStudy(studyId, 'test.pdf');

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });
});

describe('useProject - Checklist Operations', () => {
  let cleanup;
  let projectStore;

  beforeEach(async () => {
    projectStore = (await import('../projectStore.js')).default;
    let callCount = 0;
    vi.spyOn(global.crypto, 'randomUUID').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 'study-123' : `checklist-${callCount}`;
    });
  });

  afterEach(() => {
    if (cleanup) cleanup();
    vi.restoreAllMocks();
  });

  it('should create AMSTAR2 checklist', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      const checklistId = project.createChecklist(studyId, 'AMSTAR2', 'user-1');

      expect(checklistId).toBe('checklist-2');
      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should not create checklist if not synced', async () => {
    projectStore.getConnectionState.mockReturnValue({
      connected: false,
      connecting: false,
      synced: false,
      error: null,
    });

    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      const checklistId = project.createChecklist(studyId);

      expect(checklistId).toBeNull();
    });
  });

  it('should update checklist', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      const checklistId = project.createChecklist(studyId);

      projectStore.setProjectData.mockClear();

      project.updateChecklist(studyId, checklistId, {
        status: 'completed',
        assignedTo: 'user-2',
      });

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should delete checklist', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      const checklistId = project.createChecklist(studyId);

      projectStore.setProjectData.mockClear();

      project.deleteChecklist(studyId, checklistId);

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should update checklist answer', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      const checklistId = project.createChecklist(studyId);

      projectStore.setProjectData.mockClear();

      project.updateChecklistAnswer(studyId, checklistId, 'q1', {
        answers: [[true, false, false, false]],
        critical: true,
      });

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should get checklist data with answers', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      const checklistId = project.createChecklist(studyId, 'AMSTAR2', 'user-1');

      const checklistData = project.getChecklistData(studyId, checklistId);

      expect(checklistData).toBeDefined();
      expect(checklistData.type).toBe('AMSTAR2');
      expect(checklistData.assignedTo).toBe('user-1');
      expect(checklistData.status).toBe('pending');
      expect(checklistData.answers).toBeDefined();
      expect(checklistData.answers.q1).toBeDefined();
    });
  });

  it('should get checklist answers map for real-time updates', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      const checklistId = project.createChecklist(studyId);

      const answersMap = project.getChecklistAnswersMap(studyId, checklistId);

      expect(answersMap).toBeDefined();
      expect(answersMap instanceof Y.Map).toBe(true);
    });
  });
});

describe('useProject - Reconciliation Operations', () => {
  let cleanup;
  let projectStore;

  beforeEach(async () => {
    projectStore = (await import('../projectStore.js')).default;
    let callCount = 0;
    vi.spyOn(global.crypto, 'randomUUID').mockImplementation(() => `uuid-${callCount++}`);
  });

  afterEach(() => {
    if (cleanup) cleanup();
    vi.restoreAllMocks();
  });

  it('should save reconciliation progress', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');
      projectStore.setProjectData.mockClear();

      project.saveReconciliationProgress(studyId, {
        checklist1Id: 'checklist-1',
        checklist2Id: 'checklist-2',
        currentPage: 2,
        viewMode: 'questions',
        finalAnswers: { q1: { selection: 'reviewer1' } },
      });

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });

  it('should get reconciliation progress', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');

      project.saveReconciliationProgress(studyId, {
        checklist1Id: 'checklist-1',
        checklist2Id: 'checklist-2',
        currentPage: 3,
        viewMode: 'questions',
        finalAnswers: { q1: 'answer' },
      });

      const progress = project.getReconciliationProgress(studyId);

      expect(progress).toBeDefined();
      expect(progress.checklist1Id).toBe('checklist-1');
      expect(progress.checklist2Id).toBe('checklist-2');
      expect(progress.currentPage).toBe(3);
      expect(progress.viewMode).toBe('questions');
      expect(progress.finalAnswers).toEqual({ q1: 'answer' });
    });
  });

  it('should return null for non-existent reconciliation progress', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');

      const progress = project.getReconciliationProgress(studyId);

      expect(progress).toBeNull();
    });
  });

  it('should clear reconciliation progress', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      const studyId = project.createStudy('Test Study');

      project.saveReconciliationProgress(studyId, {
        checklist1Id: 'checklist-1',
        checklist2Id: 'checklist-2',
        currentPage: 1,
        viewMode: 'questions',
      });

      project.clearReconciliationProgress(studyId);

      const progress = project.getReconciliationProgress(studyId);
      expect(progress).toBeNull();
    });
  });
});

describe('useProject - Project Settings', () => {
  let cleanup;
  let projectStore;

  beforeEach(async () => {
    projectStore = (await import('../projectStore.js')).default;
    vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('uuid-123');
  });

  afterEach(() => {
    if (cleanup) cleanup();
    vi.restoreAllMocks();
  });

  it('should update project settings', async () => {
    createRoot(async dispose => {
      cleanup = dispose;
      const project = useProject('local-test');

      await new Promise(resolve => setTimeout(resolve, 10));

      projectStore.setProjectData.mockClear();

      project.updateProjectSettings({
        namingConvention: 'lastNameYear',
        defaultChecklistType: 'AMSTAR2',
      });

      expect(projectStore.setProjectData).toHaveBeenCalled();
    });
  });
});
