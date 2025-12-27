/**
 * Tests for ErrorBoundary component
 * Note: Full component testing requires SolidJS testing library setup
 * These are unit tests for the error handling logic
 */

import { describe, it, expect } from 'vitest';
import { normalizeError } from '@corates/shared';

describe('ErrorBoundary error normalization', () => {
  it('should normalize errors correctly', () => {
    const error = new Error('Test error');
    const normalized = normalizeError(error);

    expect(normalized).toHaveProperty('code');
    expect(normalized).toHaveProperty('message');
    expect(normalized.code).toMatch(/^UNKNOWN_|^TRANSPORT_/);
  });

  it('should identify unknown errors', () => {
    const error = new Error('Programmer error');
    const normalized = normalizeError(error);

    expect(normalized.code).toMatch(/^UNKNOWN_/);
  });

  it('should identify transport errors', () => {
    const error = new Error('Failed to fetch');
    const normalized = normalizeError(error);

    expect(normalized.code).toMatch(/^TRANSPORT_/);
  });
});
