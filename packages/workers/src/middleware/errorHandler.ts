import type { Context, ErrorHandler } from 'hono';
import {
  createDomainError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  isDomainError,
} from '@corates/shared';

interface ZodError extends Error {
  name: 'ZodError';
  errors: Array<{ path?: (string | number)[]; message: string }>;
}

function isZodError(error: unknown): error is ZodError {
  return (
    error !== null &&
    typeof error === 'object' &&
    ((error as ZodError).name === 'ZodError' || Array.isArray((error as ZodError).errors))
  );
}

function formatZodErrors(error: ZodError): string {
  if (!error.errors) return 'Validation failed';
  return error.errors
    .map(e => {
      const path = e.path?.join('.') || 'input';
      return `${path}: ${e.message}`;
    })
    .join('; ');
}

interface HTTPException extends Error {
  getResponse(): Response;
}

function isHTTPException(error: unknown): error is HTTPException {
  return error !== null && typeof error === 'object' && 'getResponse' in error;
}

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[${c.req.method}] ${c.req.path}:`, err);

  if (isDomainError(err)) {
    return c.json(err, err.statusCode as 400 | 401 | 403 | 404 | 500);
  }

  if (isZodError(err)) {
    const error = createDomainError(VALIDATION_ERRORS.FAILED, {
      validationErrors: err.errors,
      message: formatZodErrors(err),
    });
    return c.json(error, error.statusCode as 400);
  }

  if (isHTTPException(err)) {
    return err.getResponse();
  }

  if (err?.message?.includes('D1_')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'database_operation',
      originalError: err.message,
    });
    return c.json(error, error.statusCode as 500);
  }

  if (err?.message?.includes('UNIQUE constraint failed')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'unique_constraint_violation',
      originalError: 'A record with this value already exists',
    });
    return c.json(error, 409);
  }

  if (err?.message?.includes('FOREIGN KEY constraint failed')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'foreign_key_violation',
      originalError: 'Referenced record does not exist',
    });
    return c.json(error, 400);
  }

  const isProduction = c.env.ENVIRONMENT === 'production';
  const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
    ...(!isProduction && {
      originalError: err.message,
      stack: err.stack,
    }),
  });
  return c.json(error, error.statusCode as 500);
};

export function createRouteErrorHandler(operation: string): ErrorHandler {
  return (err, c) => {
    console.error(`[${operation}] Error:`, err);

    if (isDomainError(err)) {
      return c.json(err, err.statusCode as 400 | 401 | 403 | 404 | 500);
    }

    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation,
      originalError: err.message,
    });
    return c.json(error, error.statusCode as 500);
  };
}

export function asyncHandler<T>(
  fn: (_c: Context, _next: () => Promise<void>) => Promise<T>,
): (_c: Context, _next: () => Promise<void>) => Promise<T> {
  return (c, next) => fn(c, next);
}

export default errorHandler;
