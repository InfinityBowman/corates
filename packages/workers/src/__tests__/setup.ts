/**
 * Global test setup file
 * This file runs before all tests to configure the test environment
 */

import { vi } from 'vitest';

// Mock postmark globally to avoid loading runtime code that may include
// unhandled syntax in the test environment. All tests need this mock.
vi.mock('postmark', () => {
  return {
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
  };
});

// Mock Stripe globally (tests can override with specific mocks if needed)
// Must use `function` (not arrow) so `new Stripe(...)` works -- arrow functions
// lack [[Construct]] and throw "is not a constructor".
vi.mock('stripe', () => {
  return {
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
  };
});
