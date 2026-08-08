/**
 * The sync-engine workspace wired into corates' workerd: the DO boots with
 * SQLite storage, the admin route enforces its bearer token, and the sync
 * route runs the real authorize chain (Better Auth mocked; D1 real) before
 * completing or rejecting the upgrade.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  FIELD_MSG_GET,
  FIELD_MSG_REJECT,
  FIELD_MSG_STATE,
  FIELD_MSG_UPDATE,
  PROTOCOL_VERSION,
  decodeFieldFrame,
  decodeFieldReject,
  decodeFieldState,
  encodeFieldFrame,
  type FieldFrame,
} from '@cf-sync/protocol/internal';
import { createDb } from '@corates/db/client';
import { orgAccessGrants } from '@corates/db/schema';
import * as Y from 'yjs';
import { handleSyncFetch } from '../workspace';
import { projectWorkspace } from '../admin';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  seedProjectMember,
} from '../../__tests__/helpers';

vi.mock('../../auth/config', () => {
  const mockVerifyAuth = vi.fn(async () => ({
    user: { id: 'user-ws-1', email: 'ws@example.com' },
    session: null,
  }));
  return { verifyAuth: mockVerifyAuth };
});

const nowSec = Math.floor(Date.now() / 1000);
const ORG = 'org-ws';
const PROJECT = 'project-ws';
const USER = 'user-ws-1';
const ADMIN_TOKEN = 'test-sync-admin-token'; // wrangler.test.jsonc var

async function seedMember() {
  await seedUser({
    id: USER,
    name: 'WS User',
    email: 'ws@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });
  await seedOrganization({ id: ORG, name: 'WS Org', slug: `ws-org-${nowSec}`, createdAt: nowSec });
  await seedProject({
    id: PROJECT,
    name: 'WS Project',
    orgId: ORG,
    createdBy: USER,
    createdAt: nowSec,
    updatedAt: nowSec,
  });
  await seedProjectMember({
    id: 'pm-ws-1',
    projectId: PROJECT,
    userId: USER,
    role: 'owner',
    joinedAt: nowSec,
  });
}

function upgradeRequest(projectId: string) {
  return new Request(`https://internal/api/sync/${projectId}?clientId=test-client-1`, {
    headers: {
      Upgrade: 'websocket',
      'Sec-WebSocket-Key': 'test-key',
      'Sec-WebSocket-Version': '13',
    },
  });
}

describe('sync workspace routes', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  it('resolves null for unrelated paths', async () => {
    const response = await handleSyncFetch(new Request('https://internal/api/other'), env);
    expect(response).toBeNull();
  });

  it('serves admin stats with the bearer token — the DO boots with engine SQLite storage', async () => {
    const response = await handleSyncFetch(
      new Request(`https://internal/api/sync-admin/${PROJECT}/stats`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      }),
      env,
    );
    expect(response?.status).toBe(200);
    const stats = (await response!.json()) as Record<string, unknown>;
    expect(stats.workspaceId).toBe(PROJECT);
    expect(stats.schemaVersion).toBe(1);
    expect(stats.rows).toEqual({ live: 0, tombstones: 0 });
  });

  it('rejects admin requests without the right token', async () => {
    const bad = await handleSyncFetch(
      new Request(`https://internal/api/sync-admin/${PROJECT}/stats`, {
        headers: { Authorization: 'Bearer wrong-token' },
      }),
      env,
    );
    expect(bad?.status).toBe(403);
  });

  it('completes the upgrade for a project member and stamps survive to the engine', async () => {
    await seedMember();
    const response = await handleSyncFetch(upgradeRequest(PROJECT), env);
    expect(response?.status).toBe(101);
    expect(response?.webSocket).toBeTruthy();

    const socket = response!.webSocket!;
    socket.accept();
    socket.close(1000, 'test-done');
  });

  it('completes then closes the upgrade for a non-member with the reason slug', async () => {
    await seedMember();
    // verifyAuth mock returns user-ws-1; ask for a project they are not in.
    await seedProject({
      id: 'project-ws-other',
      name: 'Other',
      orgId: ORG,
      createdBy: USER,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const response = await handleSyncFetch(upgradeRequest('project-ws-other'), env);
    expect(response?.status).toBe(101);
    const socket = response!.webSocket!;

    const closed = new Promise<{ code: number; reason: string }>(resolve => {
      socket.addEventListener('close', event =>
        resolve({ code: event.code, reason: event.reason }),
      );
    });
    socket.accept();
    const { code, reason } = await closed;
    expect(code).toBe(4403);
    expect(reason).toBe('not-a-member');
  });

  it('same-worker admin surface exports an empty workspace', async () => {
    const snapshot = (await projectWorkspace(env, PROJECT).export()) as Record<string, unknown>;
    expect(snapshot).toBeTruthy();
    expect(typeof snapshot).toBe('object');
  });
});

/**
 * Minimal ready client for the binary field lane: completes the hello
 * handshake (binary frames are only accepted on ready sockets), then speaks
 * raw field frames. The extension's own semantics are tested in @cf-sync/yjs;
 * what is corates' to prove is that the authorize stamp's writeAllowed
 * reaches the field write gate.
 */
