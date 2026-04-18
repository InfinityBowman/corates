/**
 * Billing flow e2e tests
 *
 * Tests the end-to-end billing experience: checkout redirect handling
 * and payment failure states.
 *
 * Requires:
 *   - Dev server running: pnpm --filter web dev (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  seedBillingScenario,
  cleanupBillingScenario,
  updateSubscription,
  loginWithApiCookies,
  type BillingScenario,
  type SessionCookie,
} from './helpers';

async function gotoBilling(
  page: Page,
  context: BrowserContext,
  cookies: SessionCookie[],
  query = '',
) {
  await loginWithApiCookies(context, page, cookies);
  await page.goto('/dashboard');
  await page.waitForTimeout(1500);
  await page.goto(`/settings/billing${query}`);
}

test.describe('Billing flows', () => {
  test.describe('checkout flow', () => {
    let scenario: BillingScenario;

    test.beforeAll(async () => {
      scenario = await seedBillingScenario({ plan: 'starter_team', status: 'active' });
    });

    test.afterAll(async () => {
      await cleanupBillingScenario(scenario);
    });

    test('cancel checkout, complete checkout, then upgrade plan', async ({ page, context }) => {
      // User cancels checkout at Stripe and returns
      await gotoBilling(page, context, scenario.cookies, '?canceled=true');
      await expect(page.getByText('Checkout canceled')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('No changes were made to your subscription.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Starter Team' })).toBeVisible();

      // User tries again and completes checkout
      await page.goto('/settings/billing?success=true');
      await expect(page.getByText('Payment successful!')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Your subscription has been activated.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Starter Team' })).toBeVisible();

      // Later, user upgrades to Team plan
      await updateSubscription(scenario.orgId, { plan: 'team' });
      await page.goto('/settings/billing?success=true');
      await expect(page.getByText('Payment successful!')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    });
  });

  test.describe('payment failure', () => {
    let scenario: BillingScenario;

    test.beforeAll(async () => {
      scenario = await seedBillingScenario({ plan: 'starter_team', status: 'past_due' });
    });

    test.afterAll(async () => {
      await cleanupBillingScenario(scenario);
    });

    test('shows payment failed banner with update button', async ({ page, context }) => {
      await gotoBilling(page, context, scenario.cookies);

      await expect(page.getByText('Payment Failed', { exact: true }).first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('button', { name: 'Update Payment Method' })).toBeVisible();
      await expect(page.getByText('Past Due')).toBeVisible();
    });
  });
});
