/**
 * Reconciled-checklist collaborative text: the seam between the reconcile UI
 * and the workspace's Yjs fields.
 *
 * During a reconciliation session the reconciled checklist's prose fields
 * (final notes/comments, preliminary text) are co-edited live as Yjs fields —
 * field id = the `answers` row id (`answerRowId(checklistId, flatKey)`), the
 * one-name convention ids.ts documents. Finalize serializes each field's text
 * back into its row (`serializeFieldsIntoRows`), after which the finalized
 * checklist is an ordinary row-backed artifact everywhere.
 *
 * Local practice has no socket and no co-editor: the same hook falls back to
 * the `answers` row directly, exactly like the instrument editors.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type { YjsFieldHandle, YjsFields } from '@cf-sync/yjs/client';
import { answerRowId, textAnswerKeys, type ChecklistType } from '@corates/shared/sync';
import { applyYTextDiff } from '@/lib/yTextDiff';
import { useAnswerValue, useAnswerWriters } from '@/project/workspace-data';

/**
 * Session-lifetime store of field handles for one reconciled checklist.
 * Handles are acquired once per field and released together on dispose, so
 * programmatic writes (autofill, copy/merge) and editors share one doc per
 * field and offline-typed edits survive page navigation within the session.
 */
export class ReconciledFieldStore {
  private handles = new Map<string, YjsFieldHandle>();
  private disposed = false;

  constructor(
    private yfields: YjsFields,
    readonly checklistId: string,
  ) {}

  handle(fieldKey: string): YjsFieldHandle {
    if (this.disposed) throw new Error('ReconciledFieldStore: disposed');
    let handle = this.handles.get(fieldKey);
    if (!handle) {
      handle = this.yfields.getDoc(answerRowId(this.checklistId, fieldKey));
      this.handles.set(fieldKey, handle);
    }
    return handle;
  }

  /**
   * Programmatic whole-string write (autofill, copy-to-final, merge, reset):
   * applied as a minimal diff once the field has synced, so a concurrent
   * keystroke elsewhere in the text survives the replace.
   */
  setText(fieldKey: string, text: string): void {
    const handle = this.handle(fieldKey);
    void handle.whenSynced.then(() => {
      if (this.disposed) return;
      applyYTextDiff(handle.text, handle.text.toString(), text);
    });
  }

