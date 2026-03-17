/**
 * Shared e2e workflow steps reused across checklist type tests
 */

import { expect, type Page, type BrowserContext } from '@playwright/test';
import {
  loginAs,
  addProjectMember,
  type DualReviewerScenario,
  type SessionCookie,
} from './helpers';

/**
 * Creates a project from the dashboard. Returns the projectId.
 * Handles both first-project and subsequent-project scenarios.
 */
export async function createProject(page: Page, name: string, description = ''): Promise<string> {
  // Try "Create First Project" first, fall back to header "New Project"
  const firstProjectBtn = page.getByRole('button', { name: /Create First Project/i });
  const headerNewBtn = page.locator('header').getByRole('button', { name: /New Project/i });

  if (await firstProjectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstProjectBtn.click();
  } else {
    await headerNewBtn.click();
  }

  await expect(page.getByText('Create a new project')).toBeVisible();
  await page.getByPlaceholder('My Systematic Review').fill(name);
  if (description) {
    await page.getByPlaceholder('What is this review about?').fill(description);
  }
  await page.getByRole('button', { name: 'Create Project' }).click();
  await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });

  const projectId = page.url().match(/\/projects\/([^/?]+)/)?.[1];
  if (!projectId) throw new Error('Could not extract projectId from URL');
  return projectId;
}

/**
 * Adds a study to the current project via PMID lookup.
 */
export async function addStudyViaPMID(page: Page, pmid = '32615397') {
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await page.getByText('Add Studies to Your Project').click();
  await page.getByText('DOI / PMID').click();
  await page.getByPlaceholder(/10\.1000/).fill(pmid);
  await page.getByRole('button', { name: /Look Up/i }).click();
  await expect(page.getByText(/Found references/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Add \d+ Stud/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 10_000 });
}

/**
 * Assigns reviewers to the first study in the All Studies tab.
 */
export async function assignReviewers(page: Page) {
  await page.locator('button:has(svg.lucide-ellipsis-vertical)').first().click();
  await page.getByRole('menuitem', { name: /Assign Reviewers/i }).click();
  await expect(page.getByRole('heading', { name: 'Assign Reviewers' })).toBeVisible({
    timeout: 5_000,
  });

  const dialog = page.getByRole('dialog');
  await dialog.getByText('Unassigned').first().click();
  await page.getByRole('option', { name: /Alice/i }).click();
  await dialog.getByText('Unassigned').first().click();
  await page.getByRole('option', { name: /Bob/i }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });
}

/**
 * Adds an outcome in the All Studies tab.
 */
export async function addOutcome(page: Page, name: string) {
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await page.getByText('Outcomes').click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Add/i }).last().click();
  await page.getByPlaceholder(/outcome/i).fill(name);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
}

/**
 * Marks the current checklist as complete and handles the confirmation dialog.
 */
export async function markChecklistComplete(page: Page) {
  await page.getByRole('button', { name: /Mark Complete/i }).click();
  await page.waitForTimeout(500);
  const confirmBtn = page.getByRole('button', { name: /Mark Complete/i }).last();
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForTimeout(2000);
}

/**
 * Sets up the full project scaffold: create project, add Bob, add study, assign reviewers.
 * Returns the projectId.
 */
export async function setupProjectWithStudy(
  context: BrowserContext,
  page: Page,
  scenario: DualReviewerScenario,
  projectName: string,
): Promise<string> {
  await loginAs(context, scenario.cookiesA);
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

  const projectId = await createProject(page, projectName);
  await addProjectMember(scenario.orgId, projectId, scenario.userB.id, scenario.cookiesA);
  await page.waitForTimeout(2000);

  await addStudyViaPMID(page);
  await assignReviewers(page);

  return projectId;
}
