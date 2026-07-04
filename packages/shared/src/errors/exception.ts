/**
 * DomainErrorException - throwable Error carrying a DomainError payload
 *
 * Server functions must signal errors by throwing an actual Error instance.
 * TanStack Start only re-throws serialized errors on the client when the
 * deserialized value `instanceof Error` (see start-client-core serverFnFetcher).
 * A thrown `Response` (or a thrown plain DomainError object) is instead handed
 * back to the caller as resolved data, so `try/catch` never fires and the query
 * stores the error object as `data`. Wrapping the domain error in an Error
 * subclass makes seroval serialize it with the `x-tss-serialized` marker; its
 * own enumerable props (code, statusCode, details, timestamp) survive the round
 * trip, and the client re-throws a real Error that `isDomainError` recognizes.
 */

import type { DomainError, ErrorDetails, ErrorDefinition } from './types.js';
import { createDomainError } from './helpers.js';

export class DomainErrorException extends Error {
  readonly code: DomainError['code'];
  readonly statusCode: number;
  readonly details?: ErrorDetails;
  readonly timestamp: string;

  constructor(domainError: DomainError) {
    super(domainError.message);
    this.name = 'DomainErrorException';
    this.code = domainError.code;
    this.statusCode = domainError.statusCode;
    this.details = domainError.details;
    this.timestamp = domainError.timestamp ?? new Date().toISOString();
  }

  toDomainError(): DomainError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  /**
   * Serialize to an HTTP Response. For raw HTTP route handlers (not server
   * functions) that return the error directly to the client as an HTTP response.
   */
  toResponse(): Response {
    return Response.json(this.toDomainError(), { status: this.statusCode });
  }
}

/**
 * Build a DomainError and throw it as a DomainErrorException in one step.
 * Drop-in replacement for `throw Response.json(createDomainError(...), { status })`.
 */
export function throwDomainError(
  errorDef: ErrorDefinition,
  details?: ErrorDetails,
  messageOverride?: string,
): never {
  throw new DomainErrorException(createDomainError(errorDef, details, messageOverride));
}
