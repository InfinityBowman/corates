import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { resetTestDatabase } from '../../__tests__/helpers';
import { createAuth } from '../config';
import type { Env } from '../../types';

// Better Auth compares the drizzle schema with every enabled plugin's tables on
// the first request and rejects all auth traffic on a mismatch. The test vars
// leave the env-gated plugins off, so enable them here with placeholder
// credentials; none of them talk to their provider on this path.
describe('auth schema check', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('accepts the drizzle schema with every plugin enabled', async () => {
    const auth = createAuth({
      ...env,
      AUTH_SECRET: 'test-secret-that-is-long-enough',
      STRIPE_SECRET_KEY: 'sk_test_schema_check',
      STRIPE_WEBHOOK_SECRET_AUTH: 'whsec_schema_check',
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      ORCID_CLIENT_ID: 'orcid-client-id',
      ORCID_CLIENT_SECRET: 'orcid-client-secret',
    } as Env);

    const res = await auth.handler(new Request('http://localhost:8787/api/auth/ok'));
    expect(res.status).toBe(200);
  });
});
