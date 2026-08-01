/**
 * ConnectionPool - Ref-counted project session management over the sync engine.
 * Single owner of the session registry, active project tracking, and operation
 * resolution. See docs/audits/project-sync-refactor-rfc.md for the original
 * shape; the Yjs transport it managed (y-websocket provider, two-Y.Doc Dexie
 * bridge, connection state machine) is replaced by @cf-sync/client, which owns
 * reconnection, keepalive, offline persistence, and the mutation outbox.
 *
 * Each online entry still carries a bare local Y.Doc feeding the legacy ops
 * and reactor: the read path (reactor -> live queries) and write path
 * (ops -> client.mutate.*) move off it in the next two passes of this
 * migration, and the doc goes with them. Until then it is a local-only write
 * target — deliberately unsynced.
 *
 * Local practice mode (`local-practice`) keeps its Dexie-persisted Y.Doc: it
 * never syncs, so the engine session does not apply to it.
 */

import * as Y from 'yjs';
import { DexieYProvider } from 'y-dexie';
import { createWorkspace } from '@cf-sync/client';
import { syncApp } from '@corates/shared/sync';
import { useProjectStore, type ConnectionPhase } from '@/stores/projectStore';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { getWsBaseUrl } from '@/config/api';
import { createStudyOperations, type StudyOperations } from '@/primitives/useProject/studies';
import {
  createChecklistOperations,
  type ChecklistOperations,
} from '@/primitives/useProject/checklists/index';
import { createPdfOperations, type PdfOperations } from '@/primitives/useProject/pdfs';
import {
  createReconciliationOperations,
  type ReconciliationOperations,
} from '@/primitives/useProject/reconciliation.js';
import {
  createAnnotationOperations,
  type AnnotationOperations,
} from '@/primitives/useProject/annotations';
import {
  createOutcomeOperations,
  type OutcomeOperations,
} from '@/primitives/useProject/outcomes.js';
import { db, deleteProjectData } from '@/primitives/db.js';
import { migrateLocalChecklistsToYDoc } from './localProject';
import { ProjectReactor } from '@/primitives/useProject/reactor/core';
import { migrateYDocToFlatKeys } from '@/primitives/useProject/reactor/migrate';

function createProjectWorkspace(
  projectId: string,
  handlers: {
    onFatal: (code: number | string, reason: string | undefined) => void;
  },
) {
  return createWorkspace({
    url: getWsBaseUrl(),
    pathPrefix: '/api/sync',
    workspaceId: projectId,
    app: syncApp,
    persist: true,
    onFatal: error => handlers.onFatal(error.code, error.reason),
    onMutationRejected: (error, mutation) => {
      // Rejection UX (toast + rollback surfacing) lands with the write-path
      // move; until then rejections must at least be visible.
      console.error('[sync] mutation rejected:', mutation.name, error.code, error.message);
    },
  });
}

export type ProjectWorkspace = ReturnType<typeof createProjectWorkspace>;

export interface TypedProjectOps {
  study: StudyOperations;
  checklist: ChecklistOperations;
  pdf: PdfOperations;
  reconciliation: ReconciliationOperations;
  annotation: AnnotationOperations;
  outcome: OutcomeOperations;
  getAwareness: () => unknown;
}

interface ConnectionEntry {
  /** The engine session ({ client, collections }); null for local practice. */
  workspace: ProjectWorkspace | null;
  ydoc: Y.Doc;
  dexieProvider: DexieYProvider | null;
  studyOps: StudyOperations | null;
  checklistOps: ChecklistOperations | null;
  pdfOps: PdfOperations | null;
  reconciliationOps: ReconciliationOperations | null;
  annotationOps: AnnotationOperations | null;
  outcomeOps: OutcomeOperations | null;
  reactor: ProjectReactor | null;
  refCount: number;
  initialized: boolean;
  _cleanupHandlers: (() => void)[];
}

/** Close-reason slugs the worker's authorize hook / admin kicks emit, mapped to
 * the user-facing messages ACCESS_DENIED_ERRORS matches for the redirect. */
const FATAL_REASON_MESSAGES: Record<string, string> = {
  'project-deleted': 'This project has been deleted',
  'membership-revoked': 'You have been removed from this project',
  'not-a-member': 'You are not a member of this project',
  'project-not-found': 'This project has been deleted',
  'auth-required': 'You are not a member of this project',
};

const GENERIC_FATAL_MESSAGE =
  'Unable to connect to project. It may have been deleted or you may not have access.';

class ConnectionPool {
  private registry = new Map<string, ConnectionEntry>();
  private _activeProjectId: string | null = null;
  private _activeOrgId: string | null = null;

