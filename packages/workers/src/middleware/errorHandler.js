/**
 * Centralized error handler middleware for Hono routes
 *
 * This middleware provides consistent error handling across all routes.
 * Routes can simply throw errors and this middleware will convert them
 * to proper JSON responses with the correct status codes.
 *
 * Usage:
 * 1. Import and apply to routes: app.onError(errorHandler)
 * 2. In route handlers, throw errors instead of try-catch:
 *    throw createDomainError(ERRORS.NOT_FOUND, { id })
 *
 * Benefits:
 * - Consistent error response format
 * - Centralized logging
 * - Reduces boilerplate in route handlers
 * - Properly handles domain errors vs unexpected errors
 */

import { createDomainError, SYSTEM_ERRORS, isDomainError } from '@corates/shared';

/**
 * Check if an error is a Zod validation error
 */
function isZodError(error) {
  return error?.name === 'ZodError' || Array.isArray(error?.errors);
}

/**
 * Format Zod validation errors into a readable message
 */
function formatZodErrors(error) {
  if (!error?.errors) return 'Validation failed';
  return error.errors
    .map(e => {
      const path = e.path?.join('.') || 'input';
      return `${path}: ${e.message}`;
    })
    .join('; ');
}

/**
 * Global error handler for Hono applications
 *
 * This handler processes all uncaught errors in route handlers and
 * returns appropriate JSON responses.
 *
 * @param {Error} err - The error that was thrown
 * @param {import('hono').Context} c - The Hono context
 * @returns {Response} JSON error response
 */
export function errorHandler(err, c) {
  // Log all errors for debugging
  console.error(`[${c.req.method}] ${c.req.path}:`, err);

  // Handle domain errors (our custom error format)
  if (isDomainError(err)) {
    return c.json(err, err.statusCode);
  }

  // Handle Zod validation errors
  if (isZodError(err)) {
    const error = createDomainError(SYSTEM_ERRORS.VALIDATION_ERROR, {
      validationErrors: err.errors,
      message: formatZodErrors(err),
    });
    return c.json(error, error.statusCode);
  }

  // Handle HTTPException from Hono
  if (err?.getResponse) {
    return err.getResponse();
  }

  // Handle database errors (D1 specific patterns)
  if (err?.message?.includes('D1_')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'database_operation',
      originalError: err.message,
    });
    return c.json(error, error.statusCode);
  }

  // Handle unique constraint violations (common in D1)
  if (err?.message?.includes('UNIQUE constraint failed')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'unique_constraint_violation',
      originalError: 'A record with this value already exists',
    });
    return c.json(error, 409); // Conflict
  }

  // Handle foreign key violations
  if (err?.message?.includes('FOREIGN KEY constraint failed')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'foreign_key_violation',
      originalError: 'Referenced record does not exist',
    });
    return c.json(error, 400);
  }

  // Handle all other unexpected errors
  const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
    // Only include error message in non-production for security
    ...(process.env.ENVIRONMENT !== 'production' && {
      originalError: err.message,
      stack: err.stack,
    }),
  });
  return c.json(error, error.statusCode);
}

/**
 * Create a route-specific error handler that includes context
 *
 * @param {string} operation - The operation name for logging
 * @returns {Function} Error handler function
 */
export function createRouteErrorHandler(operation) {
  return (err, c) => {
    console.error(`[${operation}] Error:`, err);

    if (isDomainError(err)) {
      return c.json(err, err.statusCode);
    }

    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation,
      originalError: err.message,
    });
    return c.json(error, error.statusCode);
  };
}

/**
 * Async wrapper that catches errors and passes them to the error handler
 *
 * Usage:
 * app.get('/route', asyncHandler(async (c) => {
 *   // Your async code here - errors will be caught automatically
 *   const data = await doSomething();
 *   return c.json(data);
 * }));
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped handler that catches errors
 */
export function asyncHandler(fn) {
  return (c, next) => fn(c, next);
}

export default errorHandler;
