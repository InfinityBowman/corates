/**
 * Real-websocket sync tests for ProjectDoc.
 *
 * Unlike the mock-socket tests in ProjectDoc.backlog-sync.test.ts, these open
 * genuine hibernatable websockets via stub.fetch(Upgrade) and use
 * evictDurableObject() (vitest-pool-workers >= 0.16.20) for true
 * eviction/hibernation: the DO instance is torn down, the constructor and
 * storage reload re-run, and hibernated sockets survive and wake the DO.
 *
 * This exercises the full production path: handleWebSocket auth, the
 * proactive SyncStep2 at accept, the server SyncStep1 on first inbound
 * message (#521), webSocketMessage dispatch, persistence, and the
 * hibernation-wake SyncStep1 to surviving sockets.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, runInDurableObject, evictDurableObject } from 'cloudflare:test';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import type { ProjectDoc } from '../ProjectDoc.js';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  seedProjectMember,
  clearProjectDOs,
} from '../../__tests__/helpers.js';

vi.mock('@/auth/config.js', () => ({
  verifyAuth: vi.fn(async () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  })),
}));

const messageSync = 0;

/** A minimal y-websocket-equivalent client over a real socket. */
class MiniSyncClient {
  doc: Y.Doc;
  socket: WebSocket;

  constructor(doc: Y.Doc, socket: WebSocket) {
    this.doc = doc;
    this.socket = socket;
    socket.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;
      if (!(data instanceof ArrayBuffer)) return;
      const decoder = decoding.createDecoder(new Uint8Array(data));
      if (decoding.readVarUint(decoder) !== messageSync) return;
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, messageSync);
      syncProtocol.readSyncMessage(decoder, enc, this.doc, 'server');
      if (encoding.length(enc) > 1) {
        socket.send(encoding.toUint8Array(enc));
      }
    });
    // Forward local doc updates while "connected", like y-websocket does.
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'server') return;
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, messageSync);
      syncProtocol.writeUpdate(enc, update);
      socket.send(encoding.toUint8Array(enc));
    });
  }

  sendSyncStep1(): void {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, messageSync);
    syncProtocol.writeSyncStep1(enc, this.doc);
    this.socket.send(encoding.toUint8Array(enc));
  }
}

async function openSocket(stub: DurableObjectStub): Promise<WebSocket> {
  const response = await stub.fetch('https://internal/api/project-doc/realws-project', {
    headers: {
      Upgrade: 'websocket',
      'Sec-WebSocket-Key': 'test-key',
      'Sec-WebSocket-Version': '13',
      Cookie: 'better-auth.session_token=test-token',
    },
  });
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  return socket;
}

