import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  logRequestCompleted,
  shouldLogRequestCompletion,
  withRequestCompletionLog,
} from '@/server/requestCompletion';

const { mockInfo } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
}));

vi.mock('@corates/workers/logger', () => ({
  info: mockInfo,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shouldLogRequestCompletion', () => {
  it('skips batched browser telemetry', () => {
    expect(shouldLogRequestCompletion('/api/client-logs')).toBe(false);
  });

  it('logs normal API routes', () => {
    expect(shouldLogRequestCompletion('/api/projects')).toBe(true);
  });
});

describe('logRequestCompleted', () => {
  it('emits structured request.completed entries', () => {
    logRequestCompleted(201, 42);

    expect(mockInfo).toHaveBeenCalledWith('request.completed', {
      status: 201,
      durationMs: 42,
    });
  });
});

describe('withRequestCompletionLog', () => {
  it('logs status and duration after the handler resolves', async () => {
    const response = await withRequestCompletionLog('/api/health', async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return new Response('ok', { status: 200 });
    });

    expect(response.status).toBe(200);
    expect(mockInfo).toHaveBeenCalledOnce();
    expect(mockInfo.mock.calls[0]?.[0]).toBe('request.completed');
    expect(mockInfo.mock.calls[0]?.[1]).toMatchObject({ status: 200 });
    expect(mockInfo.mock.calls[0]?.[1]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('logs 500 and rethrows when the handler throws', async () => {
    await expect(
      withRequestCompletionLog('/api/projects', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(mockInfo).toHaveBeenCalledWith('request.completed', {
      status: 500,
      durationMs: expect.any(Number),
    });
  });

  it('does not log skipped paths', async () => {
    const response = await withRequestCompletionLog('/api/client-logs', async () => {
      return new Response(null, { status: 204 });
    });

    expect(response.status).toBe(204);
    expect(mockInfo).not.toHaveBeenCalled();
  });
});
