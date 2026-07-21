/**
 * Sync durability edge-case tests for ProjectDoc.
 *
 * Motivated by a production incident (2026-07): a reviewer's checklist answers,
 * written during sessions where the websocket was down, were repeatedly pushed
 * to the server via the #521 handshake pull but never survived on the server.
 * Statuses written in later live sessions persisted fine. These tests probe
 * every layer where that backlog could be lost:
 *
 *  1. Does a pulled backlog survive a DO restart (storage round-trip)?
 *  2. What happens when a single update exceeds DO SQLite value limits?
 *  3. What happens when persistUpdate fails (swallowed error) and the DO restarts?
 *  4. Does a corrupt persisted row poison initializeDoc (the "internal error on
 *     every websocket upgrade" signature observed in Sentry)?
 *  5. Do causally-dependent updates from a lost session stall later updates
 *     (pending structs), and does the handshake heal them?
 *  6. The full production scenario: answers from a dead-socket session, status
 *     from a live session, then a reconnect handshake.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { clearProjectDOs } from '../../__tests__/helpers.js';
import type { ProjectDoc } from '../ProjectDoc.js';

vi.mock('@/auth/config.js', () => ({
  verifyAuth: vi.fn(async () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  })),
}));

const messageSync = 0;

interface ProjectDocInternals {
  doc: Y.Doc | null;
  awareness: unknown;
  forceCompactPending: boolean;
  persistence: {
    persistUpdate(update: Uint8Array): 'ok' | 'compact' | 'oversized' | 'failed';
    forceCompact(doc: Y.Doc): boolean;
    compact(doc: Y.Doc): void;
    rowCount: number;
  };
  initializeDoc(): Promise<void>;
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void>;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

function makeMockWs(sent: Uint8Array[]): WebSocket {
  let attachment: unknown = { user: { id: 'user-1' }, awarenessClientId: null };
  return {
    readyState: WebSocket.OPEN,
    send(data: ArrayBuffer | Uint8Array) {
      sent.push(new Uint8Array(data as ArrayBuffer));
    },
    deserializeAttachment: () => attachment,
    serializeAttachment: (a: unknown) => {
      attachment = a;
    },
    close() {},
  } as unknown as WebSocket;
}

function clientSyncStep1(doc: Y.Doc): ArrayBuffer {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, messageSync);
  syncProtocol.writeSyncStep1(enc, doc);
  return toArrayBuffer(encoding.toUint8Array(enc));
}

/** Encode a raw Yjs update as a y-protocols sync update message (live edit path). */
function updateMessage(update: Uint8Array): ArrayBuffer {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, messageSync);
  syncProtocol.writeUpdate(enc, update);
  return toArrayBuffer(encoding.toUint8Array(enc));
}

/** Mirror a y-websocket client processing one server frame, returning any reply. */
function clientProcess(serverMsg: Uint8Array, clientDoc: Y.Doc): ArrayBuffer | null {
  const decoder = decoding.createDecoder(serverMsg);
  if (decoding.readVarUint(decoder) !== messageSync) return null;
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, messageSync);
  syncProtocol.readSyncMessage(decoder, enc, clientDoc, 'client');
  return encoding.length(enc) > 1 ? toArrayBuffer(encoding.toUint8Array(enc)) : null;
}

/** Full connect handshake: client step 1, then relay every server frame back. */
async function handshake(
  internals: ProjectDocInternals,
  clientDoc: Y.Doc,
  ws: WebSocket,
  sent: Uint8Array[],
): Promise<void> {
  await internals.webSocketMessage(ws, clientSyncStep1(clientDoc));
  // Process all frames the server sent (proactive step2 is sent at accept time
  // in prod; here the reply to step1 and the server's own step1 both land in
  // `sent`). Relay client replies until quiescent.
  let cursor = 0;
  while (cursor < sent.length) {
    const frame = sent[cursor++];
    const reply = clientProcess(frame, clientDoc);
    if (reply) await internals.webSocketMessage(ws, reply);
  }
}

/** Simulate a DO restart: drop in-memory doc so initializeDoc reloads storage. */
async function restartDO(internals: ProjectDocInternals): Promise<void> {
  internals.doc = null;
  internals.awareness = null;
  await internals.initializeDoc();
}

