import { describe, it, expect } from 'vitest';
import { fromCrossJSON, toCrossJSONAsync } from 'seroval';
import { defaultSerovalPlugins, makeSerovalPlugin } from '@tanstack/router-core';
import {
  DomainErrorException,
  isDomainError,
  createDomainError,
  AUTH_ERRORS,
} from '@corates/shared';
import { domainErrorAdapter } from '../domainErrorAdapter';

// Same plugin order Start uses for server function responses: adapters first, then its defaults
const plugins = [makeSerovalPlugin(domainErrorAdapter), ...defaultSerovalPlugins];

async function roundTrip(value: unknown, withPlugins = plugins): Promise<unknown> {
  const wire = JSON.stringify(
    await toCrossJSONAsync(value, { refs: new Map(), plugins: withPlugins }),
  );
  return fromCrossJSON(JSON.parse(wire), { plugins: withPlugins });
}

describe('domainErrorAdapter', () => {
  it('keeps the code and details of a thrown DomainErrorException across the wire', async () => {
    const thrown = new DomainErrorException(
      createDomainError(AUTH_ERRORS.PROVIDER_NOT_CONNECTED, { context: 'google_no_refresh_token' }),
    );

    const received = await roundTrip(thrown);

    expect(received).toBeInstanceOf(DomainErrorException);
    expect(isDomainError(received)).toBe(true);
    const error = received as DomainErrorException;
    expect(error.code).toBe(AUTH_ERRORS.PROVIDER_NOT_CONNECTED.code);
    expect(error.statusCode).toBe(thrown.statusCode);
    expect(error.details).toEqual({ context: 'google_no_refresh_token' });
    expect(error.message).toBe(thrown.message);
  });

  it('is needed because Start alone reduces the error to its message', async () => {
    const thrown = new DomainErrorException(createDomainError(AUTH_ERRORS.PROVIDER_NOT_CONNECTED));

    const received = await roundTrip(thrown, defaultSerovalPlugins);

    expect(received).toBeInstanceOf(Error);
    expect(received).not.toBeInstanceOf(DomainErrorException);
    expect(isDomainError(received)).toBe(false);
  });
});
