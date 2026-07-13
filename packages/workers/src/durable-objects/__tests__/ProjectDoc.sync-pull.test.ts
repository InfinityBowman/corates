/**
 * Regression test for the second-client data-loss bug (#520).
 *
 * Before the fix, ProjectDoc only ever PUSHED its state to a connecting client
 * (a proactive sync step 2 plus a sync step 2 reply to the client's sync step
 * 1). It never sent its own sync step 1, so it had no way to PULL state the
 * client held but the server lacked -- e.g. a checklist a reviewer created
 * during a window where the live `update` broadcast was missed. That state was
 * silently lost: the e2e symptom was the second reviewer's checklist rendering
 * "Checklist not found".
 *
 * The fix makes the server send its own sync step 1 on a connection's first
 * message, so the client answers with a sync step 2 carrying everything the
 * server is missing. This test drives that handshake against a real DO and
 * asserts the server ends up with the client-only checklist.
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

/** The first thing y-websocket sends on open: its sync step 1 (state vector). */
function clientSyncStep1(doc: Y.Doc): ArrayBuffer {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, messageSync);
  syncProtocol.writeSyncStep1(enc, doc);
  return toArrayBuffer(encoding.toUint8Array(enc));
}

/** Mirror a real y-websocket client processing one server sync frame, returning any reply. */
function clientProcess(serverMsg: Uint8Array, clientDoc: Y.Doc): ArrayBuffer | null {
  const decoder = decoding.createDecoder(serverMsg);
  if (decoding.readVarUint(decoder) !== messageSync) return null;
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, messageSync);
  syncProtocol.readSyncMessage(decoder, enc, clientDoc, 'client');
  return encoding.length(enc) > 1 ? toArrayBuffer(encoding.toUint8Array(enc)) : null;
}

describe('ProjectDoc client->server sync pull', () => {
  const projectId = 'sync-pull-test';

  beforeEach(async () => {
    await clearProjectDOs([projectId]);
    vi.clearAllMocks();
  });

  function getStub() {
    const id = env.PROJECT_DOC.idFromName(`project:${projectId}`);
    return env.PROJECT_DOC.get(id);
  }

  it('pulls a checklist the client has but the server lacks on first message', async () => {
    const stub = getStub();

    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const internals = instance as unknown as ProjectDocInternals;
      await internals.initializeDoc();
      const serverDoc = internals.doc!;

      // Server starts with a study and one checklist (cl-a).
      const seed = new Y.Doc();
      const seedStudy = new Y.Map<unknown>();
      seedStudy.set('name', 'Study');
      const seedChecklists = new Y.Map<unknown>();
      const clA = new Y.Map<unknown>();
      clA.set('type', 'AMSTAR2');
      seedChecklists.set('cl-a', clA);
      seedStudy.set('checklists', seedChecklists);
      seed.getMap('reviews').set('study-1', seedStudy);
      Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(seed));

      // Client is in sync with the server, then adds cl-b locally -- the write
      // the server never received via a live broadcast.
      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));
      const clientChecklists = (clientDoc.getMap('reviews').get('study-1') as Y.Map<unknown>).get(
        'checklists',
      ) as Y.Map<unknown>;
      clientDoc.transact(() => {
        const clB = new Y.Map<unknown>();
        clB.set('type', 'AMSTAR2');
        clientChecklists.set('cl-b', clB);
      });

      const serverChecklists = () =>
        (serverDoc.getMap('reviews').get('study-1') as Y.Map<unknown>).get(
          'checklists',
        ) as Y.Map<unknown>;

      // Precondition: the server does not have the client's cl-b.
      expect(serverChecklists().has('cl-b')).toBe(false);

      // Connect: client sends sync step 1 as its first message.
      const sent: Uint8Array[] = [];
      const ws = makeMockWs(sent);
      await internals.webSocketMessage(ws, clientSyncStep1(clientDoc));

      // Feed every server frame back through the client; relay its replies.
      // With the fix, one of those frames is the server's own sync step 1, to
      // which the client answers with a sync step 2 containing cl-b.
      for (const msg of [...sent]) {
        const reply = clientProcess(msg, clientDoc);
        if (reply) await internals.webSocketMessage(ws, reply);
      }

      // The server has now pulled the client-only checklist.
      expect(serverChecklists().has('cl-b')).toBe(true);
    });
  });
});
