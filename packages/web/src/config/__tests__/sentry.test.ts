import { describe, it, expect, vi } from 'vitest';

// The global test setup mocks this module; these tests need the real one.
vi.unmock('@/config/sentry');
import type { ErrorEvent } from '@sentry/react';
import { crashLogData } from '@/config/sentry';

describe('crashLogData', () => {
  it('keeps name, message, mechanism, and tags, never the stack', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'x is not a function',
            mechanism: { type: 'onerror', handled: false },
            stacktrace: { frames: [{ filename: 'app.js', lineno: 1 }] },
          },
        ],
      },
      tags: { component: 'SectionErrorBoundary', action: 'render' },
    } as unknown as ErrorEvent;

    const data = crashLogData(event);

    expect(data).toEqual({
      errorName: 'TypeError',
      errorMessage: 'x is not a function',
      mechanism: 'onerror',
      component: 'SectionErrorBoundary',
      action: 'render',
    });
    expect(JSON.stringify(data)).not.toContain('app.js');
  });

  it('falls back to the event message and truncates', () => {
    const event = { type: undefined, message: 'm'.repeat(300) } as unknown as ErrorEvent;

    const data = crashLogData(event);

    expect(data.errorName).toBe('Error');
    expect((data.errorMessage as string).length).toBe(200);
  });
});
