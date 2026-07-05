/**
 * Invitation flow e2e tests
 *
 * Covers the full lifecycle of project invitations through the emailed
 * /invite/$token link:
 *   1. New user: owner invites an unknown email -> invitee opens the invite
 *      link -> signs up via magic link -> completes profile -> invitation is
 *      auto-accepted -> invitee can open the project.
 *   2. Existing user: the invitee already has an account by the time they
 *      click the link -> signs in from the invite page -> returns to it ->
 *      accepts explicitly -> invitee can open the project.
 *
 * Requires:
 *   - Dev server running: pnpm --filter web dev (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page } from '@playwright/test';
import {
  getAuthUrl,
  signUpWithEmail,
  verifyEmail,
  cleanupByEmail,
  loginAs,
  seedDualReviewerScenario,
  cleanupScenario,
} from './helpers';
import { createProject } from './shared-steps';

const TEST_PREFIX = `invite-e2e-${Date.now()}`;

/**
 * Sends a project invitation to an email with no matching user via the
 * Overview tab Invite UI. Assumes the page is on the project page as owner.
 */
async function sendInvitationViaUI(page: Page, email: string) {
  await page.getByRole('tab', { name: /Overview/i }).click();
  await page.getByRole('button', { name: /Invite/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  await dialog.getByPlaceholder('Type at least 2 characters...').fill(email);

  // No matching user -> the modal offers to send an email invitation
  await expect(dialog.getByText('No user found. You can send an invitation to')).toBeVisible({
    timeout: 5_000,
  });
  await dialog.getByRole('button', { name: 'Send Invitation', exact: true }).click();

  await expect(dialog).toBeHidden({ timeout: 5_000 });
}

test.describe('Invitation flows', () => {
  test('new user accepts invitation via emailed link, signup, and onboarding', async ({
    browser,
  }) => {
    const ownerScenario = await seedDualReviewerScenario();
    const inviteeEmail = `${TEST_PREFIX}-new@test.corates.org`;

    try {
      // Owner creates a project and invites an email with no account
      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      await loginAs(ownerCtx, ownerScenario.cookiesA);
      await ownerPage.goto('/dashboard');
      await expect(ownerPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
      const projectId = await createProject(ownerPage, 'Invitation Flow Test');

      await sendInvitationViaUI(ownerPage, inviteeEmail);
      await ownerCtx.close();

      // The emailed link is captured by the DEV_MODE test hook
      const inviteUrl = await getAuthUrl(inviteeEmail, 'invitation');
      expect(inviteUrl).toContain('/invite/');

      // Invitee opens the link in a fresh browser (no auth state)
      const inviteeCtx = await browser.newContext();
      const p = await inviteeCtx.newPage();
      await p.goto(inviteUrl);

      await expect(p.getByRole('heading', { name: /You.re Invited/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(p.getByText('Invitation Flow Test')).toBeVisible();
      await expect(p.getByText(inviteeEmail)).toBeVisible();

      // Create an account via magic link signup
      await p.getByRole('button', { name: /Create Account & Accept/i }).click();
      await expect(p).toHaveURL(/\/signup/, { timeout: 10_000 });

      const emailInput = p.locator('#magic-link-email');
      await emailInput.click();
      await emailInput.pressSequentially(inviteeEmail, { delay: 20 });
      await p.getByRole('button', { name: /Continue with Email/i }).click();
      await expect(p.getByText('Check your email')).toBeVisible({ timeout: 10_000 });

      const magicLinkUrl = await getAuthUrl(inviteeEmail, 'magic-link');
      await p.goto(magicLinkUrl);
      await expect(p).toHaveURL(/\/complete-profile/, { timeout: 15_000 });

      // Complete onboarding
      const firstNameInput = p.locator('#first-name-input');
      await firstNameInput.click({ clickCount: 3 });
      await firstNameInput.pressSequentially('Invited', { delay: 20 });
      await p.locator('#last-name-input').click();
      await p.locator('#last-name-input').pressSequentially('User', { delay: 20 });
      await p.getByRole('button', { name: 'Next' }).click();

      await expect(p.getByRole('heading', { name: 'Institution Details' })).toBeVisible({
        timeout: 5_000,
      });
      await p.getByRole('button', { name: /Skip for now/i }).click();

      await expect(p.getByRole('heading', { name: /What best describes you/i })).toBeVisible({
        timeout: 5_000,
      });
      await p.getByText('Researcher').click();
      await p.getByRole('button', { name: /Finish Setup/i }).click();

      // Invitation is auto-accepted during onboarding
      await expect(p.getByText('Invitation Accepted')).toBeVisible({ timeout: 15_000 });
      await expect(p).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      // Membership is real: the project page syncs over WebSocket
      await p.goto(`/projects/${projectId}`);
      await expect(p.getByRole('tab', { name: /All Studies/i })).toBeVisible({ timeout: 15_000 });

      await inviteeCtx.close();
    } finally {
      await cleanupByEmail(inviteeEmail);
      await cleanupScenario(ownerScenario);
    }
  });

  test('existing user signs in from invite link and accepts explicitly', async ({ browser }) => {
    const ownerScenario = await seedDualReviewerScenario();
    const inviteeEmail = `${TEST_PREFIX}-existing@test.corates.org`;
    const inviteePassword = 'Password123!';

    try {
      // Owner creates a project and invites an email with no account (yet)
      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      await loginAs(ownerCtx, ownerScenario.cookiesA);
      await ownerPage.goto('/dashboard');
      await expect(ownerPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
      const projectId = await createProject(ownerPage, 'Invitation Existing User Test');

      await sendInvitationViaUI(ownerPage, inviteeEmail);
      await ownerCtx.close();

      const inviteUrl = await getAuthUrl(inviteeEmail, 'invitation');

      // The invitee signs up independently before clicking the link
      await signUpWithEmail(inviteeEmail, inviteePassword, 'Existing Invitee');
      await verifyEmail(inviteeEmail, true);

      // Invitee opens the invite link signed out
      const inviteeCtx = await browser.newContext();
      const p = await inviteeCtx.newPage();
      await p.goto(inviteUrl);

      await expect(p.getByRole('heading', { name: /You.re Invited/i })).toBeVisible({
        timeout: 15_000,
      });

      // Sign in with the existing account
      await p.getByRole('link', { name: 'Sign in' }).click();
      await expect(p).toHaveURL(/\/signin/, { timeout: 10_000 });

      await p.getByRole('tab', { name: 'Password' }).click();
      await p.locator('#email-input').fill(inviteeEmail);
      await p.locator('#password-input').fill(inviteePassword);
      await p.getByRole('button', { name: 'Sign In', exact: true }).click();

      // Sign-in returns to the invite page for explicit acceptance
      await expect(p).toHaveURL(/\/invite\//, { timeout: 15_000 });
      await expect(p.getByText(`Signed in as`)).toBeVisible({ timeout: 15_000 });
      await p.getByRole('button', { name: 'Accept Invitation', exact: true }).click();

      await expect(p.getByText('Invitation Accepted')).toBeVisible({ timeout: 15_000 });
      await expect(p).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      // Membership is real: the project page syncs over WebSocket
      await p.goto(`/projects/${projectId}`);
      await expect(p.getByRole('tab', { name: /All Studies/i })).toBeVisible({ timeout: 15_000 });

      await inviteeCtx.close();
    } finally {
      await cleanupByEmail(inviteeEmail);
      await cleanupScenario(ownerScenario);
    }
  });
});
