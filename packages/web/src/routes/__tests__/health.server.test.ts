import { describe, expect, it } from 'vitest';
import { handleGet } from '../health';

describe('GET /health', () => {
  it('returns 200 + healthy when all dependencies respond', async () => {
    const res = await handleGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      timestamp: string;
      services: {
        database?: { status: string; type: string };
        storage?: { status: string; type: string };
        durableObjects?: {
          status: string;
          type: string;
          bindings?: { USER_SESSION?: boolean; PROJECT_DOC?: boolean };
        };
      };
    };

    expect(body.status).toBe('healthy');
    expect(typeof body.timestamp).toBe('string');
    expect(body.services.database?.status).toBe('healthy');
    expect(body.services.database?.type).toBe('D1');
    expect(body.services.storage?.status).toBe('healthy');
    expect(body.services.storage?.type).toBe('R2');
    expect(body.services.durableObjects?.status).toBe('healthy');
    expect(body.services.durableObjects?.bindings?.USER_SESSION).toBe(true);
    expect(body.services.durableObjects?.bindings?.PROJECT_DOC).toBe(true);
  });
});
