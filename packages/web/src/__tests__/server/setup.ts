import { vi } from 'vitest';

vi.mock('postmark', () => ({
  Client: class {
    constructor() {
      this.sendEmail = vi.fn(() => Promise.resolve({ Message: 'mock' }));
      this.sendEmailBatch = vi.fn(() => Promise.resolve({ Message: 'mock' }));
    }
    sendEmail() {
      return Promise.resolve({ Message: 'mock' });
    }
    sendEmailBatch() {
      return Promise.resolve({ Message: 'mock' });
    }
  },
}));

vi.mock('stripe', () => ({
  default: vi.fn(function () {
    return {
      checkout: {
        sessions: {
          create: vi.fn(() =>
            Promise.resolve({ id: 'cs_test', url: 'https://checkout.stripe.com/test' }),
          ),
        },
      },
      billingPortal: {
        sessions: {
          create: vi.fn(() => Promise.resolve({ url: 'https://billing.stripe.com/test' })),
        },
      },
      webhooks: {
        constructEventAsync: vi.fn(() =>
          Promise.resolve({ type: 'test.event', data: { object: {} } }),
        ),
      },
      subscriptions: {
        retrieve: vi.fn(() => Promise.resolve({ id: 'sub_test', status: 'active' })),
      },
    };
  }),
}));
