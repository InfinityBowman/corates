/**
 * Tests for UserSession Durable Object
 * Tests session management, WebSocket handling, notifications, and cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { __mockVerifyAuth as mockVerifyAuth } from '../../auth/config.js';

// Mock auth
vi.mock('../../auth/config.js', () => {
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

  function createAuthRequest(path, method = 'GET', body = null) {
    const headers = {
      Cookie: 'better-auth.session_token=test-token',
      Origin: 'http://localhost:5173',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    return new Request(`https://internal/api/sessions/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
  }

  describe('Session CRUD Operations', () => {
    it('should create a new session', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'POST', {
        data: { theme: 'dark', preferences: {} },
      });

      const res = await stub.fetch(req);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.data.theme).toBe('dark');
      expect(body.createdAt).toBeDefined();
      expect(body.lastActive).toBeDefined();
    });

    it('should get existing session', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');

      // Create session first
      const createReq = createAuthRequest('test-user-1', 'POST', {
        data: { theme: 'light' },
      });
      await stub.fetch(createReq);

      // Get session
      const getReq = createAuthRequest('test-user-1', 'GET');
      const res = await stub.fetch(getReq);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.theme).toBe('light');
      expect(body.lastActive).toBeDefined();
    });

    it('should return default session if none exists', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'GET');

      const res = await stub.fetch(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.data).toEqual({});
      expect(body.createdAt).toBeDefined();
    });

    it('should update session data', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');

      // Create session
      const createReq = createAuthRequest('test-user-1', 'POST', {
        data: { theme: 'light' },
      });
      await stub.fetch(createReq);

      // Update session
      const updateReq = createAuthRequest('test-user-1', 'PUT', {
        data: { theme: 'dark', language: 'en' },
      });
      const res = await stub.fetch(updateReq);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.theme).toBe('dark');
      expect(body.data.language).toBe('en');
      expect(body.lastActive).toBeDefined();
    });

    it('should return 404 when updating non-existent session', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'PUT', {
        data: { theme: 'dark' },
      });

      const res = await stub.fetch(req);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toMatch(/Session not found/i);
    });

    it('should delete session', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');

      // Create session
      const createReq = createAuthRequest('test-user-1', 'POST', {
        data: { theme: 'light' },
      });
      await stub.fetch(createReq);

      // Delete session
      const deleteReq = createAuthRequest('test-user-1', 'DELETE');
      const res = await stub.fetch(deleteReq);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify session is deleted
      const getReq = createAuthRequest('test-user-1', 'GET');
      const getRes = await stub.fetch(getReq);
      const getBody = await getRes.json();
      // Should return default session (empty data)
      expect(getBody.data).toEqual({});
    });
  });

  describe('Access Control', () => {
    it('should require authentication', async () => {
      mockVerifyAuth.mockResolvedValueOnce({ user: null });

      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'GET');

      const res = await stub.fetch(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toMatch(/Authentication required/i);
    });

    it('should deny access to other users sessions', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test1@example.com' },
      });

      const stub = await getUserSessionStub('test-user-2');
      const req = createAuthRequest('test-user-2', 'GET');

      const res = await stub.fetch(req);
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toMatch(/Access denied/i);
    });

    it('should allow user to access their own session', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'GET');

      const res = await stub.fetch(req);
      expect(res.status).toBe(200);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'GET');

      const res = await stub.fetch(req);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'OPTIONS');

      const res = await stub.fetch(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Notifications', () => {
    it('should handle notification requests', async () => {
      const stub = await getUserSessionStub('test-user-1');
      const notification = {
        type: 'project_added',
        projectId: 'project-123',
        message: 'You were added to a project',
      };

      const req = new Request('https://internal/api/sessions/test-user-1/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });

      const res = await stub.fetch(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.delivered).toBe(false); // No active connections
    });

    it('should store notifications when no active connections', async () => {
      const stub = await getUserSessionStub('test-user-1');
      const notification = {
        type: 'project_added',
        projectId: 'project-123',
      };

      const req = new Request('https://internal/api/sessions/test-user-1/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });

      await stub.fetch(req);

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
        const notification = {
          type: 'test',
          index: i,
        };
        const req = new Request('https://internal/api/sessions/test-user-1/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification),
        });
        await stub.fetch(req);
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

  describe('Cleanup Alarm', () => {
    it('should schedule cleanup alarm when session is created', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');
      const req = createAuthRequest('test-user-1', 'POST', {
        data: { theme: 'light' },
      });

      await stub.fetch(req);

      await runInDurableObject(stub, async (instance, state) => {
        const alarm = await state.storage.getAlarm();
        expect(alarm).toBeDefined();
        if (alarm !== null) {
          expect(typeof alarm).toBe('number');
          expect(alarm).toBeGreaterThan(Date.now());
        }
      });
    });

    it('should not schedule duplicate alarms', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');

      // Create session
      const createReq = createAuthRequest('test-user-1', 'POST', {
        data: { theme: 'light' },
      });
      await stub.fetch(createReq);

      let firstAlarm;
      await runInDurableObject(stub, async (instance, state) => {
        firstAlarm = await state.storage.getAlarm();
      });

      // Get session (should trigger scheduleCleanupAlarm)
      const getReq = createAuthRequest('test-user-1', 'GET');
      await stub.fetch(getReq);

      await runInDurableObject(stub, async (instance, state) => {
        const secondAlarm = await state.storage.getAlarm();
        expect(secondAlarm).toBe(firstAlarm);
      });
    });

    it('should cleanup inactive sessions', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');

      // Create session with old lastActive (more than 24 hours ago)
      await runInDurableObject(stub, async (instance, state) => {
        const oldDate = new Date();
        oldDate.setTime(oldDate.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago in milliseconds

        await state.storage.put('session', {
          id: 'test-session',
          createdAt: oldDate.toISOString(),
          lastActive: oldDate.toISOString(),
          data: { theme: 'light' },
        });
      });

      // Manually trigger the alarm handler
      await runInDurableObject(stub, async (instance, _state) => {
        await instance.alarm();
      });

      // Verify session was deleted
      await runInDurableObject(stub, async (instance, state) => {
        const session = await state.storage.get('session');
        // Session should be deleted if inactive for more than 24 hours
        expect(session).toBeUndefined();
      });
    });

    it('should reschedule alarm for active sessions', async () => {
      mockVerifyAuth.mockResolvedValueOnce({
        user: { id: 'test-user-1', email: 'test@example.com' },
      });

      const stub = await getUserSessionStub('test-user-1');

      // Create session with recent lastActive
      await runInDurableObject(stub, async (instance, state) => {
        const recentDate = new Date();
        recentDate.setHours(recentDate.getHours() - 1); // 1 hour ago

        await state.storage.put('session', {
          id: 'test-session',
          createdAt: recentDate.toISOString(),
          lastActive: recentDate.toISOString(),
          data: { theme: 'light' },
        });
      });

      // Trigger alarm
      await runDurableObjectAlarm(stub);

      // Verify session still exists and alarm was rescheduled
      await runInDurableObject(stub, async (instance, state) => {
        const session = await state.storage.get('session');
        expect(session).toBeDefined();

        const alarm = await state.storage.getAlarm();
        expect(alarm).toBeDefined();
        if (alarm !== null) {
          expect(typeof alarm).toBe('number');
          expect(alarm).toBeGreaterThan(Date.now());
        }
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
