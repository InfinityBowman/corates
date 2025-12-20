/**
 * Tests for error response validation
 */

import { describe, it, expect } from 'vitest';
import { validateErrorResponse } from '../validate.js';

describe('validateErrorResponse', () => {
  it('should validate correct domain error response', () => {
    const data = {
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
      statusCode: 404,
      details: { projectId: '123' },
    };

    const validated = validateErrorResponse(data);

    expect(validated.code).toBe('PROJECT_NOT_FOUND');
    expect(validated.message).toBe('Project not found');
    expect(validated.statusCode).toBe(404);
    expect(validated.details).toEqual({ projectId: '123' });
  });

  it('should reject responses without code', () => {
    const data = {
      message: 'Error message',
      statusCode: 500,
    };

    const validated = validateErrorResponse(data);

    expect(validated.code).toBe('UNKNOWN_INVALID_RESPONSE');
    expect(validated.message).toContain('missing code or message');
  });

  it('should reject responses without message', () => {
    const data = {
      code: 'PROJECT_NOT_FOUND',
      statusCode: 404,
    };

    const validated = validateErrorResponse(data);

    expect(validated.code).toBe('UNKNOWN_INVALID_RESPONSE');
    expect(validated.message).toContain('missing code or message');
  });

  it('should reject responses without statusCode', () => {
    const data = {
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
    };

    const validated = validateErrorResponse(data);

    expect(validated.code).toBe('UNKNOWN_INVALID_RESPONSE');
    expect(validated.message).toContain('missing statusCode');
  });

  it('should reject transport error codes from API', () => {
    const data = {
      code: 'TRANSPORT_NETWORK_ERROR',
      message: 'Network error',
      statusCode: 500,
    };

    const validated = validateErrorResponse(data);

    expect(validated.code).toBe('UNKNOWN_INVALID_RESPONSE');
    expect(validated.message).toContain('Invalid error code from API');
  });

  it('should reject unknown error codes from API', () => {
    const data = {
      code: 'UNKNOWN_UNHANDLED_ERROR',
      message: 'Error',
      statusCode: 500,
    };

    const validated = validateErrorResponse(data);

    expect(validated.code).toBe('UNKNOWN_INVALID_RESPONSE');
    expect(validated.message).toContain('Invalid error code from API');
  });

  it('should handle non-object input', () => {
    const validated1 = validateErrorResponse(null);
    const validated2 = validateErrorResponse('string');
    const validated3 = validateErrorResponse(123);

    expect(validated1.code).toBe('UNKNOWN_INVALID_RESPONSE');
    expect(validated2.code).toBe('UNKNOWN_INVALID_RESPONSE');
    expect(validated3.code).toBe('UNKNOWN_INVALID_RESPONSE');
  });

  it('should preserve timestamp if provided', () => {
    const timestamp = '2024-01-01T00:00:00.000Z';
    const data = {
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
      statusCode: 404,
      timestamp,
    };

    const validated = validateErrorResponse(data);

    expect(validated.timestamp).toBe(timestamp);
  });

  it('should generate timestamp if not provided', () => {
    const data = {
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
      statusCode: 404,
    };

    const validated = validateErrorResponse(data);

    expect(validated.timestamp).toBeDefined();
    expect(new Date(validated.timestamp!)).toBeInstanceOf(Date);
  });
});
