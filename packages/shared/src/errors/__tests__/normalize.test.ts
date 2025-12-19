/**
 * Tests for error normalization
 */

import { describe, it, expect } from 'vitest';
import { normalizeError, isDomainError, isTransportError } from '../normalize.js';
import { createDomainError, createTransportError, PROJECT_ERRORS } from '../index.js';

describe('isDomainError', () => {
  it('should identify domain errors', () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND);
    expect(isDomainError(error)).toBe(true);
  });

  it('should reject transport errors', () => {
    const error = createTransportError('TRANSPORT_NETWORK_ERROR');
    expect(isDomainError(error)).toBe(false);
  });

  it('should reject invalid objects', () => {
    expect(isDomainError({})).toBe(false);
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError('string')).toBe(false);
  });
});

describe('isTransportError', () => {
  it('should identify transport errors', () => {
    const error = createTransportError('TRANSPORT_NETWORK_ERROR');
    expect(isTransportError(error)).toBe(true);
  });

  it('should reject domain errors', () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND);
    expect(isTransportError(error)).toBe(false);
  });
});

describe('normalizeError', () => {
  it('should return domain error as-is', () => {
    const domainError = createDomainError(PROJECT_ERRORS.NOT_FOUND);
    const normalized = normalizeError(domainError);

    expect(normalized).toBe(domainError);
    expect(normalized.code).toBe('PROJECT_NOT_FOUND');
  });

  it('should return transport error as-is', () => {
    const transportError = createTransportError('TRANSPORT_NETWORK_ERROR');
    const normalized = normalizeError(transportError);

    expect(normalized).toBe(transportError);
    expect(normalized.code).toBe('TRANSPORT_NETWORK_ERROR');
  });

  it('should convert CORS Error to CORS transport error', () => {
    const error = new Error('CORS error: Access denied');
    const normalized = normalizeError(error);

    expect(isTransportError(normalized)).toBe(true);
    expect(normalized.code).toBe('TRANSPORT_CORS_ERROR');
    // Type guard narrows to TransportError
    if (isTransportError(normalized)) {
      // TypeScript now knows normalized is TransportError
      expect(normalized.details?.originalError).toBe('CORS error: Access denied');
    }
  });

  it('should convert network Error to transport error', () => {
    const error = new Error('Failed to fetch');
    const normalized = normalizeError(error);

    expect(isTransportError(normalized)).toBe(true);
    expect(normalized.code).toBe('TRANSPORT_NETWORK_ERROR');
  });

  it('should convert timeout Error to transport error', () => {
    const error = new Error('Request timeout');
    const normalized = normalizeError(error);

    expect(isTransportError(normalized)).toBe(true);
    expect(normalized.code).toBe('TRANSPORT_TIMEOUT');
  });

  it('should reject Response objects', () => {
    // Mock Response object
    const response = {
      ok: false,
      status: 404,
      json: async () => ({}),
    };

    const normalized = normalizeError(response);

    expect(normalized.code).toBe('UNKNOWN_PROGRAMMER_ERROR');
    expect(normalized.message).toContain('Response object');
  });

  it('should handle unknown errors', () => {
    const normalized = normalizeError('random string');

    expect(normalized.code).toBe('UNKNOWN_UNHANDLED_ERROR');
    if (isDomainError(normalized)) {
      expect(normalized.statusCode).toBe(500);
    }
  });

  it('should handle null/undefined', () => {
    const normalized1 = normalizeError(null);
    const normalized2 = normalizeError(undefined);

    expect(normalized1.code).toBe('UNKNOWN_UNHANDLED_ERROR');
    expect(normalized2.code).toBe('UNKNOWN_UNHANDLED_ERROR');
    if (isDomainError(normalized1)) {
      expect(normalized1.statusCode).toBe(500);
    }
    if (isDomainError(normalized2)) {
      expect(normalized2.statusCode).toBe(500);
    }
  });
});
