/**
 * Invitation flow e2e tests
 *
 * Covers the full lifecycle of project invitations through the emailed
 * /invite/$token link:
 *   1. New user: owner invites an unknown email -> invitee opens the invite
 *      link -> signs up via email code -> completes profile -> invitation is
 *      auto-accepted -> invitee can open the project.
 *   2. Existing user: the invitee already has an account by the time they
 *      click the link -> signs in from the invite page -> returns to it ->
 *      accepts explicitly -> invitee can open the project.
 *   3. Invite anchoring: the invitation was sent to one address but the
 *      invitee's account uses a different email -> accepting still works and
 *      membership binds to the signed-in account.
 *
 * Requires:
 *   - Dev server running: pnpm --filter web dev (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page } from './test';
import {
  getAuthUrl,
  submitEmailCodeSignIn,
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
  // The editable project title is also a button, so match the label exactly
  await page.getByRole('button', { name: 'Invite', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  await dialog.getByPlaceholder('Type at least 2 characters...').fill(email);

  // No matching user -> the modal offers to send an email invitation
  await expect(dialog.getByText('No user found. You can send an invitation to')).toBeVisible({
    timeout: 5_000,
  });
  await dialog.getByRole('button', { name: 'Send invitation', exact: true }).click();

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

      // Create an account via email code signup
      await p.getByRole('button', { name: /Create account and join/i }).click();
      await expect(p).toHaveURL(/\/signup/, { timeout: 10_000 });

      await submitEmailCodeSignIn(p, inviteeEmail);
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
      await expect(p.getByText('Invitation accepted')).toBeVisible({ timeout: 15_000 });
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

      // The account was created after the invite was sent, so no notification
      // exists; the invitation must still appear as a ghost card in the projects grid
      await p.goto('/dashboard');
      const ghostCard = p.getByTestId('invitation-card');
      await expect(ghostCard.getByText('Invitation Existing User Test')).toBeVisible({
        timeout: 15_000,
      });
      await ghostCard.getByRole('button', { name: 'Accept' }).click();

      await expect(p.getByText('Invitation accepted')).toBeVisible({ timeout: 15_000 });
      await expect(ghostCard).toBeHidden({ timeout: 15_000 });

      // Membership is real: the project page syncs over WebSocket
      await p.goto(`/projects/${projectId}`);
      await expect(p.getByRole('tab', { name: /All Studies/i })).toBeVisible({ timeout: 15_000 });

      await inviteeCtx.close();

      // The owner, still on the project page, is told live that the invitee joined
      const badge = ownerPage.getByTestId('notification-badge');
      await expect(badge).toHaveText('1', { timeout: 15_000 });
      await ownerPage.getByRole('button', { name: /^Notifications/ }).click();
      await expect(
        ownerPage.getByRole('button', {
          name: /Invitation Existing User Test.*joined the project/,
        }),
      ).toBeVisible({ timeout: 10_000 });
      await ownerPage.getByRole('button', { name: 'Mark all as read' }).click();
      await expect(badge).toBeHidden({ timeout: 10_000 });
      await ownerCtx.close();
    } finally {
      await cleanupByEmail(inviteeEmail);
      await cleanupScenario(ownerScenario);
    }
  });

  test('invitation can be accepted by an account with a different email', async ({ browser }) => {
    const ownerScenario = await seedDualReviewerScenario();
    // The classic duplicate-account trap: invited at the institutional alias,
    // but the invitee's account lives under a different address.
    const invitedEmail = `${TEST_PREFIX}-alias@test.corates.org`;
    const accountEmail = `${TEST_PREFIX}-canonical@test.corates.org`;
    const inviteePassword = 'Password123!';

    try {
      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      await loginAs(ownerCtx, ownerScenario.cookiesA);
      await ownerPage.goto('/dashboard');
      await expect(ownerPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
      const projectId = await createProject(ownerPage, 'Invite Anchoring Test');

      await sendInvitationViaUI(ownerPage, invitedEmail);
      await ownerCtx.close();

      const inviteUrl = await getAuthUrl(invitedEmail, 'invitation');

      // The invitee's account exists under a different email
      await signUpWithEmail(accountEmail, inviteePassword, 'Canonical Invitee');
      await verifyEmail(accountEmail, true);

      const inviteeCtx = await browser.newContext();
      const p = await inviteeCtx.newPage();
      await p.goto(inviteUrl);

      await expect(p.getByRole('heading', { name: /You.re Invited/i })).toBeVisible({
        timeout: 15_000,
      });

      await p.getByRole('link', { name: 'Sign in' }).click();
      await expect(p).toHaveURL(/\/signin/, { timeout: 10_000 });

      await p.getByRole('tab', { name: 'Password' }).click();
      await p.locator('#email-input').fill(accountEmail);
      await p.locator('#password-input').fill(inviteePassword);
      await p.getByRole('button', { name: 'Sign In', exact: true }).click();

      await expect(p).toHaveURL(/\/invite\//, { timeout: 15_000 });
      await expect(p.getByText(`Signed in as`)).toBeVisible({ timeout: 15_000 });
      await p.getByRole('button', { name: 'Accept invitation', exact: true }).click();

      // Membership binds to the signed-in account despite the email mismatch
      await expect(p.getByText('Invitation accepted')).toBeVisible({ timeout: 15_000 });
      await expect(p).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      await p.goto(`/projects/${projectId}`);
      await expect(p.getByRole('tab', { name: /All Studies/i })).toBeVisible({ timeout: 15_000 });

      await inviteeCtx.close();
    } finally {
      await cleanupByEmail(accountEmail);
      await cleanupByEmail(invitedEmail);
      await cleanupScenario(ownerScenario);
    }
  });
});
