/**
 * Project Store - Connection state management and shared type definitions (Zustand + immer)
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * The per-project session phase, projected from the sync engine's client by
 * the ConnectionPool: `synced` when the socket has caught up, `cached` when
 * locally persisted rows are hydrated but the socket has not (offline or
 * still connecting — renderable either way), `connecting` before either,
 * `error` on a permanent rejection (access denied / kicked).
 */
export type ConnectionPhase = 'idle' | 'connecting' | 'cached' | 'synced' | 'error';

export interface ConnectionMachineState {
  phase: ConnectionPhase;
  error: string | null;
  /** Mutations applied locally but not yet confirmed durable by the server. */
  pending: number;
}

const INITIAL_CONNECTION: ConnectionMachineState = { phase: 'idle', error: null, pending: 0 };

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

interface ReconciliationEntry {
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
  setConnectionState: (projectId: string, phase: ConnectionPhase, error?: string | null) => void;
  setPending: (projectId: string, pending: number) => void;
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

    setConnectionState: (projectId, phase, error = null) =>
      set(state => {
        // Phase and pending change on different events; keep the count.
        const pending = state.connections[projectId]?.pending ?? 0;
        state.connections[projectId] = { phase, error, pending };
      }),

    setPending: (projectId, pending) =>
      set(state => {
        const current = state.connections[projectId];
        if (current) {
          current.pending = pending;
        } else {
          state.connections[projectId] = { ...INITIAL_CONNECTION, pending };
        }
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
