/**
 * Project Store - Central store for project data (Zustand + immer)
 *
 * This store holds cached project data that persists across navigation.
 * The Y.js sync engine updates this store, and UI components read from it.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Temporary in-memory storage for pending uploads during project creation
const pendingProjectData = new Map<string, unknown>();

// localStorage key for persisted project stats
const PROJECT_STATS_KEY = 'corates:projectStats';

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  synced: boolean;
  error: string | null;
}

interface ProjectStats {
  studyCount: number;
  completedCount: number;
  lastUpdated: number;
}

interface PdfInfo {
  id: string;
  fileName: string;
  tag?: string;
  [key: string]: unknown;
}

interface ChecklistInfo {
  id: string;
  status?: string;
  score?: unknown;
  consolidatedAnswers?: unknown;
  answers?: unknown;
  [key: string]: unknown;
}

interface StudyInfo {
  id: string;
  checklists?: ChecklistInfo[];
  pdfs?: PdfInfo[];
  [key: string]: unknown;
}

interface ProjectData {
  meta: Record<string, unknown>;
  members: unknown[];
  studies: StudyInfo[];
}

interface ProjectStoreState {
  projects: Record<string, ProjectData>;
  activeProjectId: string | null;
  connections: Record<string, ConnectionState>;
  projectStats: Record<string, ProjectStats>;
}

/* eslint-disable no-unused-vars */
interface ProjectStoreActions {
  setActiveProject: (projectId: string | null) => void;
  setProjectData: (projectId: string, data: Partial<ProjectData>) => void;
  setConnectionState: (projectId: string, state: Partial<ConnectionState>) => void;
  clearProject: (projectId: string) => void;
}
/* eslint-enable no-unused-vars */

function loadPersistedStats(): Record<string, ProjectStats> {
  try {
    const stored = localStorage.getItem(PROJECT_STATS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.warn('Failed to load project stats from localStorage:', (err as Error).message);
    return {};
  }
}

function persistStats(stats: Record<string, ProjectStats>) {
  try {
    localStorage.setItem(PROJECT_STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.warn('Failed to persist project stats to localStorage:', (err as Error).message);
  }
}

function computeProjectStats(studies: StudyInfo[]): { studyCount: number; completedCount: number } {
  const studyCount = studies?.length || 0;
  let completedCount = 0;

  if (studies) {
    for (const study of studies) {
      const hasCompletedChecklist = study.checklists?.some(c => c.status === 'completed');
      if (hasCompletedChecklist) {
        completedCount++;
      }
    }
  }

  return { studyCount, completedCount };
}

export const useProjectStore = create<ProjectStoreState & ProjectStoreActions>()(
  immer(set => ({
    projects: {},
    activeProjectId: null,
    connections: {},
    projectStats: loadPersistedStats(),

    setActiveProject: projectId =>
      set(state => {
        state.activeProjectId = projectId;
      }),

    setProjectData: (projectId, data) =>
      set(state => {
        if (!state.projects[projectId]) {
          state.projects[projectId] = { meta: {}, members: [], studies: [] };
        }
        if (data.meta !== undefined) state.projects[projectId].meta = data.meta;
        if (data.members !== undefined) state.projects[projectId].members = data.members;
        if (data.studies !== undefined) {
          state.projects[projectId].studies = data.studies;
          const stats = computeProjectStats(data.studies);
          state.projectStats[projectId] = {
            ...stats,
            lastUpdated: Date.now(),
          };
          persistStats(state.projectStats);
        }
      }),

    setConnectionState: (projectId, connectionState) =>
      set(state => {
        if (!state.connections[projectId]) {
          state.connections[projectId] = {
            connected: false,
            connecting: false,
            synced: false,
            error: null,
          };
        }
        Object.assign(state.connections[projectId], connectionState);
      }),

    clearProject: projectId =>
      set(state => {
        delete state.projects[projectId];
        delete state.connections[projectId];
        if (state.activeProjectId === projectId) {
          state.activeProjectId = null;
        }
      }),
  })),
);

// Selectors (pure functions, not hooks -- can be used with useProjectStore(selector))

export function selectProject(
  state: ProjectStoreState,
  projectId: string,
): ProjectData | undefined {
  return state.projects[projectId];
}

export function selectActiveProject(state: ProjectStoreState): ProjectData | null {
  if (!state.activeProjectId) return null;
  return state.projects[state.activeProjectId] || null;
}

export function selectConnectionState(
  state: ProjectStoreState,
  projectId: string,
): ConnectionState {
  return (
    state.connections[projectId] || {
      connected: false,
      connecting: false,
      synced: false,
      error: null,
    }
  );
}

export function selectProjectStats(
  state: ProjectStoreState,
  projectId: string,
): ProjectStats | null {
  return state.projectStats[projectId] || null;
}

export function selectStudies(state: ProjectStoreState, projectId: string): StudyInfo[] {
  return state.projects[projectId]?.studies || [];
}

export function selectMembers(state: ProjectStoreState, projectId: string): unknown[] {
  return state.projects[projectId]?.members || [];
}

export function selectMeta(state: ProjectStoreState, projectId: string): Record<string, unknown> {
  return state.projects[projectId]?.meta || {};
}

export function selectStudy(
  state: ProjectStoreState,
  projectId: string,
  studyId: string,
): StudyInfo | null {
  const studies = state.projects[projectId]?.studies;
  if (!studies) return null;
  return studies.find(s => s.id === studyId) || null;
}

export function selectChecklist(
  state: ProjectStoreState,
  projectId: string,
  studyId: string,
  checklistId: string,
): ChecklistInfo | null {
  const study = selectStudy(state, projectId, studyId);
  if (!study?.checklists) return null;
  return study.checklists.find(c => c.id === checklistId) || null;
}

export function selectStudyPdfs(
  state: ProjectStoreState,
  projectId: string,
  studyId: string,
): PdfInfo[] {
  const study = selectStudy(state, projectId, studyId);
  return study?.pdfs || [];
}

export function selectPrimaryPdf(
  state: ProjectStoreState,
  projectId: string,
  studyId: string,
): PdfInfo | null {
  const pdfs = selectStudyPdfs(state, projectId, studyId);
  return pdfs.find(pdf => pdf.tag === 'primary') || null;
}

// Pending project data (in-memory only, not in store)

export function setPendingProjectData(projectId: string, data: unknown) {
  pendingProjectData.set(projectId, data);
}

export function getPendingProjectData(projectId: string): unknown {
  const data = pendingProjectData.get(projectId);
  if (data) {
    pendingProjectData.delete(projectId);
  }
  return data;
}
