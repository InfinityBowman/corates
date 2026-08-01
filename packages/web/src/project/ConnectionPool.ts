/**
 * ConnectionPool - Ref-counted project session management over the sync engine.
 * Single owner of the session registry and active project tracking. The engine
 * client owns reconnection, keepalive, offline persistence, and the mutation
 * outbox; reads go through workspace-data hooks over collections, writes
 * through client.mutate (online) or applyLocalMutation (local practice).
 *
 * Local practice mode (`local-practice`) has no engine session: its rows live
 * in local-only collections, persisted to Dexie (`localProjects`) by this
 * pool, and mutated by the shared mutator functions applied directly. Legacy
 * local data (the Dexie-persisted Y.Doc) migrates to rows on first load.
 */

import { createWorkspace } from '@cf-sync/client';
import { syncApp } from '@corates/shared/sync';
import { useProjectStore, type ConnectionPhase } from '@/stores/projectStore';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { getWsBaseUrl } from '@/config/api';
import { showToast } from '@/lib/toast';
import { db, deleteProjectData } from '@/primitives/db.js';
import { loadLegacyLocalRows } from './localProject';
import {
  createLocalCollections,
  seedLocalCollections,
  snapshotLocalCollections,
  type ProjectCollections,
} from './localCollections';

export type { ProjectCollections } from './localCollections';

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
      // The one place rejections surface: the optimistic overlay has already
      // rolled back; tell the user their change did not stick. Lifecycle
      // codes are noise (Stopped on teardown, Timeout offline), not verdicts.
      if (error.code === 'Stopped' || error.code === 'Timeout') return;
      console.error('[sync] mutation rejected:', mutation.name, error.code, error.message);
      showToast.error('Change rejected', rejectionMessage(error.code, mutation.name));
    },
  });
}

function rejectionMessage(code: string, mutationName: string): string {
  switch (code) {
    case 'ReadOnly':
      return 'This organization has read-only access. Renew your subscription to make changes.';
    case 'NotFound':
      return 'That item no longer exists — it may have been deleted by someone else.';
    case 'DuplicateChecklist':
      return 'A checklist for this outcome and reviewer already exists.';
    case 'OutcomeInUse':
      return 'This outcome is assigned to existing checklists and cannot be deleted.';
    case 'ReconciliationInProgress':
      return 'Reconciliation is in progress for this outcome. Finish it before changing the outcome.';
    case 'AssigneeConflict':
      return 'A checklist for the target outcome already exists for one of the reviewers.';
    default:
      return `Your change (${mutationName}) was rejected and has been rolled back.`;
  }
}

export type ProjectWorkspace = ReturnType<typeof createProjectWorkspace>;

interface ConnectionEntry {
  /** The engine session ({ client, collections }); null for local practice. */
  workspace: ProjectWorkspace | null;
  /** Local practice only: local-only collections persisted to Dexie. */
  localCollections: ProjectCollections | null;
  localPersistTimer: ReturnType<typeof setTimeout> | null;
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

const LOCAL_PERSIST_DEBOUNCE_MS = 300;

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
      localCollections: null,
      localPersistTimer: null,
      refCount: 1,
      initialized: false,
      _cleanupHandlers: [],
    };

    this.registry.set(projectId, entry);
    return entry;
  }

  /**
   * Initialize an entry: the engine session for online projects, the
   * row-persisted local plane for local practice. Call once per entry
   * (guarded by entry.initialized).
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

    if (isLocal) {
      void this.initializeLocalRows(projectId, entry, cancelled);
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

  /**
   * Local practice: seed collections from persisted rows, or — first run
   * after this migration — from the legacy Dexie Y.Doc, which is then left
   * in place untouched as a rollback source until the cleanup migration
   * drops it.
   */
  private async initializeLocalRows(
    projectId: string,
    entry: ConnectionEntry,
    cancelled: () => boolean,
  ): Promise<void> {
    try {
      let stored = await db.localProjects.get(projectId);
      if (cancelled()) return;

      if (!stored) {
        const legacyRows = await loadLegacyLocalRows(projectId);
        if (cancelled()) return;
        stored = { id: projectId, updatedAt: Date.now(), rows: legacyRows };
        await db.localProjects.put(stored);
        if (cancelled()) return;
      }

      entry.localCollections = createLocalCollections(projectId);
      seedLocalCollections(entry.localCollections, stored.rows);
      useProjectStore.getState().setConnectionState(projectId, 'synced');
    } catch (err) {
      console.error('Local practice initialization failed:', err);
      useProjectStore
        .getState()
        .setConnectionState(projectId, 'error', 'Local practice data failed to load');
    }
  }

  /** Debounced Dexie save of a local project's rows; called after local mutations. */
  scheduleLocalPersist(projectId: string): void {
    const entry = this.registry.get(projectId);
    if (!entry?.localCollections) return;
    if (entry.localPersistTimer) clearTimeout(entry.localPersistTimer);
    entry.localPersistTimer = setTimeout(() => {
      entry.localPersistTimer = null;
      const collections = entry.localCollections;
      if (!collections) return;
      db.localProjects
        .put({ id: projectId, updatedAt: Date.now(), rows: snapshotLocalCollections(collections) })
        .catch(err => console.error('Local practice persist failed:', err));
    }, LOCAL_PERSIST_DEBOUNCE_MS);
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

  /** The engine client for a project, once its session is initialized. */
  getClient(projectId: string): ProjectWorkspace['client'] | null {
    return this.registry.get(projectId)?.workspace?.client ?? null;
  }

  /** The engine client for the active project (used by the project.* actions). */
  getActiveClient(): ProjectWorkspace['client'] | null {
    return this._activeProjectId ? this.getClient(this._activeProjectId) : null;
  }

  /**
   * The read-surface collections for a project: the engine's for online
   * sessions, the persisted local set for local practice. The two carry the
   * same row types; the cast erases the engine's richer generics.
   */
  getCollections(projectId: string): ProjectCollections | null {
    const entry = this.registry.get(projectId);
    if (!entry) return null;
    if (entry.workspace) return entry.workspace.collections as unknown as ProjectCollections;
    return entry.localCollections;
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

    if (entry.localPersistTimer) {
      clearTimeout(entry.localPersistTimer);
      entry.localPersistTimer = null;
      // Flush the pending save synchronously-ish before the entry goes away.
      const collections = entry.localCollections;
      if (collections) {
        db.localProjects
          .put({
            id: projectId,
            updatedAt: Date.now(),
            rows: snapshotLocalCollections(collections),
          })
          .catch(() => {});
      }
    }

    if (entry.workspace) void entry.workspace.destroy();

    this.registry.delete(projectId);
    // Keep the error phase visible through the redirect effect; a fresh mount
    // starts from a clean record either way.
    if (!options.keepErrorState) {
      useProjectStore.getState().clearProject(projectId);
    }
  }
}

export const connectionPool = new ConnectionPool();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__connectionPool = connectionPool;
}