  /**
   * Get or create a ref-counted connection entry.
   * If the entry already exists, increments refCount and returns it.
   */
  acquire(projectId: string): ConnectionEntry | null {
    if (!projectId) return null;

    if (this.registry.has(projectId)) {
      const entry = this.registry.get(projectId)!;
      entry.refCount++;
      return entry;
    }

    const entry: ConnectionEntry = {
      workspace: null,
      ydoc: new Y.Doc(),
      dexieProvider: null,
      studyOps: null,
      checklistOps: null,
      pdfOps: null,
      reconciliationOps: null,
      annotationOps: null,
      outcomeOps: null,
      reactor: null,
      refCount: 1,
      initialized: false,
      _cleanupHandlers: [],
    };

    this.registry.set(projectId, entry);
    return entry;
  }

  /**
   * Initialize an entry: create domain ops, then either the engine session
   * (online projects) or Dexie persistence (local practice). Call once per
   * entry (guarded by entry.initialized).
   */
  initializeConnection(
    projectId: string,
    entry: ConnectionEntry,
    options: { isLocal: boolean; cancelled: () => boolean },
  ): void {
    if (entry.initialized) return;
    entry.initialized = true;

    const { isLocal, cancelled } = options;
    const store = useProjectStore.getState();
    // Local project is a passive singleton — don't clobber the currently-
    // active real project when the local bootstrap runs.
    if (!isLocal) store.setActiveProject(projectId);
    store.setConnectionState(projectId, 'connecting');

    const { ydoc } = entry;
    const getYDoc = () => entry.ydoc;
    const isSynced = () => useProjectStore.getState().connections[projectId]?.phase === 'synced';

    // Initialize domain operations
    entry.studyOps = createStudyOperations(projectId, getYDoc, isSynced);
    entry.checklistOps = createChecklistOperations(projectId, getYDoc);
    entry.pdfOps = createPdfOperations(projectId, getYDoc);
    entry.reconciliationOps = createReconciliationOperations(projectId, getYDoc);
    entry.annotationOps = createAnnotationOperations(projectId, getYDoc);
    entry.outcomeOps = createOutcomeOperations(projectId, getYDoc);
    entry.reactor = new ProjectReactor(ydoc);

    if (isLocal) {
      this.initializeLocalPersistence(projectId, entry, cancelled);
      return;
    }

    const workspace = createProjectWorkspace(projectId, {
      onFatal: (code, reason) => this.handleFatal(projectId, code, reason),
    });
    entry.workspace = workspace;

    const applyStatus = (status: string) => {
      if (cancelled()) return;
      const current = useProjectStore.getState().connections[projectId];
      if (current?.phase === 'error') return; // fatal reason wins until cleanup
      let phase: ConnectionPhase;
      if (status === 'synced') phase = 'synced';
      else if (status === 'fatal') return; // handled by onFatal with the reason
      else phase = workspace.client.hydrated ? 'cached' : 'connecting';
      useProjectStore.getState().setConnectionState(projectId, phase);
    };

    entry._cleanupHandlers.push(workspace.client.subscribeStatus(applyStatus));
    entry._cleanupHandlers.push(
      workspace.client.subscribeHydrated(() => applyStatus(workspace.client.status)),
    );
    applyStatus(workspace.client.status);
  }

  /** The Dexie-persisted Y.Doc path — local practice only. */
  private initializeLocalPersistence(
    projectId: string,
    entry: ConnectionEntry,
    cancelled: () => boolean,
  ): void {
    (db.projects as any).get(projectId).then(async (existingProject: any) => {
      if (cancelled()) return;

      if (!existingProject) {
        await (db.projects as any).put({ id: projectId, updatedAt: Date.now() });
      }
      if (cancelled()) return;

      const project = await (db.projects as any).get(projectId);
      if (cancelled() || !project) return;

      entry.dexieProvider = DexieYProvider.load(project.ydoc);

      entry.dexieProvider.whenLoaded.then(() => {
        if (cancelled()) return;

        // Local projects use project.ydoc directly — DexieYProvider persists
        // mutations without any write-back indirection.
        const oldYdoc = entry.ydoc;
        entry.ydoc = project.ydoc;
        entry.reactor?.dispose();
        entry.reactor = new ProjectReactor(project.ydoc);
        oldYdoc.destroy();

        migrateYDocToFlatKeys(project.ydoc);
        migrateLocalChecklistsToYDoc(project.ydoc)
          .then(() => {
            if (cancelled()) return;
            useProjectStore.getState().setConnectionState(projectId, 'synced');
          })
          .catch(err => console.error('Local checklists migration failed:', err));
      });
    });
  }

  /**
   * Release a connection. Decrements refCount and destroys on zero.
   */
  release(projectId: string): void {
    if (!projectId || !this.registry.has(projectId)) return;

    const entry = this.registry.get(projectId)!;
    entry.refCount--;

    if (entry.refCount <= 0) {
      this.destroyEntry(projectId, entry);
    }
  }

