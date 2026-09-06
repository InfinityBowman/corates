/**
 * Playwright `test` with the harness diagnostics attached to the default
 * browser context. Specs import `test` and `expect` from here instead of
 * `@playwright/test`. Contexts a spec creates itself get the same treatment
 * through `loginAs`.
 */

import { test as base } from '@playwright/test';
import { attachDiagnostics } from './helpers';

export * from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    attachDiagnostics(context);
    await use(context);
  },
});
