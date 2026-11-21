import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirect, notFound } from '@tanstack/react-router';
import {
  createDomainError,
  DomainErrorException,
  FILE_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { logServerFnFailure } from '@/server/logServerFnFailure';

const { mockInfo, mockCaptureError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockCaptureError: vi.fn(),
}));

vi.mock('@corates/workers/logger', () => ({
  info: mockInfo,
  captureError: mockCaptureError,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logServerFnFailure', () => {
  it('logs a client-side domain error with its code, status and details', () => {
    const error = new DomainErrorException(
      createDomainError(FILE_ERRORS.INVALID_TYPE, { receivedType: 'text/plain' }),
    );
    logServerFnFailure(error);
    expect(mockInfo).toHaveBeenCalledWith('serverfn.failed', {
      code: error.code,
      status: error.statusCode,
      details: { receivedType: 'text/plain' },
    });
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('reports a server-side domain error as an exception', () => {
    const error = new DomainErrorException(createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR));
    logServerFnFailure(error);
    expect(mockCaptureError).toHaveBeenCalledWith(error, { tags: { component: 'serverfn' } });
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it('reports an unexpected error as an exception', () => {
    const error = new Error('boom');
    logServerFnFailure(error);
    expect(mockCaptureError).toHaveBeenCalledWith(error, { tags: { component: 'serverfn' } });
  });

  it('ignores redirects and not-found control flow', () => {
    logServerFnFailure(redirect({ to: '/' }));
    logServerFnFailure(notFound());
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