async function waitFor(check: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return;
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error('waitFor timed out');
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

function fillAnswers(doc: Y.Doc, studyId: string, checklistId: string, count: number): void {
  const study = doc.getMap('reviews').get(studyId) as Y.Map<unknown>;
  const checklists = study.get('checklists') as Y.Map<unknown>;
  const cl = checklists.get(checklistId) as Y.Map<unknown>;
  const answers = cl.get('answers') as Y.Map<unknown>;
  doc.transact(() => {
    for (let q = 0; q < count; q++) {
      answers.set(`d${q}_1`, 'Y');
    }
  }, 'local');
}

async function serverAnsweredCount(
  stub: DurableObjectStub<ProjectDoc>,
  studyId: string,
  checklistId: string,
): Promise<number> {
  return runInDurableObject(stub, async (instance: ProjectDoc) => {
    const internals = instance as unknown as { doc: Y.Doc | null; initializeDoc(): Promise<void> };
    await internals.initializeDoc();
    const study = internals.doc!.getMap('reviews').get(studyId) as Y.Map<unknown> | undefined;
    if (!study) return -1;
    const cl = (study.get('checklists') as Y.Map<unknown>).get(checklistId) as Y.Map<unknown>;
    const answers = cl.get('answers') as Y.Map<unknown>;
    let n = 0;
    for (const [k, v] of answers.entries()) {
      if (typeof v === 'string' && !k.includes('.')) n++;
    }
    return n;
  });
}

describe('ProjectDoc real-websocket sync', () => {
  const projectId = 'realws-project';
  const userId = 'user-1';

  beforeEach(async () => {
    await resetTestDatabase();
    await clearProjectDOs([projectId]);
    vi.clearAllMocks();

    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: userId,
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedOrganization({
      id: 'org-realws',
      name: 'Test Org',
      slug: 'test-org-realws',
      createdAt: nowSec,
    });
    await seedProject({
      id: projectId,
      name: 'Test Project',
      orgId: 'org-realws',
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedProjectMember({
      id: 'pm-1',
      projectId,
      userId,
      role: 'member',
      joinedAt: nowSec,
    });
  });

  function getStub() {
    const id = env.PROJECT_DOC.idFromName(`project:${projectId}`);
    return env.PROJECT_DOC.get(id);
  }

  it('pulls an offline backlog over a real socket and survives real eviction', async () => {
    const stub = getStub();

    // Server learns the study/checklist skeleton first (as if created online).
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as {
        doc: Y.Doc | null;
        initializeDoc(): Promise<void>;
      };
      await internals.initializeDoc();
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(internals.doc!, Y.encodeStateAsUpdate(seed));
    });

    // Client doc holds the skeleton plus offline answers the server lacks.
    const clientDoc = new Y.Doc();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as { doc: Y.Doc | null };
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(internals.doc!));
    });
    fillAnswers(clientDoc, 'study-1', 'cl-1', 17);

    // Connect for real and run the y-websocket handshake.
    const socket = await openSocket(stub);
    const client = new MiniSyncClient(clientDoc, socket);
    client.sendSyncStep1();

    // The server's SyncStep1 (sent on our first inbound message) makes the
    // client reply with a SyncStep2 carrying the 17 stranded answers.
    await waitFor(async () => (await serverAnsweredCount(stub, 'study-1', 'cl-1')) === 17);

    // True eviction: instance torn down, storage reload on next use, socket
    // hibernated. The backlog must come back from SQLite, not memory.
    await evictDurableObject(stub, { webSockets: 'hibernate' });
    expect(await serverAnsweredCount(stub, 'study-1', 'cl-1')).toBe(17);

    // The hibernated socket still works: a live edit wakes the DO and applies.
    fillAnswers(clientDoc, 'study-1', 'cl-1', 18);
    await waitFor(async () => (await serverAnsweredCount(stub, 'study-1', 'cl-1')) === 18);

    socket.close(1000, 'done');
  });

  it('a second real client receives the first client backlog via proactive sync', async () => {
    const stub = getStub();

    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as {
        doc: Y.Doc | null;
        initializeDoc(): Promise<void>;
      };
      await internals.initializeDoc();
      const seed = new Y.Doc();
      seedStudyWithChecklist(seed, 'study-1', 'cl-1');
      Y.applyUpdate(internals.doc!, Y.encodeStateAsUpdate(seed));
    });

    // Client A pushes an offline backlog.
    const docA = new Y.Doc();
    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as { doc: Y.Doc | null };
      Y.applyUpdate(docA, Y.encodeStateAsUpdate(internals.doc!));
    });
    fillAnswers(docA, 'study-1', 'cl-1', 9);
    const socketA = await openSocket(stub);
    const clientA = new MiniSyncClient(docA, socketA);
    clientA.sendSyncStep1();
    await waitFor(async () => (await serverAnsweredCount(stub, 'study-1', 'cl-1')) === 9);

    // Client B connects fresh (empty doc) and must converge to A's answers --
    // this is the second reviewer opening reconciliation.
    const docB = new Y.Doc();
    const socketB = await openSocket(stub);
    const clientB = new MiniSyncClient(docB, socketB);
    clientB.sendSyncStep1();

    await waitFor(() => {
      const study = docB.getMap('reviews').get('study-1') as Y.Map<unknown> | undefined;
      if (!study) return false;
      const cl = (study.get('checklists') as Y.Map<unknown>)?.get('cl-1') as
        | Y.Map<unknown>
        | undefined;
      if (!cl) return false;
      const answers = cl.get('answers') as Y.Map<unknown> | undefined;
      if (!answers) return false;
      let n = 0;
      for (const [k, v] of answers.entries()) {
        if (typeof v === 'string' && !k.includes('.')) n++;
      }
      return n === 9;
    });

    socketA.close(1000, 'done');
    socketB.close(1000, 'done');
  });
});