/** Build a checklist answers payload of roughly `bytes` in Y.Text content. */
function fillChecklist(
  doc: Y.Doc,
  studyId: string,
  checklistId: string,
  opts: { answerCount?: number; commentBytes?: number } = {},
): void {
  const { answerCount = 20, commentBytes = 100 } = opts;
  const study = doc.getMap('reviews').get(studyId) as Y.Map<unknown>;
  const checklists = study.get('checklists') as Y.Map<unknown>;
  const cl = checklists.get(checklistId) as Y.Map<unknown>;
  const answers = cl.get('answers') as Y.Map<unknown>;
  doc.transact(() => {
    for (let q = 0; q < answerCount; q++) {
      answers.set(`d${q}_1`, 'Y');
      const t = new Y.Text();
      answers.set(`d${q}_1.comment`, t);
      t.insert(0, 'x'.repeat(commentBytes));
    }
    cl.set('updatedAt', 1751900000000);
  });
}

function seedStudyWithChecklist(doc: Y.Doc, studyId: string, checklistId: string): void {
  const study = new Y.Map<unknown>();
  study.set('name', 'Study');
  const checklists = new Y.Map<unknown>();
  const cl = new Y.Map<unknown>();
  cl.set('type', 'ROB2');
  cl.set('status', 'in-progress');
  cl.set('assignedTo', 'user-1');
  cl.set('answers', new Y.Map<unknown>());
  checklists.set(checklistId, cl);
  study.set('checklists', checklists);
  doc.getMap('reviews').set(studyId, study);
}

function getChecklist(doc: Y.Doc, studyId: string, checklistId: string): Y.Map<unknown> {
  const study = doc.getMap('reviews').get(studyId) as Y.Map<unknown>;
  const checklists = study.get('checklists') as Y.Map<unknown>;
  return checklists.get(checklistId) as Y.Map<unknown>;
}

function answeredCount(doc: Y.Doc, studyId: string, checklistId: string): number {
  const cl = getChecklist(doc, studyId, checklistId);
  const answers = cl.get('answers') as Y.Map<unknown>;
  let n = 0;
  for (const [k, v] of answers.entries()) {
    if (typeof v === 'string' && !k.includes('.')) n++;
  }
  return n;
}