async function fieldClient(projectId: string, clientId: string) {
  const response = await handleSyncFetch(
    new Request(`https://internal/api/sync/${projectId}?clientId=${clientId}`, {
      headers: {
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'test-key',
        'Sec-WebSocket-Version': '13',
      },
    }),
    env,
  );
  expect(response?.status).toBe(101);
  const socket = response!.webSocket!;
  socket.accept();

  const json: Array<{ type: string }> = [];
  const jsonWaiters: Array<(msg: { type: string }) => void> = [];
  const frames: FieldFrame[] = [];
  const frameWaiters: Array<(frame: FieldFrame) => void> = [];
  socket.addEventListener('message', event => {
    if (typeof event.data === 'string') {
      const msg = JSON.parse(event.data) as { type: string };
      const waiter = jsonWaiters.shift();
      if (waiter) waiter(msg);
      else json.push(msg);
      return;
    }
    const frame = decodeFieldFrame(new Uint8Array(event.data as ArrayBuffer));
    if (!frame) throw new Error('undecodable binary frame');
    const waiter = frameWaiters.shift();
    if (waiter) waiter(frame);
    else frames.push(frame);
  });

  const nextJson = () => {
    const queued = json.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise<{ type: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for JSON')), 2000);
      jsonWaiters.push(msg => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  };
  const nextFrame = () => {
    const queued = frames.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise<FieldFrame>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for field frame')), 2000);
      frameWaiters.push(frame => {
        clearTimeout(timer);
        resolve(frame);
      });
    });
  };

  socket.send(
    JSON.stringify({
      type: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      schemaVersion: 1,
      cursor: null,
    }),
  );
  for (;;) {
    const msg = await nextJson();
    if (msg.type === 'error') throw new Error('hello failed');
    if (msg.type === 'pokeEnd') break;
  }

  return {
    nextFrame,
    send: (bytes: Uint8Array) => socket.send(bytes),
    close: () => socket.close(1000, 'test-done'),
  };
}

describe('yjs fields through the workspace DO', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  it('serves a writable field to a writable member and persists updates', async () => {
    await seedMember();
    const client = await fieldClient(PROJECT, 'field-client-1');

    client.send(encodeFieldFrame(FIELD_MSG_GET, 'chk-1:q1.note', new Uint8Array(0)));
    const state = await client.nextFrame();
    expect(state.msgType).toBe(FIELD_MSG_STATE);
    expect(decodeFieldState(state.payload)?.writable).toBe(true);

    const doc = new Y.Doc();
    let update: Uint8Array | null = null;
    doc.on('update', (u: Uint8Array) => {
      update = u;
    });
    doc.getText('t').insert(0, 'consolidated note');
    client.send(encodeFieldFrame(FIELD_MSG_UPDATE, 'chk-1:q1.note', update!));

    // Round-trip: a fresh GET serves a diff containing the persisted edit.
    client.send(encodeFieldFrame(FIELD_MSG_GET, 'chk-1:q1.note', new Uint8Array(0)));
    const after = await client.nextFrame();
    const decoded = decodeFieldState(after.payload);
    const readBack = new Y.Doc();
    Y.applyUpdate(readBack, decoded!.diff);
    expect(readBack.getText('t').toString()).toBe('consolidated note');
    client.close();
  });

  it('stamps read-only members non-writable and REJECTs their updates', async () => {
    // The discriminating case: the extension's default gate would allow any
    // member — writable:false proves authorizeWrite consulted the stamp.
    await seedMember();
    await createDb(env.DB)
      .insert(orgAccessGrants)
      .values({
        id: 'grant-ws-1' as never,
        orgId: ORG as never,
        type: 'trial',
        startsAt: new Date((nowSec - 200_000) * 1000),
        expiresAt: new Date((nowSec - 100_000) * 1000),
      });
    const client = await fieldClient(PROJECT, 'field-client-2');

    client.send(encodeFieldFrame(FIELD_MSG_GET, 'chk-1:q1.note', new Uint8Array(0)));
    const state = await client.nextFrame();
    expect(state.msgType).toBe(FIELD_MSG_STATE);
    expect(decodeFieldState(state.payload)?.writable).toBe(false);

    const doc = new Y.Doc();
    let update: Uint8Array | null = null;
    doc.on('update', (u: Uint8Array) => {
      update = u;
    });
    doc.getText('t').insert(0, 'should be refused');
    client.send(encodeFieldFrame(FIELD_MSG_UPDATE, 'chk-1:q1.note', update!));
    const reject = await client.nextFrame();
    expect(reject.msgType).toBe(FIELD_MSG_REJECT);
    expect(decodeFieldReject(reject.payload)).toBe('NotWritable');
    client.close();
  });
});
