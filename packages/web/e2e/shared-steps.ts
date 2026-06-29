/**
 * Shared e2e workflow steps reused across checklist type tests
 */

import path from 'node:path';
import { expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAs, type DualReviewerScenario } from './helpers';

/** Click every radio on the AMSTAR2 checklist editor matching the given answer (e.g. "Yes", "No"). */
export async function answerAllAMSTAR2(page: Page, answer: 'Yes' | 'No' | 'Partial Yes') {
  const radios = page.getByRole('radio', { name: answer });
  // Form renders async after the loading gate clears; wait for radios to appear.
  await expect(radios.first()).toBeVisible({ timeout: 10_000 });
  const count = await radios.count();
  for (let i = 0; i < count; i++) {
    await radios.nth(i).click();
    await expect(radios.nth(i)).toBeChecked({ timeout: 5_000 });
  }
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
}

/** Answer every ROB2 domain signalling question with a given response (Y, N, PY, PN, NI). */
export async function answerAllROB2Domains(page: Page, answer: string) {
  for (const domain of ['D1', 'D2', 'D3', 'D4', 'D5']) {
    await page.getByRole('button', { name: domain, exact: true }).click();
    await expect(page.getByRole('button', { name: answer, exact: true }).first()).toBeVisible({
      timeout: 5_000,
    });

    const buttons = page.getByRole('button', { name: answer, exact: true });
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      await page.waitForTimeout(50);
    }
  }
}

/**
 * Answer the ROBINS-I Section B screening questions (b1-b3) with a given response.
 *
 * Section B renders radio-style labels (hidden input + visible label, e.g. "N (No)"),
 * NOT the toggle buttons used by domain signalling questions. Answering b2/b3 as Y/PY
 * triggers "stop assessment" and hides all domain sections, so callers pass 'N' to
 * proceed into domain assessment. The hidden radios carry name="sectionB-...", which
 * uniquely scopes them to Section B.
 */
export async function answerROBINSISectionB(page: Page, answer: 'Y' | 'PY' | 'PN' | 'N') {
  const labels = page.locator(`label:has(input[name^="sectionB"][value="${answer}"])`);
  await expect(labels.first()).toBeVisible({ timeout: 5_000 });
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    await labels.nth(i).click();
    await page.waitForTimeout(50);
  }
}

// Definite signalling answers, in preference order. Reviewer A leans Yes, reviewer B
// leans No. Every ROBINS-I response scale contains at least one code from each list,
// so both reviewers always land a definite answer (never "No Information"/"Not
// Applicable", which would leave a domain unscored) and always disagree, producing
// reconciliation conflicts on every question.
const ROBINSI_YES_CODES = ['Y', 'SY', 'WY', 'PY'];
const ROBINSI_NO_CODES = ['N', 'SN', 'WN', 'PN'];

/**
 * Answer every ROBINS-I domain signalling question with a definite response.
 *
 * Clicks each domain pill in the sticky scoring summary (expands + scrolls the domain),
 * then answers that domain's questions scoped to its container so answers never leak
 * between domains. Assumes the default ITT (not per-protocol) domain set: D1 = domain1a,
 * D2-D6. Section B must be answered first so domains are visible.
 *
 * Each signalling question renders its option buttons in a `shrink-0 flex-wrap` group,
 * which is unique to signalling questions (judgement/direction buttons use other layouts),
 * so iterating those groups yields exactly one answer per question.
 */
export async function answerAllROBINSIDomains(page: Page, reviewer: 'A' | 'B') {
  const preferred = reviewer === 'A' ? ROBINSI_YES_CODES : ROBINSI_NO_CODES;
  const domains: Array<{ pill: string; key: string }> = [
    { pill: 'D1', key: 'domain1a' },
    { pill: 'D2', key: 'domain2' },
    { pill: 'D3', key: 'domain3' },
    { pill: 'D4', key: 'domain4' },
    { pill: 'D5', key: 'domain5' },
    { pill: 'D6', key: 'domain6' },
  ];

  for (const { pill, key } of domains) {
    await page.getByRole('button', { name: pill, exact: true }).first().click();

    const section = page.locator(`#domain-section-${key}`);
    const optionGroups = section.locator('div.shrink-0.flex-wrap');
    await expect(optionGroups.first()).toBeVisible({ timeout: 5_000 });

    const groupCount = await optionGroups.count();
    for (let i = 0; i < groupCount; i++) {
      const group = optionGroups.nth(i);

      let answered = false;
      for (const code of preferred) {
        const btn = group.getByRole('button', { name: code, exact: true });
        if ((await btn.count()) > 0) {
          await btn.first().click();
          answered = true;
          break;
        }
      }
      // No preferred code in this scale: fall back to the first definite option.
      if (!answered) {
        await group.getByRole('button').first().click();
      }
      await page.waitForTimeout(30);
    }
  }
}

/**
 * Set the predicted direction of bias for a ROBINS-I domain in the checklist editor.
 * Scoped to the domain's container; the direction buttons render the full option text.
 */
export async function setROBINSIDomainDirection(
  page: Page,
  pill: string,
  domainKey: string,
  directionText: string,
) {
  await page.getByRole('button', { name: pill, exact: true }).first().click();
  const button = page
    .locator(`#domain-section-${domainKey}`)
    .getByRole('button', { name: directionText, exact: true });
  await expect(button).toBeVisible({ timeout: 5_000 });
  await button.click();
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
  const newProjectBtn = page.getByRole('button', { name: /New Project/i });
  await newProjectBtn.click();

  await expect(page.getByText('Create a new project')).toBeVisible();
  await page.getByPlaceholder('My Systematic Review').fill(name);
  if (description) {
    await page.getByPlaceholder('What is this review about?').fill(description);
  }
  const createBtn = page.getByRole('button', { name: 'Create Project' });
  await expect(createBtn).toBeEnabled({ timeout: 10_000 });
  await createBtn.click();
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

  // Target Select triggers by index to avoid the race where
  // getByText('Unassigned').first() re-targets reviewer1's trigger
  // before React re-renders it with the selected value.
  const triggers = dialog.getByRole('combobox');
  await triggers.nth(0).click();
  await page.getByRole('option', { name: /Alice/i }).click();
  // Wait for Radix Select dropdown to fully close before opening the next one;
  // without this the first selection can be lost.
  await expect(page.getByRole('listbox')).toBeHidden({ timeout: 5_000 });
  await triggers.nth(1).click();
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
  await expect(page.getByRole('button', { name: /Add/i }).last()).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /Add/i }).last().click();
  await page.getByPlaceholder(/outcome/i).fill(name);
  await page.keyboard.press('Enter');
  await expect(page.getByText(name)).toBeVisible({ timeout: 5_000 });
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

  await expect(dialog).toBeHidden({ timeout: 10_000 });
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

  await addStudyViaPdf(page);
  await assignReviewers(page);

  return projectId;
}