describe('ProjectDoc sync durability edge cases', () => {
  // Unique project per test: clearProjectDOs wipes storage but the live DO
  // instance (and its in-memory doc) survives across tests in a file, so
  // reusing one name leaks state through initializeDoc's early return.
  let testSeq = 0;
  let projectId = '';

  beforeEach(async () => {
    testSeq++;
    projectId = `backlog-sync-test-${testSeq}`;
    await clearProjectDOs([projectId]);
    vi.clearAllMocks();
  });

  function getStub() {
    const id = env.PROJECT_DOC.idFromName(`project:${projectId}`);
    return env.PROJECT_DOC.get(id);
  }

  it('backlog pulled via handshake survives a DO restart', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;
      // Server knows the study + empty checklist (created while client was online).
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      // Client synced that state, then filled the checklist while offline.
      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
      fillChecklist(clientDoc, 'study-1', 'cl-1', { answerCount: 25, commentBytes: 200 });

      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await handshake(internals, clientDoc, ws, sent);

      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(25);

      // Restart: reload purely from persisted rows.
      await restartDO(internals);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(25);
    });
  });

  it('a large (~1MB) backlog update persists and survives restart', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
      // ~1MB of comment text across 50 answers.
      fillChecklist(clientDoc, 'study-1', 'cl-1', { answerCount: 50, commentBytes: 20_000 });
      const diffSize = Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(serverDoc)).byteLength;
      expect(diffSize).toBeGreaterThan(900_000);

      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await handshake(internals, clientDoc, ws, sent);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(50);

      await restartDO(internals);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(50);
    });
  });

  it('documents behavior when a single update exceeds the 2MB SQLite value limit', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
      // ~3MB of content in one offline session -> one merged SyncStep2 update.
      fillChecklist(clientDoc, 'study-1', 'cl-1', { answerCount: 30, commentBytes: 100_000 });
      const diffSize = Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(serverDoc)).byteLength;
      expect(diffSize).toBeGreaterThan(2_000_000);

      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await handshake(internals, clientDoc, ws, sent);

      // In memory the server always has it.
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(30);

      // Regression: before the forced-snapshot fallback, the oversized single
      // row insert failed silently (2MB SQLite value cap) and a restart lost
      // exactly this update while smaller neighbors survived -- the production
      // "reviewer's answers vanished" incident.
      await restartDO(internals);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(30);
    });
  });

  it('a failed insert triggers the snapshot fallback so the update survives restart', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
      fillChecklist(clientDoc, 'study-1', 'cl-1', { answerCount: 10 });

      // Inject a persistence failure (simulates a SQL error on this insert).
      const original = internals.persistence.persistUpdate.bind(internals.persistence);
      internals.persistence.persistUpdate = () => 'failed';

      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await handshake(internals, clientDoc, ws, sent);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(10);

      internals.persistence.persistUpdate = original;
      await restartDO(internals);

      // Before the forceCompact fallback this dropped to 0 (the production
      // divergence: broadcast-before-persist put it in memory only, and the
      // restart lost it while earlier rows survived).
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(10);
      expect(getChecklist(internals.doc!, 'study-1', 'cl-1').get('status')).toBe('in-progress');
    });
  });

  it('a corrupt persisted update row is skipped instead of poisoning initializeDoc', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc, state) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(internals.doc!, Y.encodeStateAsUpdate(seed));

      // Write a garbage row directly into yjs_updates.
      const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      state.storage.sql.exec(
        'INSERT INTO yjs_updates (payload, created_at) VALUES (?, ?)',
        garbage.buffer,
        Date.now(),
      );

      // Before the skip-and-report guard, initializeDoc threw here -- and
      // since every websocket upgrade and RPC calls initializeDoc first, one
      // bad row turned the whole project into "internal error" responses
      // forever (the Sentry signature from the incident window).
      await restartDO(internals);

      // The doc loads; the seeded state (persisted as a healthy row before
      // the garbage one) is intact.
      const study = internals.doc!.getMap('reviews').get('study-1');
      expect(study).toBeDefined();
      expect(getChecklist(internals.doc!, 'study-1', 'cl-1').get('status')).toBe('in-progress');
    });
  });

  it('a double failure (insert AND snapshot fallback) is retried on the next update', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
      fillChecklist(clientDoc, 'study-1', 'cl-1', { answerCount: 12 });

      // Worst case: the insert fails AND the forced-snapshot fallback fails
      // (e.g. a transient storage outage). The update now exists only in the
      // in-memory doc.
      const originalPersist = internals.persistence.persistUpdate.bind(internals.persistence);
      const originalForce = internals.persistence.forceCompact.bind(internals.persistence);
      let forceCalls = 0;
      internals.persistence.persistUpdate = () => 'failed';
      internals.persistence.forceCompact = () => {
        forceCalls++;
        return false;
      };

      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await handshake(internals, clientDoc, ws, sent);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(12);
      expect(forceCalls).toBeGreaterThan(0);
      expect(internals.forceCompactPending).toBe(true);

      // Storage recovers. The NEXT update (any small live edit) must retry the
      // forced snapshot -- without the retry flag, the unstored backlog would
      // wait for the 500-row compaction threshold, an eviction-sized window.
      internals.persistence.persistUpdate = originalPersist;
      internals.persistence.forceCompact = originalForce;

      getChecklist(clientDoc, 'study-1', 'cl-1').set('status', 'reviewer-completed');
      const statusUpdate = Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(internals.doc!));
      await internals.webSocketMessage(ws, updateMessage(statusUpdate));
      expect(internals.forceCompactPending).toBe(false);

      await restartDO(internals);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(12);
      expect(getChecklist(internals.doc!, 'study-1', 'cl-1').get('status')).toBe(
        'reviewer-completed',
      );
    });
  });

  it('a corrupt snapshot chunk fails loudly on every request instead of serving a partial doc', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc, state) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(internals.doc!, Y.encodeStateAsUpdate(seed));

      // Corrupt the doc's base state: a garbage snapshot row. Unlike update
      // rows (skipped with a report), snapshot corruption is unrecoverable --
      // loading the remaining rows would serve a doc missing its base state
      // and clients would merge against it (forked history).
      const garbage = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
      state.storage.sql.exec(
        "INSERT INTO yjs_updates (kind, payload, created_at) VALUES ('snapshot', ?, ?)",
        garbage.buffer,
        Date.now(),
      );

      // The load must throw...
      await expect(restartDO(internals)).rejects.toThrow();
      // ...and must KEEP throwing. Before the doc-reset guard, the first
      // failure left a partially-loaded doc in memory and every subsequent
      // initializeDoc early-returned with it, silently serving partial state.
      expect(internals.doc).toBeNull();
      await expect(internals.initializeDoc()).rejects.toThrow();
      expect(internals.doc).toBeNull();
    });
  });

  it('updates from a lost predecessor session stall as pending structs and the handshake heals them', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      // One client session writes answers (update A) then status (update B).
      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
      const svBefore = Y.encodeStateVector(clientDoc);
      fillChecklist(clientDoc, 'study-1', 'cl-1', { answerCount: 5 });
      // Update A (the answers diff against svBefore) is deliberately never
      // sent: it represents the update lost in transit.
      void svBefore;
      const svMid = Y.encodeStateVector(clientDoc);
      getChecklist(clientDoc, 'study-1', 'cl-1').set('status', 'reviewer-completed');
      const updateB = Y.encodeStateAsUpdate(clientDoc, svMid);

      // Only update B (status) reaches the server -- A was lost in transit.
      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await internals.webSocketMessage(ws, updateMessage(updateB));

      // Same-client causality: B's content depends on A's clocks, so B's new
      // status item stays pending and invisible. But B's DELETE SET applies
      // immediately, removing the previous 'in-progress' item -- so the status
      // reads as undefined, not the old value. Partial application can make
      // existing data vanish until the gap is healed. (This also proves the
      // production status writes came from a different session than the lost
      // answers: same-session writes could never show status while hiding
      // answers.)
      expect(getChecklist(internals.doc!, 'study-1', 'cl-1').get('status')).toBeUndefined();
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(0);

      // Heal: full handshake re-sends everything the server's SV lacks.
      const sent2: Uint8Array[] = [];
      const ws2 = makeMockWs(sent2);
      await handshake(internals, clientDoc, ws2, sent2);
      expect(getChecklist(internals.doc!, 'study-1', 'cl-1').get('status')).toBe(
        'reviewer-completed',
      );
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(5);

      // And it must survive restart, including the previously-pending struct.
      await restartDO(internals);
      expect(getChecklist(internals.doc!, 'study-1', 'cl-1').get('status')).toBe(
        'reviewer-completed',
      );
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(5);
    });
  });

  it('full production scenario: dead-socket answers + live status, then reconnect handshake', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      // Session 1 (spring, socket dead): scores the checklist. Nothing sent.
      const session1 = new Y.Doc();
      Y.applyUpdate(session1, Y.encodeStateAsUpdate(serverDoc));
      fillChecklist(session1, 'study-1', 'cl-1', { answerCount: 17 });

      // Session 2 (later, live): loads session 1's state from local persistence
      // (new Y.Doc client id), marks complete. Only the live edit broadcasts.
      const session2 = new Y.Doc();
      Y.applyUpdate(session2, Y.encodeStateAsUpdate(session1));
      const svBeforeStatus = Y.encodeStateVector(session2);
      getChecklist(session2, 'study-1', 'cl-1').set('status', 'reviewer-completed');
      const statusUpdate = Y.encodeStateAsUpdate(session2, svBeforeStatus);

      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await internals.webSocketMessage(ws, updateMessage(statusUpdate));

      // Different client id -> no causal dependency -> status IS visible while
      // the answers are absent. This is byte-for-byte the production state.
      expect(getChecklist(internals.doc!, 'study-1', 'cl-1').get('status')).toBe(
        'reviewer-completed',
      );
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(0);

      // Session 3: reconnect with a full handshake (post-#521 behavior). The
      // pull must recover the stranded answers.
      const sent3: Uint8Array[] = [];
      const ws3 = makeMockWs(sent3);
      await handshake(internals, session2, ws3, sent3);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(17);

      await restartDO(internals);
      expect(answeredCount(internals.doc!, 'study-1', 'cl-1')).toBe(17);
    });
  });
});
