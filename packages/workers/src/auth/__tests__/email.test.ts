/**
 * Provider order for outgoing mail: Cloudflare Email Sending first, Postmark
 * when Cloudflare fails for any reason other than a suppressed recipient.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmailService } from '../email';

const postmarkSend = vi.hoisted(() => vi.fn());
vi.mock('postmark', () => ({
  Client: class {
    sendEmail = postmarkSend;
  },
}));

const message = {
  to: 'reviewer@example.com',
  subject: 'Sign in',
  html: '<p>link</p>',
  text: 'link',
  replyTo: 'owner@example.com',
};

function cloudflareError(code: string) {
  return Object.assign(new Error(code), { code });
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ENVIRONMENT: 'production',
    EMAIL_FROM: 'noreply@corates.org',
    POSTMARK_SERVER_TOKEN: 'pm-token',
    EMAIL: { send: vi.fn().mockResolvedValue({ messageId: 'cf-1' }) },
    ...overrides,
  } as never;
}

beforeEach(() => {
  postmarkSend.mockReset().mockResolvedValue({ ErrorCode: 0, MessageID: 'pm-1' });
});

describe('createEmailService', () => {
  it('sends through Cloudflare and leaves Postmark alone', async () => {
    const env = makeEnv();
    const result = await createEmailService(env).sendEmail(message);

    expect(result).toEqual({ success: true, id: 'cf-1', provider: 'cloudflare' });
    expect((env as { EMAIL: { send: ReturnType<typeof vi.fn> } }).EMAIL.send).toHaveBeenCalledWith({
      from: { name: 'CoRATES', email: 'noreply@corates.org' },
      to: 'reviewer@example.com',
      subject: 'Sign in',
      html: '<p>link</p>',
      text: 'link',
      replyTo: 'owner@example.com',
    });
    expect(postmarkSend).not.toHaveBeenCalled();
  });

  it('falls back to Postmark when Cloudflare fails', async () => {
    const env = makeEnv({
      EMAIL: { send: vi.fn().mockRejectedValue(cloudflareError('E_INTERNAL_SERVER_ERROR')) },
    });
    const result = await createEmailService(env).sendEmail(message);

    expect(result).toEqual({ success: true, id: 'pm-1', provider: 'postmark' });
    expect(postmarkSend).toHaveBeenCalledWith(
      expect.objectContaining({ From: 'CoRATES <noreply@corates.org>', To: message.to }),
    );
  });

  it('treats a recipient Cloudflare suppressed as permanent without trying Postmark', async () => {
    const env = makeEnv({
      EMAIL: { send: vi.fn().mockRejectedValue(cloudflareError('E_RECIPIENT_SUPPRESSED')) },
    });
    const result = await createEmailService(env).sendEmail(message);

    expect(result).toMatchObject({ success: false, permanent: true, provider: 'cloudflare' });
    expect(postmarkSend).not.toHaveBeenCalled();
  });

  it('reports a retryable failure when both providers fail', async () => {
    postmarkSend.mockRejectedValue(Object.assign(new Error('timeout'), { code: 500 }));
    const env = makeEnv({
      EMAIL: { send: vi.fn().mockRejectedValue(cloudflareError('E_RATE_LIMIT_EXCEEDED')) },
    });
    const result = await createEmailService(env).sendEmail(message);

    expect(result).toMatchObject({ success: false, permanent: false, provider: 'postmark' });
  });

  it('keeps Postmark permanent codes when it is the provider that answers', async () => {
    postmarkSend.mockRejectedValue(Object.assign(new Error('inactive'), { code: 406 }));
    const result = await createEmailService(makeEnv({ EMAIL: undefined })).sendEmail(message);

    expect(result).toMatchObject({ success: false, permanent: true, provider: 'postmark' });
  });

  it('returns the Cloudflare failure when no Postmark token is set', async () => {
    const env = makeEnv({
      POSTMARK_SERVER_TOKEN: '',
      EMAIL: { send: vi.fn().mockRejectedValue(cloudflareError('E_DELIVERY_FAILED')) },
    });
    const result = await createEmailService(env).sendEmail(message);

    expect(result).toMatchObject({ success: false, permanent: false, provider: 'cloudflare' });
  });
});