  /**
   * Get typed operations for a project connection.
   */
  getOps(projectId: string): TypedProjectOps | null {
    const entry = this.registry.get(projectId);
    if (
      !entry?.initialized ||
      !entry.studyOps ||
      !entry.checklistOps ||
      !entry.pdfOps ||
      !entry.reconciliationOps ||
      !entry.annotationOps ||
      !entry.outcomeOps
    ) {
      return null;
    }
    return {
      study: entry.studyOps,
      checklist: entry.checklistOps,
      pdf: entry.pdfOps,
      reconciliation: entry.reconciliationOps,
      annotation: entry.annotationOps,
      outcome: entry.outcomeOps,
      // Yjs awareness is gone with the provider; the engine's presence API
      // replaces this in the collaborative-text pass. Until then presence UI
      // sees no peers.
      getAwareness: () => null,
    };
  }

  /**
   * Get the raw ConnectionEntry for a project (for direct entry access).
   */
  getEntry(projectId: string): ConnectionEntry | null {
    return this.registry.get(projectId) || null;
  }

  getReactor(projectId: string): ProjectReactor | null {
    return this.registry.get(projectId)?.reactor || null;
  }

  /** The engine client for a project, once its session is initialized. */
  getClient(projectId: string): ProjectWorkspace['client'] | null {
    return this.registry.get(projectId)?.workspace?.client ?? null;
  }

  /** The engine collections for a project, once its session is initialized. */
  getCollections(projectId: string): ProjectWorkspace['collections'] | null {
    return this.registry.get(projectId)?.workspace?.collections ?? null;
  }

  /**
   * Get typed operations for the currently active project.
   */
  getActiveOps(): TypedProjectOps | null {
    if (!this._activeProjectId) return null;
    return this.getOps(this._activeProjectId);
  }

  /**
   * Set the active project and org. Updates both pool state and Zustand.
   */
  setActiveProject(projectId: string, orgId: string | null = null): void {
    this._activeProjectId = projectId;
    this._activeOrgId = orgId;
    useProjectStore.getState().setActiveProject(projectId);
  }

  clearActiveProject(): void {
    this._activeProjectId = null;
    this._activeOrgId = null;
  }

  getActiveProjectId(): string | null {
    return this._activeProjectId;
  }

  getActiveOrgId(): string | null {
    return this._activeOrgId;
  }

  /**
   * Full cleanup: destroy the session, delete Dexie data, clear Zustand.
   */
  async cleanupProjectLocalData(projectId: string): Promise<void> {
    if (!projectId) return;

    if (this.registry.has(projectId)) {
      const entry = this.registry.get(projectId)!;
      this.destroyEntry(projectId, entry, { keepErrorState: true });
    }

    try {
      await deleteProjectData(projectId);
    } catch (err) {
      console.error('Failed to clear Dexie data for project:', projectId, err);
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }

  // --- Private ---

  /**
   * A permanent server rejection: an authorize denial or admin kick (reason
   * slug → access-denied message the gate redirects on), or a schema/protocol
   * mismatch mid-deploy (reload into the new bundle).
   */
  private handleFatal(projectId: string, code: number | string, reason: string | undefined): void {
    if (code === 'VersionNotSupported') {
      // A new bundle is the fix. The client's own default reload is replaced
      // by this handler, so throttle here to avoid a reload loop.
      const key = `sync-reload:${projectId}`;
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
      return;
    }

    const message = (reason && FATAL_REASON_MESSAGES[reason]) || GENERIC_FATAL_MESSAGE;
    useProjectStore.getState().setConnectionState(projectId, 'error', message);
    void this.cleanupProjectLocalData(projectId);
  }

  private destroyEntry(
    projectId: string,
    entry: ConnectionEntry,
    options: { keepErrorState?: boolean } = {},
  ): void {
    for (const cleanup of entry._cleanupHandlers) {
      try {
        cleanup();
      } catch (_) {
        /* ignore cleanup errors */
      }
    }
    entry._cleanupHandlers = [];

    if (entry.reactor) entry.reactor.dispose();
    if (entry.workspace) void entry.workspace.destroy();
    if (entry.dexieProvider) DexieYProvider.release(entry.ydoc);
    if (entry.ydoc) entry.ydoc.destroy();

    this.registry.delete(projectId);
    // Keep the error phase visible through the redirect effect; a fresh mount
    // starts from a clean record either way (clearProject on next acquire is
    // unnecessary — setConnectionState overwrites).
    if (!options.keepErrorState) {
      useProjectStore.getState().clearProject(projectId);
    }
  }
}

export const connectionPool = new ConnectionPool();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__connectionPool = connectionPool;
  (window as any).__Y = Y;
}
