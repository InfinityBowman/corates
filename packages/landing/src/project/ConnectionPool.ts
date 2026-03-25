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
import { createStudyOperations } from '@/primitives/useProject/studies';
import {
  createChecklistOperations,
  type ChecklistOperations,
} from '@/primitives/useProject/checklists/index';
import { createPdfOperations } from '@/primitives/useProject/pdfs';
import { createReconciliationOperations } from '@/primitives/useProject/reconciliation.js';
import { createAnnotationOperations } from '@/primitives/useProject/annotations';
import { createOutcomeOperations } from '@/primitives/useProject/outcomes.js';
import { db, deleteProjectData } from '@/primitives/db.js';

export interface ConnectionEntry {
  ydoc: Y.Doc;
  dexieProvider: any;
  connectionManager: any;
  syncManager: SyncManager | null;
  studyOps: any;
  checklistOps: ChecklistOperations | null;
  pdfOps: any;
  reconciliationOps: any;
  annotationOps: any;
  outcomeOps: any;
  refCount: number;
  initialized: boolean;
  isLoadingPersistedState: boolean;
  _cleanupHandlers: (() => void)[];
}

/** Flat operations object registered for a connection */
export type ConnectionOps = Record<string, (...args: any[]) => any>;

class ConnectionPool {
  private registry = new Map<string, ConnectionEntry>();
  private opsRegistry = new Map<string, ConnectionOps>();
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
      isLoadingPersistedState: false,
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

    // Build flat operations map
    this.opsRegistry.set(projectId, this.buildOpsMap(entry));

    // YDoc update handler (debounced sync to Zustand store)
    const syncUpdateHandler = () => {
      if (!entry.isLoadingPersistedState) {
        entry.syncManager?.syncFromYDoc();
      }
    };
    ydoc.on('update', syncUpdateHandler);
    entry._cleanupHandlers.push(() => ydoc.off('update', syncUpdateHandler));

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

        entry.isLoadingPersistedState = true;
        try {
          const persistedState = Y.encodeStateAsUpdate(project.ydoc);
          Y.applyUpdate(ydoc, persistedState);
        } catch (err) {
          console.error('Corrupted persisted state, clearing local data:', err);
          deleteProjectData(projectId).catch(() => {});
        } finally {
          entry.isLoadingPersistedState = false;
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
   * Get the flat operations map for a project connection.
   */
  get(projectId: string): ConnectionOps | null {
    return this.opsRegistry.get(projectId) || null;
  }

  /**
   * Get the raw ConnectionEntry for a project (for direct ops access).
   */
  getEntry(projectId: string): ConnectionEntry | null {
    return this.registry.get(projectId) || null;
  }

  /**
   * Get operations for the currently active project.
   */
  getActiveOps(): ConnectionOps | null {
    if (!this._activeProjectId) return null;
    return this.get(this._activeProjectId);
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
    this.opsRegistry.delete(projectId);
    useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'RESET' });
  }

  private buildOpsMap(entry: ConnectionEntry): ConnectionOps {
    // Cast typed ops to any for the flat map -- callers already treat these as untyped
    const chk = entry.checklistOps as any;
    return {
      // Study
      createStudy: (...args: any[]) => entry.studyOps?.createStudy(...args),
      updateStudy: (...args: any[]) => entry.studyOps?.updateStudy(...args),
      deleteStudy: (...args: any[]) => entry.studyOps?.deleteStudy(...args),
      renameProject: (...args: any[]) => entry.studyOps?.renameProject(...args),
      updateDescription: (...args: any[]) => entry.studyOps?.updateDescription(...args),
      updateProjectSettings: (...args: any[]) => entry.studyOps?.updateProjectSettings(...args),
      // Checklist
      createChecklist: (...args: any[]) => chk?.createChecklist(...args),
      updateChecklist: (...args: any[]) => chk?.updateChecklist(...args),
      deleteChecklist: (...args: any[]) => chk?.deleteChecklist(...args),
      getChecklistAnswersMap: (...args: any[]) => chk?.getChecklistAnswersMap(...args),
      getChecklistData: (...args: any[]) => chk?.getChecklistData(...args),
      updateChecklistAnswer: (...args: any[]) => chk?.updateChecklistAnswer(...args),
      getQuestionNote: (...args: any[]) => chk?.getQuestionNote(...args),
      getRobinsText: (...args: any[]) => chk?.getRobinsText(...args),
      getRob2Text: (...args: any[]) => chk?.getRob2Text(...args),
      getTextRef: (...args: any[]) => chk?.getTextRef(...args),
      setTextValue: (...args: any[]) => chk?.setTextValue(...args),
      // PDF
      addPdfToStudy: (...args: any[]) => entry.pdfOps?.addPdfToStudy(...args),
      removePdfFromStudy: (...args: any[]) => entry.pdfOps?.removePdfFromStudy(...args),
      removePdfByFileName: (...args: any[]) => entry.pdfOps?.removePdfByFileName(...args),
      updatePdfTag: (...args: any[]) => entry.pdfOps?.updatePdfTag(...args),
      updatePdfMetadata: (...args: any[]) => entry.pdfOps?.updatePdfMetadata(...args),
      setPdfAsPrimary: (...args: any[]) => entry.pdfOps?.setPdfAsPrimary(...args),
      setPdfAsProtocol: (...args: any[]) => entry.pdfOps?.setPdfAsProtocol(...args),
      // Reconciliation
      saveReconciliationProgress: (...args: any[]) =>
        entry.reconciliationOps?.saveReconciliationProgress(...args),
      getReconciliationProgress: (...args: any[]) =>
        entry.reconciliationOps?.getReconciliationProgress(...args),
      getAllReconciliationProgress: (...args: any[]) =>
        entry.reconciliationOps?.getAllReconciliationProgress(...args),
      clearReconciliationProgress: (...args: any[]) =>
        entry.reconciliationOps?.clearReconciliationProgress(...args),
      // Annotations
      addAnnotation: (...args: any[]) => entry.annotationOps?.addAnnotation(...args),
      addAnnotations: (...args: any[]) => entry.annotationOps?.addAnnotations(...args),
      updateAnnotation: (...args: any[]) => entry.annotationOps?.updateAnnotation(...args),
      deleteAnnotation: (...args: any[]) => entry.annotationOps?.deleteAnnotation(...args),
      getAnnotations: (...args: any[]) => entry.annotationOps?.getAnnotations(...args),
      getAllAnnotationsForPdf: (...args: any[]) =>
        entry.annotationOps?.getAllAnnotationsForPdf(...args),
      clearAnnotationsForChecklist: (...args: any[]) =>
        entry.annotationOps?.clearAnnotationsForChecklist(...args),
      mergeAnnotations: (...args: any[]) => entry.annotationOps?.mergeAnnotations(...args),
      // Outcomes
      getOutcomes: () => entry.outcomeOps?.getOutcomes() || [],
      getOutcome: (...args: any[]) => entry.outcomeOps?.getOutcome(...args),
      createOutcome: (...args: any[]) => entry.outcomeOps?.createOutcome(...args),
      updateOutcome: (...args: any[]) => entry.outcomeOps?.updateOutcome(...args),
      deleteOutcome: (...args: any[]) => entry.outcomeOps?.deleteOutcome(...args),
      isOutcomeInUse: (...args: any[]) => entry.outcomeOps?.isOutcomeInUse(...args),
      // Presence
      getAwareness: () => entry.connectionManager?.getAwareness() || null,
    };
  }
}

export const connectionPool = new ConnectionPool();
