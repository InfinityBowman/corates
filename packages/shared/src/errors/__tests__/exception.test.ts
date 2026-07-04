import { describe, it, expect } from 'vitest';
import { DomainErrorException, throwDomainError } from '../exception.js';
import { createDomainError } from '../helpers.js';
import { isDomainError } from '../normalize.js';
import { AUTH_ERRORS } from '../domains/domain.js';

describe('DomainErrorException', () => {
  it('is a real Error carrying the domain error fields', () => {
    const de = createDomainError(AUTH_ERRORS.REQUIRED);
    const ex = new DomainErrorException(de);

    expect(ex).toBeInstanceOf(Error);
    expect(ex.name).toBe('DomainErrorException');
    expect(ex.code).toBe(de.code);
    expect(ex.statusCode).toBe(de.statusCode);
    expect(ex.message).toBe(de.message);
  });

  it('is recognized by isDomainError (so handleError treats it as a domain error)', () => {
    const ex = new DomainErrorException(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'x' }));
    expect(isDomainError(ex)).toBe(true);
  });

  it('exposes code/statusCode/details/timestamp as own enumerable props (seroval round-trips these)', () => {
    const ex = new DomainErrorException(createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'y' }));
    const ownProps = Object.getOwnPropertyNames(ex);
    expect(ownProps).toEqual(expect.arrayContaining(['code', 'statusCode', 'details', 'timestamp']));
    expect(ex.details).toEqual({ reason: 'y' });
  });

  it('round-trips back to a plain DomainError', () => {
    const de = createDomainError(AUTH_ERRORS.REQUIRED);
    const restored = new DomainErrorException(de).toDomainError();
    expect(restored.code).toBe(de.code);
    expect(restored.statusCode).toBe(de.statusCode);
    expect(isDomainError(restored)).toBe(true);
  });

  it('throwDomainError throws a DomainErrorException', () => {
    expect(() => throwDomainError(AUTH_ERRORS.REQUIRED)).toThrow(DomainErrorException);
    try {
      throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' });
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as DomainErrorException).code).toBe(AUTH_ERRORS.FORBIDDEN.code);
    }
  });
});
