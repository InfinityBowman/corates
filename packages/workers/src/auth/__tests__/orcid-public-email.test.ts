import { describe, it, expect } from 'vitest';
import { fetchOrcidPublicEmail } from '../orcid-public-email';

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
}

describe('fetchOrcidPublicEmail', () => {
  it('prefers the primary verified address', async () => {
    const email = await fetchOrcidPublicEmail(
      '0000-0001',
      'tok',
      fakeFetch({
        email: [
          { email: 'Second@Example.org', verified: true, primary: false },
          { email: 'first@example.org', verified: true, primary: true },
        ],
      }),
    );
    expect(email).toBe('first@example.org');
  });

  it('ignores unverified addresses', async () => {
    const email = await fetchOrcidPublicEmail(
      '0000-0001',
      'tok',
      fakeFetch({ email: [{ email: 'nope@example.org', verified: false, primary: true }] }),
    );
    expect(email).toBeNull();
  });

  it('returns null on API failure', async () => {
    expect(await fetchOrcidPublicEmail('0000-0001', 'tok', fakeFetch({}, false))).toBeNull();
    const throwing = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await fetchOrcidPublicEmail('0000-0001', 'tok', throwing)).toBeNull();
  });
});
