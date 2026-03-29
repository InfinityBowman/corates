/**
 * ConnectionPool - Ref-counted connection management for project Y.Doc sessions.
 * Single owner of the connection registry, active project tracking, and operation resolution.
 * See docs/audits/project-sync-refactor-rfc.md
 */

import * as Y from 'yjs';
import { DexieYProvider } from 'y-dexie';
import { useProjectStore } from '@/stores/projectStore';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { createConnectionManager } from '@/primitives/useProject/connection';
import { createSyncManager, type SyncManager } from '@/primitives/useProject/sync';
import {
  createStudyOperations,
  type StudyOperations,
} from '@/primitives/useProject/studies';
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

export interface TypedProjectOps {
  study: StudyOperations;
  checklist: ChecklistOperations;
  pdf: PdfOperations;
  reconciliation: ReconciliationOperations;
  annotation: AnnotationOperations;
  outcome: OutcomeOperations;
  getAwareness: () => unknown;
}

export interface ConnectionEntry {
  ydoc: Y.Doc;
  dexieProvider: any;
  connectionManager: any;
  syncManager: SyncManager | null;
  studyOps: StudyOperations | null;
  checklistOps: ChecklistOperations | null;
  pdfOps: PdfOperations | null;
  reconciliationOps: ReconciliationOperations | null;
  annotationOps: AnnotationOperations | null;
  outcomeOps: OutcomeOperations | null;
  refCount: number;
  initialized: boolean;
  _cleanupHandlers: (() => void)[];
}

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
      ydoc: new Y.Doc(),
      dexieProvider: null,
      connectionManager: null,
      syncManager: null,
      studyOps: null,
      checklistOps: null,
      pdfOps: null,
      reconciliationOps: null,
      annotationOps: null,
      outcomeOps: null,
      refCount: 1,
      initialized: false,
      _cleanupHandlers: [],
    };

    this.registry.set(projectId, entry);
    return entry;
  }

  /**
   * Initialize a connection entry: create domain ops, set up Dexie persistence,
   * connect WebSocket. Call once per entry (guarded by entry.initialized).
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
    store.setActiveProject(projectId);
    store.dispatchConnectionEvent(projectId, { type: 'CONNECT_REQUESTED' });

    const { ydoc } = entry;
    const getYDoc = () => entry.ydoc;
    const isSynced = () => useProjectStore.getState().connections[projectId]?.phase === 'synced';

    // Initialize domain operations
    entry.syncManager = createSyncManager(projectId, getYDoc);
    entry.studyOps = createStudyOperations(projectId, getYDoc, isSynced);
    entry.checklistOps = createChecklistOperations(projectId, getYDoc, isSynced);
    entry.pdfOps = createPdfOperations(projectId, getYDoc, isSynced);
    entry.reconciliationOps = createReconciliationOperations(projectId, getYDoc, isSynced);
    entry.annotationOps = createAnnotationOperations(projectId, getYDoc, isSynced);
    entry.outcomeOps = createOutcomeOperations(projectId, getYDoc, isSynced);

    // Scoped Y.Map observers (reviews, members, meta) for incremental sync
    entry.syncManager.attach(ydoc);
    entry._cleanupHandlers.push(() => entry.syncManager?.detach());

    // Dexie persistence (async)
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

        entry.syncManager?.pause();
        try {
          const persistedState = Y.encodeStateAsUpdate(project.ydoc);
          Y.applyUpdate(ydoc, persistedState);
        } catch (err) {
          console.error('Corrupted persisted state, clearing local data:', err);
          deleteProjectData(projectId).catch(() => {});
        } finally {
          entry.syncManager?.resume();
        }

        // Dexie write-back handler
        const dexieUpdateHandler = (update: Uint8Array, origin: string) => {
          if (origin !== 'dexie-sync') {
            Y.applyUpdate(project.ydoc, update, 'dexie-sync');
          }
        };
        ydoc.on('update', dexieUpdateHandler);
        entry._cleanupHandlers.push(() => ydoc.off('update', dexieUpdateHandler));

        entry.syncManager!.syncFromYDocImmediate();

        if (isLocal) {
          useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'LOCAL_READY' });
        }
      });
    });

    // WebSocket connection (for online projects)
    if (!isLocal) {
      entry.connectionManager = createConnectionManager(projectId, ydoc, {
        onSync: () => {
          useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'SYNC_COMPLETE' });
          entry.syncManager?.syncFromYDocImmediate();
        },
        isLocalProject: () => isLocal,
        onAccessDenied: async () => {
          await this.cleanupProjectLocalData(projectId);
        },
      });
      entry.connectionManager.connect();
    }
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
    if (!entry?.initialized || !entry.studyOps || !entry.checklistOps || !entry.pdfOps ||
        !entry.reconciliationOps || !entry.annotationOps || !entry.outcomeOps) {
      return null;
    }
    return {
      study: entry.studyOps,
      checklist: entry.checklistOps,
      pdf: entry.pdfOps,
      reconciliation: entry.reconciliationOps,
      annotation: entry.annotationOps,
      outcome: entry.outcomeOps,
      getAwareness: () => entry.connectionManager?.getAwareness() || null,
    };
  }

  /**
   * Get the raw ConnectionEntry for a project (for direct entry access).
   */
  getEntry(projectId: string): ConnectionEntry | null {
    return this.registry.get(projectId) || null;
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
   * Reconnect if the connection manager thinks it should.
   * Called from online/offline handler.
   */
  reconnectIfNeeded(projectId: string): void {
    const entry = this.registry.get(projectId);
    if (!entry?.connectionManager) return;
    const cm = entry.connectionManager;
    if (cm.getShouldReconnect()) {
      cm.setShouldReconnect(false);
      cm.reconnect();
    }
  }

  /**
   * Full cleanup: destroy connection, delete Dexie data, clear Zustand.
   */
  async cleanupProjectLocalData(projectId: string): Promise<void> {
    if (!projectId) return;

    if (this.registry.has(projectId)) {
      const entry = this.registry.get(projectId)!;
      this.destroyEntry(projectId, entry);
    }

    try {
      await deleteProjectData(projectId);
    } catch (err) {
      console.error('Failed to clear Dexie data for project:', projectId, err);
    }

    useProjectStore.getState().clearProject(projectId);
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }

  /**
   * Get the Awareness instance for a project (for presence features).
   */
  getAwareness(projectId: string): unknown {
    const entry = this.registry.get(projectId);
    return entry?.connectionManager?.getAwareness() || null;
  }

  // --- Private ---

  private destroyEntry(projectId: string, entry: ConnectionEntry): void {
    for (const cleanup of entry._cleanupHandlers) {
      try {
        cleanup();
      } catch (_) {
        /* ignore cleanup errors */
      }
    }
    entry._cleanupHandlers = [];

    if (entry.connectionManager) entry.connectionManager.destroy();
    if (entry.dexieProvider) DexieYProvider.release(entry.ydoc);
    if (entry.ydoc) entry.ydoc.destroy();

    this.registry.delete(projectId);
    useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'RESET' });
  }
}

export const connectionPool = new ConnectionPool();