  /**
   * Read the current text of every given field, for the finalize
   * serialization. Resolves null when any field fails to sync within
   * `timeoutMs` (i.e. we are offline) — the caller must not finalize from a
   * partial read.
   */
  async readAll(fieldKeys: string[], timeoutMs: number): Promise<Map<string, string> | null> {
    const handles = fieldKeys.map(key => ({ key, handle: this.handle(key) }));
    const synced = await Promise.race([
      Promise.all(handles.map(({ handle }) => handle.whenSynced)).then(() => true),
      new Promise<false>(resolve => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    if (!synced || this.disposed) return null;
    return new Map(handles.map(({ key, handle }) => [key, handle.text.toString()]));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const handle of this.handles.values()) handle.release();
    this.handles.clear();
  }
}

export interface ReconcileFieldsContextValue {
  projectId: string;
  reconciledChecklistId: string;
  /** Null in local practice: text lives in answer rows, not fields. */
  store: ReconciledFieldStore | null;
}

export const ReconcileFieldsContext = createContext<ReconcileFieldsContextValue | null>(null);

export interface ReconciledText {
  value: string;
  /** Whole-string set; the binding applies it as a minimal diff. */
  setValue: (text: string) => void;
  /** False while the field is read-only (billing stamp) or still syncing. */
  canWrite: boolean;
  /** False until the field's first server STATE; local practice is always ready. */
  ready: boolean;
}

interface FieldSnapshot {
  value: string;
  canWrite: boolean;
  ready: boolean;
}

const UNSYNCED: FieldSnapshot = { value: '', canWrite: false, ready: false };

/**
 * One reconciled-checklist text field as live React state. Online it is the
 * Yjs field (value tracks remote keystrokes, `canWrite` tracks the server's
 * writable verdict); in local practice it is the answer row. Must be used
 * inside a `ReconcileFieldsContext` provider.
 */
export function useReconciledText(fieldKey: string): ReconciledText {
  const ctx = useContext(ReconcileFieldsContext);
  if (!ctx) {
    throw new Error('useReconciledText must be used inside ReconcileFieldsContext');
  }
  const { projectId, reconciledChecklistId, store } = ctx;

  const [snap, setSnap] = useState<FieldSnapshot>(UNSYNCED);

  useEffect(() => {
    if (!store) return;
    const handle = store.handle(fieldKey);
    let alive = true;
    let ready = false;
    const publish = () => {
      if (!alive) return;
      setSnap({ value: handle.text.toString(), canWrite: handle.canWrite, ready });
    };
    const observer = () => publish();
    handle.text.observe(observer);
    const unsubscribe = handle.subscribe(publish);
    void handle.whenSynced.then(() => {
      ready = true;
      publish();
    });
    publish();
    return () => {
      alive = false;
      unsubscribe();
      handle.text.unobserve(observer);
      // The store owns the handle's lifetime; nothing to release here.
    };
  }, [store, fieldKey]);

  // Row fallback (local practice) — hooks always run; cheap when unused.
  const rowValue = useAnswerValue<string>(projectId, reconciledChecklistId, fieldKey);
  const writers = useAnswerWriters(projectId, '', reconciledChecklistId);

  if (store) {
    return {
      value: snap.value,
      setValue: text => {
        const handle = store.handle(fieldKey);
        applyYTextDiff(handle.text, handle.text.toString(), text);
      },
      canWrite: snap.canWrite,
      ready: snap.ready,
    };
  }
  return {
    value: typeof rowValue === 'string' ? rowValue : '',
    setValue: text => writers.setText(fieldKey, text),
    canWrite: true,
    ready: true,
  };
}

const EMPTY_TEXT_MAP: Record<string, string> = {};

/**
 * Every non-empty text field of the reconciled checklist as a live flat map —
 * the overlay the wrapper merges over the serialized answer rows, so
 * derivations that read the reconciled checklist (the summary's
 * answered-gating on ROB2 preliminary text, note displays) see the fields'
 * mid-session content, not the rows the fields only serialize into at
 * finalize. Null store (local practice) returns empty: rows are already live
 * there. Takes the store directly because the wrapper calls it above its own
 * context provider.
 */
export function useReconciledTextMap(
  store: ReconciledFieldStore | null,
  checklistType: ChecklistType,
): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>(EMPTY_TEXT_MAP);

  useEffect(() => {
    if (!store) return;
    const keys = textAnswerKeys(checklistType);
    let alive = true;
    const compute = () => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const key of keys) {
        const text = store.handle(key).text.toString();
        if (text) next[key] = text;
      }
      setMap(prev => {
        const prevKeys = Object.keys(prev);
        if (
          prevKeys.length === Object.keys(next).length &&
          prevKeys.every(key => prev[key] === next[key])
        ) {
          return prev;
        }
        return next;
      });
    };
    const unsubscribes = keys.map(key => {
      const handle = store.handle(key);
      const observer = () => compute();
      handle.text.observe(observer);
      return () => handle.text.unobserve(observer);
    });
    compute();
    return () => {
      alive = false;
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [store, checklistType]);

  return store ? map : EMPTY_TEXT_MAP;
}

/** The finalize-time field read window; beyond this we assume we are offline. */
const FINALIZE_SYNC_TIMEOUT_MS = 8_000;

/**
 * Serialize every text field's current content into its `answers` row —
 * called right before the reconciled checklist is finalized, so the finalized
 * artifact reads entirely from rows. Only changed keys mutate. Returns false
 * (writing nothing) when the fields cannot all be read — finalizing from a
 * partial read would silently drop notes.
 */
export async function serializeFieldsIntoRows(
  store: ReconciledFieldStore,
  checklistType: ChecklistType,
  currentRows: Record<string, unknown>,
  setText: (fieldKey: string, text: string) => void,
): Promise<boolean> {
  const keys = textAnswerKeys(checklistType);
  const texts = await store.readAll(keys, FINALIZE_SYNC_TIMEOUT_MS);
  if (!texts) return false;
  for (const [key, text] of texts) {
    const rowValue = typeof currentRows[key] === 'string' ? (currentRows[key] as string) : '';
    if (text !== rowValue) setText(key, text);
  }
  return true;
}
