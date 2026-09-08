import { describe, it, expect } from 'vitest';
import { authFetch } from '../auth-client';

describe('authFetch', () => {
  it('maps a 429 from the auth limiter to SYSTEM_RATE_LIMITED', async () => {
    const call = Promise.resolve({
      data: null,
      error: { status: 429, message: 'Too many requests. Please try again later.' },
    });
    await expect(authFetch(call)).rejects.toMatchObject({
      code: 'SYSTEM_RATE_LIMITED',
      statusCode: 429,
    });
  });

  it('maps known Better Auth codes onto domain errors', async () => {
    const call = Promise.resolve({
      data: null,
      error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid' },
    });
    await expect(authFetch(call)).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });
});
