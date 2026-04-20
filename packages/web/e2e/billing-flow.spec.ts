/**
 * Billing flow e2e tests
 *
 * Full round-trip through real Stripe Checkout in test mode.
 * User signs up, navigates to plans, goes through Stripe Checkout with a
 * test card, Stripe sends the webhook, and the subscription appears in the UI.
 *
 * Requires:
 *   - Dev server running: pnpm --filter web dev (localhost:3010, DEV_MODE=true)
 *   - Stripe CLI forwarding webhooks:
 *     stripe listen --forward-to localhost:3010/api/auth/stripe/webhook
 *   - Stripe test mode keys configured in .env (run pnpm stripe:setup)
 */

import { test, expect, type Page } from '@playwright/test';
import { getAuthUrl, cleanupByEmail } from './helpers';
import { BASE_URL } from './constants';

const TEST_PREFIX = `e2e-billing-${Date.now()}`;
const TEST_EMAIL = `${TEST_PREFIX}@test.corates.org`;

const STRIPE_TEST_CARD = '4242424242424242';
const STRIPE_TEST_EXPIRY = '12/30';
const STRIPE_TEST_CVC = '123';
const STRIPE_TEST_ZIP = '90210';
const STRIPE_TEST_CARDHOLDER = 'Test User';

async function signUpViaUI(page: Page) {
  await page.goto('/signup');
  await expect(page.getByText('Create an Account')).toBeVisible({ timeout: 10_000 });

  const emailInput = page.locator('#magic-link-email');
  await emailInput.click();
  await emailInput.pressSequentially(TEST_EMAIL, { delay: 20 });
  await page.getByRole('button', { name: /Continue with Email/i }).click();

  await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10_000 });

  const magicLinkUrl = await getAuthUrl(TEST_EMAIL, 'magic-link');
  await page.goto(magicLinkUrl);
  await page.waitForURL(/\/(dashboard|complete-profile)/, { timeout: 15_000 });

  if (page.url().includes('complete-profile')) {
    const firstNameInput = page.locator('#first-name-input');
    await firstNameInput.click({ clickCount: 3 });
    await firstNameInput.pressSequentially('Billing', { delay: 20 });
    await page.locator('#last-name-input').click();
    await page.locator('#last-name-input').pressSequentially('Tester', { delay: 20 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Skip institution step
    await page.getByRole('button', { name: /Skip for now/i }).click();

    // Step 3: Role selection
    await expect(page.getByText('What best describes you?')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Researcher').click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  }
}

async function fillStripeCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

  // Expand the Card payment method accordion
  await page.locator('#payment-method-accordion-item-title-card').click({ force: true });
  await page.waitForTimeout(1_000);

  // Uncheck "Save my information" to dismiss the phone number field
  const saveCheckbox = page.locator('text=Save my information for faster checkout');
  if (await saveCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await saveCheckbox.click();
    await page.waitForTimeout(500);
  }

  // Wait for card fields to appear
  const cardInput = page.getByPlaceholder('1234 1234 1234 1234');
  await cardInput.waitFor({ timeout: 10_000 });

  await cardInput.fill(STRIPE_TEST_CARD);
  await page.getByPlaceholder('MM / YY').fill(STRIPE_TEST_EXPIRY);
  await page.getByPlaceholder('CVC').fill(STRIPE_TEST_CVC);
  await page.getByPlaceholder('Full name on card').fill(STRIPE_TEST_CARDHOLDER);
  await page.getByPlaceholder('ZIP').fill(STRIPE_TEST_ZIP);

  await page.getByRole('button', { name: /Subscribe/i }).click();

  await page.waitForURL(url => url.origin === new URL(BASE_URL).origin, {
    timeout: 60_000,
  });
}

async function clickPlanButton(page: Page, planName: string) {
  await page.goto('/settings/plans');
  const heading = page.getByRole('heading', { name: planName, exact: true });
  await expect(heading).toBeVisible({ timeout: 10_000 });

  // Each plan card is a div.rounded-2xl containing the heading and a button.
  // Use xpath to find the closest card ancestor.
  const card = page.locator(`xpath=//h3[text()="${planName}"]/ancestor::div[contains(@class,"rounded-2xl")][1]`);
  await card.getByRole('button', { name: /Get Started|Upgrade Now/i }).click();
}

test.describe('Billing flows', () => {
  test.afterAll(async () => {
    await cleanupByEmail(TEST_EMAIL);
  });

  test('cancel checkout, complete checkout, then upgrade plan', async ({ page }) => {
    await signUpViaUI(page);

    // --- Cancel checkout ---
    await clickPlanButton(page, 'Starter Team');
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

    // Click the back arrow on Stripe Checkout to cancel
    await page.locator('header a').first().click();

    // Should be back on billing page with canceled banner
    await page.waitForURL(url => url.origin === new URL(BASE_URL).origin, {
      timeout: 30_000,
    });
    await expect(page.getByText('Checkout canceled')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No changes were made to your subscription.')).toBeVisible();

    // --- Complete checkout ---
    await clickPlanButton(page, 'Starter Team');
    await fillStripeCheckout(page);

    await expect(page.getByText('Payment successful!')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Your subscription has been activated.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Starter Team' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Active')).toBeVisible();

    // --- Upgrade to Team ---
    await clickPlanButton(page, 'Team');

    // Upgrade uses Stripe's confirmation page (card already on file)
    await page.waitForURL(/checkout\.stripe\.com|billing\.stripe\.com/, { timeout: 30_000 });
    await page.getByRole('button', { name: /Confirm/i }).click();
    await page.waitForURL(url => url.origin === new URL(BASE_URL).origin, {
      timeout: 60_000,
    });

    await expect(page.getByText('Payment successful!')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Active')).toBeVisible();
  });
});
