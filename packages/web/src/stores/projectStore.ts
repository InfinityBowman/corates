/**
 * Project Store - Connection state management and shared type definitions (Zustand + immer)
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  connectionReducer,
  INITIAL_STATE as INITIAL_CONNECTION,
  type ConnectionEvent,
  type ConnectionMachineState,
} from '@/project/connectionReducer';

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
}

interface ProjectStoreActions {
  setActiveProject: (projectId: string | null) => void;
  dispatchConnectionEvent: (projectId: string, event: ConnectionEvent) => void;
  clearProject: (projectId: string) => void;
}

export const useProjectStore = create<ProjectStoreState & ProjectStoreActions>()(
  immer(set => ({
    activeProjectId: null,
    connections: {},

    setActiveProject: projectId =>
      set(state => {
        state.activeProjectId = projectId;
      }),

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

