/**
 * Auth flow e2e tests
 *
 * Tests the authentication UI: protected route guards, sign-in, sign-up,
 * magic link, password reset, profile onboarding, and sign out.
 *
 * Requires:
 *   - Backend workers running: pnpm dev:workers (DEV_MODE=true)
 *   - Frontend dev server running: pnpm dev:front
 */

import { test, expect } from '@playwright/test';
import {
  getAuthUrl,
  signUpWithEmail,
  verifyEmail,
  cleanupByEmail,
  loginAs,
  seedDualReviewerScenario,
  cleanupScenario,
  type DualReviewerScenario,
} from './helpers';

const TEST_PREFIX = `auth-e2e-${Date.now()}`;

test.describe('Auth flows', () => {
  test('protected route redirects to signin when unauthenticated', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10_000 });
  });

  test.describe('magic link sign-up + profile onboarding', () => {
    const email = `${TEST_PREFIX}-magic@test.corates.org`;

    test.afterAll(async () => {
      await cleanupByEmail(email);
    });

    test('sign up via magic link and complete profile', async ({ page }) => {
      // Navigate to sign-up page
      await page.goto('/signup');
      await expect(page.getByText('Create an Account')).toBeVisible({ timeout: 10_000 });

      // Fill magic link form and submit
      const emailInput = page.locator('#magic-link-email');
      await emailInput.click();
      await emailInput.fill(email);
      await expect(emailInput).toHaveValue(email);
      await page.getByRole('button', { name: /Continue with Email/i }).click();

      // Verify "check your email" state appears
      await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(email)).toBeVisible();

      // Grab the magic link URL from the backend
      const magicLinkUrl = await getAuthUrl(email, 'magic-link');
      expect(magicLinkUrl).toBeTruthy();

      // Navigate to the magic link URL (backend creates session, redirects)
      await page.goto(magicLinkUrl);

      // Should arrive at complete-profile (new user, no profile yet)
      await expect(page).toHaveURL(/\/complete-profile/, { timeout: 15_000 });
      await expect(page.getByText('Complete Your Profile')).toBeVisible({ timeout: 10_000 });

      // Step 1: Name (first name may be auto-filled with email from pendingName)
      await page.locator('#first-name-input').clear();
      await page.locator('#first-name-input').fill('Test');
      await page.locator('#last-name-input').fill('User');
      await page.getByRole('button', { name: 'Next' }).click();

      // Step 2: Institution - skip
      await expect(page.getByRole('heading', { name: 'Institution Details' })).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: /Skip for now/i }).click();

      // Step 3: Role - select Researcher
      await expect(page.getByRole('heading', { name: /What best describes you/i })).toBeVisible({ timeout: 5_000 });
      await page.getByText('Researcher').click();
      await page.getByRole('button', { name: /Finish Setup/i }).click();

      // Should arrive at dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    });
  });

  test.describe('email/password sign-in and password reset', () => {
    const email = `${TEST_PREFIX}-password@test.corates.org`;
    const password = 'TestPass123!';
    const newPassword = 'NewPass456!';

    test.afterAll(async () => {
      await cleanupByEmail(email);
    });

    test('sign in with email and password', async ({ page }) => {
      // Create user via Better Auth API
      await signUpWithEmail(email, password, 'Password User');

      // Skip email verification and profile via test endpoint
      await verifyEmail(email, true);

      // Navigate to sign-in page
      await page.goto('/signin');
      await expect(page.getByText('Welcome Back')).toBeVisible({ timeout: 10_000 });

      // Fill the password form (default active tab)
      await page.locator('#email-input').fill(email);
      await page.locator('#password-input').fill(password);
      await page.getByRole('button', { name: /^Sign In$/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    });

    test('reset password and sign in with new password', async ({ page, context }) => {
      // Clear session from previous test
      await context.clearCookies();

      // Navigate to reset password page
      await page.goto('/reset-password');
      await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible({ timeout: 10_000 });

      // Request password reset
      await page.locator('#email-input').fill(email);
      await page.getByRole('button', { name: /Send Reset Email/i }).click();

      // Verify success message
      await expect(page.getByText('Reset Email Sent!')).toBeVisible({ timeout: 10_000 });

      // Grab the reset URL from backend
      const resetUrl = await getAuthUrl(email, 'reset-password');
      expect(resetUrl).toBeTruthy();

      // Extract token from the URL (format: {baseURL}/reset-password/{token}?callbackURL=...)
      const urlObj = new URL(resetUrl);
      const pathParts = urlObj.pathname.split('/');
      const token = pathParts[pathParts.length - 1];

      // Navigate to the frontend reset page with the token
      await page.goto(`/reset-password?token=${token}`);
      await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible({ timeout: 10_000 });

      // Fill and submit new password
      await page.locator('#new-password-input').fill(newPassword);
      await page.locator('#confirm-password-input').fill(newPassword);
      await page.getByRole('button', { name: /Set Password/i }).click();

      // Verify success
      await expect(page.getByText('Password Reset Successfully!')).toBeVisible({ timeout: 10_000 });

      // Wait for auto-redirect to signin, then sign in with new password
      await expect(page).toHaveURL(/\/signin/, { timeout: 10_000 });
      await page.locator('#email-input').fill(email);
      await page.locator('#password-input').fill(newPassword);
      await page.getByRole('button', { name: /^Sign In$/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    });
  });
});
