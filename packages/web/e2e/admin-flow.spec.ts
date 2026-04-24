/**
 * Admin flow e2e test
 *
 * Exercises the admin dashboard, user detail pages (loader pilot with
 * useSuspenseQuery), navigation between detail pages, and non-admin
 * access denial -- all in a single workflow.
 *
 * Requires:
 *   - Dev server running: pnpm --filter web dev (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  loginAs,
  seedAdminScenario,
  cleanupAdminScenario,
  type AdminScenario,
  type SessionCookie,
} from './helpers';

let scenario: AdminScenario;

test.beforeAll(async () => {
  scenario = await seedAdminScenario();
});

test.afterAll(async () => {
  await cleanupAdminScenario(scenario);
});

async function loginAndGoto(
  page: Page,
  context: BrowserContext,
  cookies: SessionCookie[],
  path: string,
) {
  await loginAs(context, cookies);
  await page.goto('/dashboard');
  await page.waitForTimeout(1500);
  await page.goto(path);
}

test('Admin dashboard, user detail (loader pilot), and access control', async ({
  page,
  context,
}) => {
  // ── Direct URL navigation to user detail (SSR loader path) ──
  // This hits the loader before hydration -- the primary thing the pilot validates.
  await loginAndGoto(
    page,
    context,
    scenario.adminCookies,
    `/admin/users/${scenario.regularUser.id}`,
  );

  await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(scenario.regularUser.name)).toBeVisible();
  await expect(page.getByText(scenario.regularUser.email)).toBeVisible();

  // Detail page sections all render (data came from useSuspenseQuery)
  await expect(page.getByRole('heading', { name: 'Linked Accounts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Organizations/ })).toBeVisible();
  await expect(page.getByText('Admin Test Org')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Active Sessions/ })).toBeVisible();

  // Action buttons present
  await expect(page.getByRole('button', { name: /Impersonate/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ban/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Delete/ })).toBeVisible();

  // Email-verified badge renders for seeded user
  await expect(page.getByText('Verified')).toBeVisible();

  // ── Back link navigates to dashboard ──
  await page.getByRole('link', { name: /Back to Admin Dashboard/ }).click();
  await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 10_000 });

  // ── Dashboard stats and user table ──
  await expect(page.getByText('Total Users')).toBeVisible();
  await expect(page.getByText('Active Sessions')).toBeVisible();
  await expect(page.getByText('New This Week')).toBeVisible();

  // ── Search for the regular user and navigate via click (client-side loader) ──
  const searchInput = page.getByPlaceholder('Search by name or email...');
  await searchInput.fill(scenario.regularUser.email);
  await expect(page.getByText(scenario.regularUser.name)).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: scenario.regularUser.name }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/users/${scenario.regularUser.id}`), {
    timeout: 10_000,
  });
  await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 10_000 });

  // ── Navigate to admin's own profile ──
  await page.getByRole('link', { name: /Back to Admin Dashboard/ }).click();
  await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 10_000 });

  await searchInput.fill(scenario.admin.email);
  await expect(page.getByRole('link', { name: scenario.admin.name })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('link', { name: scenario.admin.name }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/users/${scenario.admin.id}`), {
    timeout: 10_000,
  });
  await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(scenario.admin.email)).toBeVisible();

  // Admin user shows the Admin badge in the profile area
  await expect(page.getByRole('main').getByText('Admin', { exact: true })).toBeVisible();

  // ── Non-admin access control ──
  await context.clearCookies();
  await loginAndGoto(page, context, scenario.regularCookies, '/admin');

  // Admin layout redirects non-admins to /dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // API layer also blocks non-admin requests
  const res = await page.evaluate(async () => {
    const response = await fetch('/api/admin/stats', { credentials: 'include' });
    return { status: response.status };
  });
  expect(res.status).toBe(403);
});
