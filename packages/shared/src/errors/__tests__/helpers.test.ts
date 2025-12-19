/**
 * Tests for error creation helpers
 */

import { describe, it, expect } from 'vitest';
import {
  createDomainError,
  createValidationError,
  createMultiFieldValidationError,
  createTransportError,
  createUnknownError,
  getErrorMessage,
  PROJECT_ERRORS,
} from '../index.js';

describe('createDomainError', () => {
  it('should create a domain error with all required fields', () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId: '123' });

    expect(error.code).toBe('PROJECT_NOT_FOUND');
    expect(error.message).toBe('Project not found');
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ projectId: '123' });
    expect(error.timestamp).toBeDefined();
  });

  it('should allow message override', () => {
    const error = createDomainError(
      PROJECT_ERRORS.NOT_FOUND,
      { projectId: '123' },
      'Custom message',
    );

    expect(error.code).toBe('PROJECT_NOT_FOUND');
    expect(error.message).toBe('Custom message');
    expect(error.statusCode).toBe(404);
  });

  it('should include timestamp', () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND);
    const timestamp = new Date(error.timestamp!);

    expect(timestamp).toBeInstanceOf(Date);
    expect(isNaN(timestamp.getTime())).toBe(false);
  });
});

describe('createValidationError', () => {
  it('should create a validation error with field details', () => {
    const error = createValidationError('email', 'VALIDATION_FIELD_REQUIRED', 'test@example.com');

    expect(error.code).toBe('VALIDATION_FIELD_REQUIRED');
    expect(error.message).toBe('This field is required');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({
      field: 'email',
      value: 'test@example.com',
      constraint: undefined,
    });
  });

  it('should include constraint in details', () => {
    const error = createValidationError(
      'password',
      'VALIDATION_FIELD_TOO_SHORT',
      'abc',
      'min_length',
    );

    expect(error.details).toEqual({
      field: 'password',
      value: 'abc',
      constraint: 'min_length',
    });
  });
});

describe('createMultiFieldValidationError', () => {
  it('should create multi-field validation error', () => {
    const errors = [
      { field: 'email', code: 'VALIDATION_FIELD_REQUIRED' as const, message: 'Email is required' },
      {
        field: 'password',
        code: 'VALIDATION_FIELD_TOO_SHORT' as const,
        message: 'Password too short',
      },
    ];

    const error = createMultiFieldValidationError(errors);

    expect(error.code).toBe('VALIDATION_MULTI_FIELD');
    expect(error.message).toBe('Validation failed for multiple fields');
    expect(error.statusCode).toBe(400);
    expect(error.details).toBeDefined();
    if (error.details && 'fields' in error.details && Array.isArray(error.details.fields)) {
      expect(error.details.fields).toHaveLength(2);
      expect(error.details.fields[0]).toEqual({ field: 'email', message: 'Email is required' });
    }
  });
});

describe('createTransportError', () => {
  it('should create transport error without statusCode', () => {
    const error = createTransportError('TRANSPORT_NETWORK_ERROR');

    expect(error.code).toBe('TRANSPORT_NETWORK_ERROR');
    expect(error.message).toContain('Unable to connect');
    expect('statusCode' in error).toBe(false);
    expect(error.timestamp).toBeDefined();
  });

  it('should allow custom message', () => {
    const error = createTransportError('TRANSPORT_TIMEOUT', 'Custom timeout message', {
      url: '/api/test',
    });

    expect(error.message).toBe('Custom timeout message');
    expect(error.details).toEqual({ url: '/api/test' });
  });
});

describe('createUnknownError', () => {
  it('should create unknown error with statusCode', () => {
    const error = createUnknownError('UNKNOWN_UNHANDLED_ERROR', 'Something went wrong');

    expect(error.code).toBe('UNKNOWN_UNHANDLED_ERROR');
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
  });

  it('should include details', () => {
    const error = createUnknownError('UNKNOWN_PROGRAMMER_ERROR', 'Test error', {
      originalError: 'test',
    });

    expect(error.details).toEqual({ originalError: 'test' });
  });
});

describe('getErrorMessage', () => {
  it('should return message for valid error code', () => {
    const message = getErrorMessage('PROJECT_NOT_FOUND');
    expect(message).toBe('Project not found');
  });

  it('should return message for validation error code', () => {
    const message = getErrorMessage('VALIDATION_FIELD_REQUIRED');
    expect(message).toBe('This field is required');
  });

  it('should return message for transport error code', () => {
    const message = getErrorMessage('TRANSPORT_NETWORK_ERROR');
    expect(message).toContain('Unable to connect');
  });

  it('should return fallback message for unknown code', () => {
    const message = getErrorMessage('UNKNOWN_CODE_XYZ');
    expect(message).toBe('An unexpected error occurred');
  });
});
