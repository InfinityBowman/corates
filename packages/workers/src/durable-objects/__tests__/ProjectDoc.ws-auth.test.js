/**
 * Tests for ProjectDoc WebSocket authorization boundary
 * Tests that removed project members cannot keep syncing
 * Note: these tests are flaky due to limitations in the test environment's DO WebSocket support
 * Rerun them to confirm failures are not persistent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  seedProjectMember,
  clearProjectDOs,
} from '@/__tests__/helpers.js';

vi.mock('@/auth/config.js', () => {
  const mockVerifyAuth = vi.fn(async () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  }));

  return {
    verifyAuth: mockVerifyAuth,
    __mockVerifyAuth: mockVerifyAuth,
  };
});

describe('ProjectDoc WebSocket Authorization Boundary', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await clearProjectDOs(['project-allow-test', 'project-reject-test']);
    vi.clearAllMocks();
  });

  async function getProjectDocStub(projectId) {
    const doName = `project:${projectId}`;
    const id = env.PROJECT_DOC.idFromName(doName);
    return env.PROJECT_DOC.get(id);
  }

  function createWebSocketRequest(projectId) {
    return new Request(`https://internal/api/project-doc/${projectId}`, {
      headers: {
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'test-key',
        'Sec-WebSocket-Version': '13',
        Cookie: 'better-auth.session_token=test-token',
      },
    });
  }

  it('should allow WebSocket connection for valid project member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-allow-test';
    const projectId = 'project-allow-test';
    const userId = 'user-1';

    await seedUser({
      id: userId,
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: `test-org-${projectId}`,
      createdAt: nowSec,
    });

    await seedProject({
      id: projectId,
      name: 'Test Project',
      orgId,
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

    const stub = await getProjectDocStub(projectId);

    const wsRequest = createWebSocketRequest(projectId);
    const wsResponse = await stub.fetch(wsRequest);

    expect(wsResponse.status).toBe(101);

    await runInDurableObject(stub, async (instance, state) => {
      expect(state.getWebSockets().length).toBe(1);
    });
  });

  it('should reject WebSocket connection for non-member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-reject-test';
    const projectId = 'project-reject-test';
    const userId = 'user-1';

    await seedUser({
      id: userId,
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'other-user',
      name: 'Other User',
      email: 'other@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: `test-org-${projectId}`,
      createdAt: nowSec,
    });

    await seedProject({
      id: projectId,
      name: 'Test Project',
      orgId,
      createdBy: 'other-user',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const stub = await getProjectDocStub(projectId);

    const wsRequest = createWebSocketRequest(projectId);
    const wsResponse = await stub.fetch(wsRequest);

    expect(wsResponse.status).toBe(403);
    const text = await wsResponse.text();
    expect(text).toContain('Not a project member');
  });
});
