/**
 * Tests for UserSession Durable Object
 * Tests WebSocket handling and notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';
import { __mockVerifyAuth as mockVerifyAuth } from '@/auth/config.js';

// Mock auth
vi.mock('@/auth/config.js', () => {
  const mockVerifyAuth = vi.fn(async () => ({
    user: { id: 'test-user-1', email: 'test@example.com' },
  }));

  return {
    verifyAuth: mockVerifyAuth,
    __mockVerifyAuth: mockVerifyAuth, // Export for test access
  };
});

describe('UserSession Durable Object', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear storage between tests
    const stub = await getUserSessionStub('test-user-1');
    await runInDurableObject(stub, async (instance, state) => {
      await state.storage.deleteAll();
      await state.storage.deleteAlarm();
    });
  });

  async function getUserSessionStub(userId) {
    const id = env.USER_SESSION.idFromName(userId);
    return env.USER_SESSION.get(id);
  }

  describe('HTTP Method Handling', () => {
    it('should return 405 for non-WebSocket, non-notify requests', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');
      const req = new Request('https://internal/api/sessions/test-user-1', {
        method: 'GET',
        headers: {
          Cookie: 'better-auth.session_token=test-token',
          Origin: 'http://localhost:5173',
        },
      });

      const res = await stub.fetch(req);
      expect(res.status).toBe(405);

      const body = await res.json();
      expect(body.error).toMatch(/Method not allowed/i);
    });

    it('should handle OPTIONS preflight requests', async () => {
      const stub = await getUserSessionStub('test-user-1');
      const req = new Request('https://internal/api/sessions/test-user-1', {
        method: 'OPTIONS',
        headers: {
          Cookie: 'better-auth.session_token=test-token',
          Origin: 'http://localhost:5173',
        },
      });

      const res = await stub.fetch(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });
  });

  describe('Notifications via RPC', () => {
    it('should handle notification requests', async () => {
      const stub = await getUserSessionStub('test-user-1');
      const notification = {
        type: 'project_added',
        projectId: 'project-123',
        message: 'You were added to a project',
      };

      const result = await stub.notify(notification);
      expect(result.success).toBe(true);
      expect(result.delivered).toBe(false); // No active connections
    });

    it('should store notifications when no active connections', async () => {
      const stub = await getUserSessionStub('test-user-1');
      const notification = {
        type: 'project_added',
        projectId: 'project-123',
      };

      await stub.notify(notification);

      await runInDurableObject(stub, async (instance, state) => {
        const pending = await state.storage.get('pendingNotifications');
        expect(pending).toBeDefined();
        expect(pending.length).toBe(1);
        expect(pending[0].type).toBe('project_added');
        expect(pending[0].timestamp).toBeDefined();
      });
    });

    it('should limit pending notifications to 50', async () => {
      const stub = await getUserSessionStub('test-user-1');

      // Send 55 notifications
      for (let i = 0; i < 55; i++) {
        await stub.notify({
          type: 'test',
          index: i,
        });
      }

      await runInDurableObject(stub, async (instance, state) => {
        const pending = await state.storage.get('pendingNotifications');
        expect(pending.length).toBe(50);
        // First 5 should be removed
        expect(pending[0].index).toBe(5);
        expect(pending[49].index).toBe(54);
      });
    });
  });

  describe('Path Extraction', () => {
    it('should extract userId from path correctly', async () => {
      const stub = await getUserSessionStub('test-user-1');
      await runInDurableObject(stub, async (instance, _state) => {
        expect(instance.extractUserIdFromPath('/api/sessions/user-123/data')).toBe('user-123');
        expect(instance.extractUserIdFromPath('/api/sessions/user-456')).toBe('user-456');
        expect(instance.extractUserIdFromPath('/api/sessions/')).toBe(null);
        expect(instance.extractUserIdFromPath('/other/path')).toBe(null);
      });
    });
  });
});
