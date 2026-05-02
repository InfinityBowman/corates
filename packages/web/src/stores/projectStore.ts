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
  INITIAL_STATE as INITIAL_CONNECTION,
  type ConnectionEvent,
  type ConnectionMachineState,
} from '@/project/connectionReducer';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';

// localStorage key for persisted project stats
const PROJECT_STATS_KEY = 'corates:projectStats';

interface ProjectStats {
  studyCount: number;
  completedCount: number;
  lastUpdated: number;
}

export interface PdfEntry {
  id: string;
  fileName: string;
  key: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
  tag: string;
  title: string | null;
  firstAuthor: string | null;
  publicationYear: string | null;
  journal: string | null;
  doi: string | null;
}

export interface ChecklistEntry {
  id: string;
  type: string;
  title: string | null;
  assignedTo: string | null;
  outcomeId: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
  score: string | null;
  answers: Record<string, unknown> | null;
  consolidatedAnswers?: Record<string, string | null> | null;
}

export interface ReconciliationEntry {
  checklist1Id: string;
  checklist2Id: string;
  reconciledChecklistId: string | null;
  currentPage: number;
  viewMode: string;
  updatedAt: number;
}

export interface AnnotationEntry {
  id: string;
  pdfId: string;
  type: string;
  pageIndex: number;
  embedPdfData: Record<string, unknown>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  mergedFrom: string | null;
}

export interface MemberEntry {
  userId: string;
  role: string;
  joinedAt: number;
  name: string;
  email: string;
  givenName: string;
  familyName: string;
  image: string | null;
}

export interface OutcomeEntry {
  id: string;
  name: string;
  createdAt: number;
  [key: string]: unknown;
}

export interface ProjectMeta {
  name?: string;
  description?: string | null;
  orgId?: string;
  outcomes: OutcomeEntry[];
  updatedAt?: number;
  [key: string]: unknown;
}

export interface StudyInfo {
  id: string;
  name: string;
  description: string;
  originalTitle: string | null;
  firstAuthor: string | null;
  publicationYear: string | null;
  authors: string | null;
  journal: string | null;
  doi: string | null;
  abstract: string | null;
  importSource: string | null;
  pdfUrl: string | null;
  pdfSource: string | null;
  pdfAccessible: boolean;
  pmid: string | null;
  url: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  type: string | null;
  reviewer1: string | null;
  reviewer2: string | null;
  createdAt: number;
  updatedAt: number;
  checklists: ChecklistEntry[];
  pdfs: PdfEntry[];
  reconciliation?: ReconciliationEntry;
}

interface ProjectStoreState {
  activeProjectId: string | null;
  connections: Record<string, ConnectionMachineState>;
  projectStats: Record<string, ProjectStats>;
}

interface ProjectStoreActions {
  setActiveProject: (projectId: string | null) => void;
  updateProjectStats: (projectId: string, studies: StudyInfo[]) => void;
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
  const studyCount = studies.length;
  let completedCount = 0;

  for (const study of studies) {
    if (study.checklists?.some(c => c.status === CHECKLIST_STATUS.FINALIZED)) {
      completedCount++;
    }
  }

  return { studyCount, completedCount };
}

export const useProjectStore = create<ProjectStoreState & ProjectStoreActions>()(
  immer(set => ({
    activeProjectId: null,
    connections: {},
    projectStats: loadPersistedStats(),

    setActiveProject: projectId =>
      set(state => {
        state.activeProjectId = projectId;
      }),

    updateProjectStats: (projectId, studies) => {
      const stats = computeProjectStats(studies);
      const current = useProjectStore.getState().projectStats[projectId];
      if (
        current &&
        current.studyCount === stats.studyCount &&
        current.completedCount === stats.completedCount
      ) {
        return;
      }
      set(state => {
        state.projectStats[projectId] = { ...stats, lastUpdated: Date.now() };
      });
      persistStats(useProjectStore.getState().projectStats);
    },

    dispatchConnectionEvent: (projectId, event) =>
      set(state => {
        const current = state.connections[projectId] || { ...INITIAL_CONNECTION };
        state.connections[projectId] = connectionReducer(current, event);
      }),

    clearProject: projectId =>
      set(state => {
        delete state.connections[projectId];
        if (state.activeProjectId === projectId) {
          state.activeProjectId = null;
        }
      }),
  })),
);

// Selectors (pure functions, not hooks -- can be used with useProjectStore(selector))

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
