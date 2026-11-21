import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withDoConnectLog } from '@/server/doConnectLog';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));

vi.mock('@corates/workers/logger', () => ({ warn: mockWarn }));

beforeEach(() => {
  vi.clearAllMocks();
});

const target = { durableObject: 'ProjectSyncDO', projectId: 'p1' };

describe('withDoConnectLog', () => {
  it('stays quiet when the object answers', async () => {
    const response = await withDoConnectLog(
      target,
      async () => new Response(null, { status: 200 }),
    );
    expect(response?.status).toBe(200);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('passes through a null for non-sync routes', async () => {
    expect(await withDoConnectLog(target, async () => null)).toBeNull();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs a 5xx response with the target', async () => {
    await withDoConnectLog(target, async () => new Response(null, { status: 503 }));
    expect(mockWarn).toHaveBeenCalledWith(
      'do.connect_failed',
      expect.objectContaining({ ...target, status: 503 }),
    );
  });

  it('logs and rethrows a platform error', async () => {
    const error = new Error('Network connection lost.');
    await expect(
      withDoConnectLog(target, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(mockWarn).toHaveBeenCalledWith(
      'do.connect_failed',
      expect.objectContaining({ ...target, error: 'Network connection lost.' }),
    );
  });
});
