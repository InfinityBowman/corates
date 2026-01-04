/**
 * Tests for ProjectDoc routing in main index.js
 * Tests WebSocket upgrade passthrough and DO routing correctness
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase } from './helpers.js';

vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ Message: 'mock' });
      }
    },
  };
});

let app;

beforeAll(async () => {
  const mainApp = await import('../index.js');
  app = mainApp.default;
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

describe('ProjectDoc routing - handleProjectDoc', () => {
  it('should passthrough responses from DO stub without wrapping', async () => {
    const mockResponseBody = { message: 'from DO' };
    const mockResponse = new Response(JSON.stringify(mockResponseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const mockStub = {
      fetch: vi.fn().mockResolvedValue(mockResponse),
    };

    const mockDO = {
      idFromName: vi.fn(() => ({ toString: () => 'do-id' })),
      get: vi.fn(() => mockStub),
    };

    const testEnv = {
      ...env,
      PROJECT_DOC: mockDO,
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/project-doc/project-123');

    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(mockStub.fetch).toHaveBeenCalled();
    const body = await res.json();
    expect(body.message).toBe('from DO');
  });

  it('should return non-WebSocket responses normally', async () => {
    const mockResponseBody = { message: 'test response' };
    const mockStub = {
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    };

    const mockDO = {
      idFromName: vi.fn(() => ({ toString: () => 'do-id' })),
      get: vi.fn(() => mockStub),
    };

    const testEnv = {
      ...env,
      PROJECT_DOC: mockDO,
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/project-doc/project-123');

    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('test response');
    expect(mockStub.fetch).toHaveBeenCalled();
  });
});
