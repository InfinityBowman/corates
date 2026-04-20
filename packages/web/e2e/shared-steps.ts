/**
 * Shared e2e workflow steps reused across checklist type tests
 */

import path from 'node:path';
import { expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAs, type DualReviewerScenario } from './helpers';

/** Click every radio on the AMSTAR2 checklist editor matching the given answer (e.g. "Yes", "No"). */
export async function answerAllAMSTAR2(page: Page, answer: 'Yes' | 'No' | 'Partial Yes') {
  const radios = page.getByRole('radio', { name: answer });
  const count = await radios.count();
  for (let i = 0; i < count; i++) {
    await radios.nth(i).click();
  }
  await page.waitForTimeout(1000);
}

/** Fill the ROB2 preliminary section: study design, aim, interventions, numerical result. */
export async function fillROB2Preliminary(
  page: Page,
  intervention: string,
  comparator: string,
  numericalResult = 'RR 1.5',
) {
  await page.getByText('Individually-randomized parallel-group trial').click();

  // Select aim BEFORE filling text fields to avoid the bug where aim
  // selection was overwriting Y.Text fields with empty values.
  const aimBtn = page.getByText('to assess the effect of assignment to intervention');
  await aimBtn.scrollIntoViewIfNeeded();
  await aimBtn.click();
  await page.waitForTimeout(500);

  await page.getByPlaceholder(/experimental intervention/i).fill(intervention);
  await page.getByPlaceholder(/comparator intervention/i).fill(comparator);
  await page.getByPlaceholder(/e\.g\. RR/i).fill(numericalResult);
  await page.waitForTimeout(500);
}

/** Answer every ROB2 domain signalling question with a given response (Y, N, PY, PN, NI). */
export async function answerAllROB2Domains(page: Page, answer: string) {
  for (const domain of ['D1', 'D2', 'D3', 'D4', 'D5']) {
    await page.getByRole('button', { name: domain, exact: true }).click();
    await page.waitForTimeout(500);

    const buttons = page.getByRole('button', { name: answer, exact: true });
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
  }
}

/**
 * Adds a member to the current project via the Invite UI on the Overview tab.
 * Assumes the page is already on the project page as an owner.
 */
export async function addProjectMemberViaUI(page: Page, memberName: string, memberEmail: string) {
  await page.getByRole('tab', { name: /Overview/i }).click();
  await page.getByRole('button', { name: /Invite/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  await dialog.getByPlaceholder('Type at least 2 characters...').fill(memberEmail);

  // Wait for search dropdown and click the matching user
  const searchResult = dialog.locator('button').filter({ hasText: memberName }).first();
  await expect(searchResult).toBeVisible({ timeout: 5_000 });
  await searchResult.click();

  // Click the footer "Add Member" button (not the dialog title)
  await dialog.getByRole('button', { name: 'Add Member', exact: true }).click();

  await expect(dialog).toBeHidden({ timeout: 5_000 });
}

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures');

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
 * Adds a study to the current project by uploading a PDF fixture.
 * No external API calls -- metadata is extracted locally from the PDF.
 */
export async function addStudyViaPdf(page: Page, fixture = 'Petrie2019.pdf') {
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await page.getByText('Add Studies to Your Project').click();

  // "Upload PDFs" tab is active by default
  const fileInput = page.locator('input[type="file"][accept*="pdf"]');
  await fileInput.setInputFiles(path.join(FIXTURES_DIR, fixture));

  // Wait for metadata extraction to finish and the study to appear in staged list
  await expect(page.getByRole('button', { name: /Add 1 Stud/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Add 1 Stud/i }).click();

  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 15_000 });
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
 * The dialog says "Mark Appraisal as Complete?" with a "Mark Complete" action button.
 */
export async function markChecklistComplete(page: Page) {
  // Click the header "Mark Complete" button
  await page.getByRole('button', { name: /Mark Complete/i }).click();

  // Wait for the confirmation dialog to appear
  await expect(page.getByText('Mark Appraisal as Complete?')).toBeVisible({ timeout: 5_000 });

  // Click the "Mark Complete" button inside the dialog
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: /Mark Complete/i }).click();

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
  await addProjectMemberViaUI(page, scenario.userB.name, scenario.userB.email);

  // Verify the member appears in the team list before continuing
  await expect(page.getByText(scenario.userB.name)).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(1000);

  await addStudyViaPdf(page);
  await assignReviewers(page);

  return projectId;
}
