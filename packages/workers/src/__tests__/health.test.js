/**
 * Health check endpoint integration tests
 *
 * Tests the /health and /healthz endpoints with real Cloudflare bindings
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, json, fetchApp } from './helpers.js';

// Mock postmark
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
  // Import the main app
  const mainApp = await import('../index.js');
  app = mainApp.default;
});

beforeEach(async () => {
  await resetTestDatabase();
});

describe('Health Check Endpoints', () => {
  it('GET /health returns healthy status with all services', async () => {
    const res = await fetchApp(app, '/health');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('services');
    expect(body.status).toBe('healthy');
    expect(body.services).toHaveProperty('database');
    expect(body.services).toHaveProperty('storage');
    expect(body.services).toHaveProperty('durableObjects');
  });

  it('GET /health checks database connectivity', async () => {
    const res = await fetchApp(app, '/health');
    const body = await json(res);

    expect(body.services.database).toBeDefined();
    expect(body.services.database.type).toBe('D1');
    expect(body.services.database.status).toBe('healthy');
  });

  it('GET /health checks R2 storage connectivity', async () => {
    const res = await fetchApp(app, '/health');
    const body = await json(res);

    expect(body.services.storage).toBeDefined();
    expect(body.services.storage.type).toBe('R2');
    expect(body.services.storage.status).toBe('healthy');
  });

  it('GET /health checks Durable Objects bindings', async () => {
    const res = await fetchApp(app, '/health');
    const body = await json(res);

    expect(body.services.durableObjects).toBeDefined();
    expect(body.services.durableObjects.type).toBe('Durable Objects');
    expect(body.services.durableObjects.status).toBe('healthy');
    expect(body.services.durableObjects.bindings).toBeDefined();
    expect(body.services.durableObjects.bindings.USER_SESSION).toBe(true);
    expect(body.services.durableObjects.bindings.PROJECT_DOC).toBe(true);
    expect(body.services.durableObjects.bindings.EMAIL_QUEUE).toBe(true);
  });

  it('GET /health returns degraded status when database fails', async () => {
    // Create a test env with a failing DB
    const testEnv = {
      ...env,
      DB: {
        prepare: () => ({
          first: async () => {
            throw new Error('Database connection failed');
          },
        }),
      },
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/health');
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.status).toBe('degraded');
    expect(body.services.database.status).toBe('unhealthy');
    expect(body.services.database.error).toBeDefined();
  });

  it('GET /health returns degraded status when R2 fails', async () => {
    // Create a test env with a failing R2
    const testEnv = {
      ...env,
      PDF_BUCKET: {
        list: async () => {
          throw new Error('R2 connection failed');
        },
      },
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/health');
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.status).toBe('degraded');
    expect(body.services.storage.status).toBe('unhealthy');
    expect(body.services.storage.error).toBeDefined();
  });

  it('GET /healthz returns OK text', async () => {
    const res = await fetchApp(app, '/healthz');
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toBe('OK');
  });

  it('GET /health includes ISO timestamp', async () => {
    const res = await fetchApp(app, '/health');
    const body = await json(res);

    expect(body.timestamp).toBeDefined();
    // Verify it's a valid ISO timestamp
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
