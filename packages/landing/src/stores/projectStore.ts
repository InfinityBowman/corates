/**
 * Project Store - Central store for project data (Zustand + immer)
 *
 * This store holds cached project data that persists across navigation.
 * The Y.js sync engine updates this store, and UI components read from it.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  connectionReducer,
  phaseToLegacy,
  INITIAL_STATE as INITIAL_CONNECTION,
  type ConnectionEvent,
  type ConnectionMachineState,
} from '@/project/connectionReducer';

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
  type: string;
  status?: string;
  assignedTo?: string;
  score?: unknown;
  consolidatedAnswers?: unknown;
  answers?: unknown;
  [key: string]: unknown;
}

interface StudyInfo {
  id: string;
  name: string;
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
  connections: Record<string, ConnectionMachineState>;
  projectStats: Record<string, ProjectStats>;
}

 
interface ProjectStoreActions {
  setActiveProject: (projectId: string | null) => void;
  setProjectData: (projectId: string, data: Partial<ProjectData>) => void;
  /** @deprecated Use dispatchConnectionEvent instead */
  setConnectionState: (projectId: string, state: Partial<ConnectionState>) => void;
  dispatchConnectionEvent: (projectId: string, event: ConnectionEvent) => void;
  clearProject: (projectId: string) => void;
}
 

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

    setProjectData: (projectId, data) => {
      let studiesChanged = false;
      set(state => {
        if (!state.projects[projectId]) {
          state.projects[projectId] = { meta: {}, members: [], studies: [] };
        }
        const project = state.projects[projectId];
        if (data.meta !== undefined) {
          if (JSON.stringify(project.meta) !== JSON.stringify(data.meta)) {
            project.meta = data.meta;
          }
        }
        if (data.members !== undefined) {
          if (JSON.stringify(project.members) !== JSON.stringify(data.members)) {
            project.members = data.members;
          }
        }
        if (data.studies !== undefined) {
          if (JSON.stringify(project.studies) !== JSON.stringify(data.studies)) {
            project.studies = data.studies;
            const stats = computeProjectStats(data.studies);
            state.projectStats[projectId] = {
              ...stats,
              lastUpdated: Date.now(),
            };
            studiesChanged = true;
          }
        }
      });
      if (studiesChanged) {
        persistStats(useProjectStore.getState().projectStats);
      }
    },

    setConnectionState: (projectId, connectionState) =>
      set(state => {
        if (!state.connections[projectId]) {
          state.connections[projectId] = { ...INITIAL_CONNECTION };
        }
        // Legacy compat: map partial 4-boolean updates to the machine state.
        // Callers that still use this will be migrated to dispatchConnectionEvent.
        const current = state.connections[projectId];
        if (connectionState.error !== undefined) {
          current.error = connectionState.error;
        }
        if (connectionState.synced === true) {
          current.phase = 'synced';
        } else if (connectionState.connected === true) {
          current.phase = 'connected';
        } else if (connectionState.connecting === true) {
          current.phase = 'connecting';
        } else if (connectionState.connected === false && connectionState.synced === false) {
          current.phase = current.error ? 'error' : 'idle';
        }
      }),

    dispatchConnectionEvent: (projectId, event) =>
      set(state => {
        const current = state.connections[projectId] || { ...INITIAL_CONNECTION };
        state.connections[projectId] = connectionReducer(current, event);
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

// Stable fallback constants -- must be module-level so they're referentially equal
// across renders. Without these, selectors return new objects/arrays on every call
// when a project doesn't exist in the store, causing infinite re-render loops.
const EMPTY_CONNECTION_LEGACY: ConnectionState = {
  connected: false,
  connecting: false,
  synced: false,
  error: null,
};
const EMPTY_STUDIES: StudyInfo[] = [];
const EMPTY_MEMBERS: unknown[] = [];
const EMPTY_META: Record<string, unknown> = {};
const EMPTY_PDFS: PdfInfo[] = [];

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

// Cached legacy connection states keyed by phase+error to preserve referential equality.
// Without this, phaseToLegacy creates a new object on every selector call,
// causing infinite re-render loops in components that use selectConnectionState.
const legacyCache = new Map<string, ConnectionState>();

function getCachedLegacy(machine: ConnectionMachineState): ConnectionState {
  const key = `${machine.phase}:${machine.error ?? ''}`;
  let cached = legacyCache.get(key);
  if (!cached) {
    cached = phaseToLegacy(machine);
    legacyCache.set(key, cached);
  }
  return cached;
}

/**
 * Returns legacy 4-boolean connection state for backward compatibility.
 * New code should use selectConnectionPhase instead.
 */
export function selectConnectionState(
  state: ProjectStoreState,
  projectId: string,
): ConnectionState {
  const machine = state.connections[projectId];
  if (!machine) return EMPTY_CONNECTION_LEGACY;
  return getCachedLegacy(machine);
}

export function selectConnectionPhase(
  state: ProjectStoreState,
  projectId: string,
): ConnectionMachineState {
  return state.connections[projectId] || INITIAL_CONNECTION;
}

export function selectProjectStats(
  state: ProjectStoreState,
  projectId: string,
): ProjectStats | null {
  return state.projectStats[projectId] || null;
}

export function selectStudies(state: ProjectStoreState, projectId: string): StudyInfo[] {
  return state.projects[projectId]?.studies || EMPTY_STUDIES;
}

export function selectMembers(state: ProjectStoreState, projectId: string): unknown[] {
  return state.projects[projectId]?.members || EMPTY_MEMBERS;
}

export function selectMeta(state: ProjectStoreState, projectId: string): Record<string, unknown> {
  return state.projects[projectId]?.meta || EMPTY_META;
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
  return study?.pdfs || EMPTY_PDFS;
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
