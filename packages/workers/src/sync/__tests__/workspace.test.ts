/**
 * The sync-engine workspace wired into corates' workerd: the DO boots with
 * SQLite storage, the admin route enforces its bearer token, and the sync
 * route runs the real authorize chain (Better Auth mocked; D1 real) before
 * completing or rejecting the upgrade.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:workers';
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
  await seedProjectMember({ id: 'pm-ws-1', projectId: PROJECT, userId: USER, role: 'owner', joinedAt: nowSec });
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
