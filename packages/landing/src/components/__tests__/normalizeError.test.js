/**
 * Tests for normalizeError from @corates/shared
 * Tests the error normalization logic used by ErrorBoundary and error handlers.
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
