import { createSerializationAdapter } from '@tanstack/react-router';
import { DomainErrorException, type DomainError } from '@corates/shared';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

// Error details are typed as open records of unknown, which Start's
// serializability check rejects, but they only ever carry JSON values
type WireDomainError = Omit<DomainError, 'details'> & {
  details?: { [key: string]: Json | undefined };
};

// Start's built-in error plugin serializes only `message`, so without this a
// thrown DomainErrorException reaches the browser as a bare Error with no code
export const domainErrorAdapter = createSerializationAdapter({
  key: 'DomainErrorException',
  test: (value): value is DomainErrorException => value instanceof DomainErrorException,
  toSerializable: error => error.toDomainError() as WireDomainError,
  fromSerializable: (wire: WireDomainError) => new DomainErrorException(wire as DomainError),
});
