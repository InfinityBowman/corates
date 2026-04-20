/**
 * Base test fixture for e2e tests.
 *
 * Resets the database before each test so every test starts
 * from a clean slate. Import { test, expect } from this file
 * instead of @playwright/test.
 */

import { test as base, expect } from '@playwright/test';
import { BASE_URL } from './constants';

export const test = base.extend({
  page: async ({ page }, use) => {
    const res = await fetch(`${BASE_URL}/api/test/reset`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`DB reset failed: ${res.status} ${await res.text()}`);
    }
    await use(page);
  },
});

export { expect };
