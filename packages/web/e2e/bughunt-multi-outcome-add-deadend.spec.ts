/**
 * Bug hunt: multi-outcome checklist-add dead end.
 *
 * The checklist add form (ChecklistForm) only exists inside a study's To Do
 * row, and shouldShowInTab('todo') hides the study once every checklist
 * assigned to the current user is reviewer-completed (domain.ts:111-118).
 * In a multi-outcome ROB2/ROBINS-I project, a reviewer who completes their
 * checklist for outcome A before adding one for outcome B therefore loses
 * the study from To Do permanently and has NO UI path to add the outcome-B
 * checklist. The reconcile tab shows the study as "Waiting" but offers no
 * add affordance, and the study never returns to To Do because the
 * completed checklist keeps failing the some(non-completed) check.
 *
 * EXPECTED: after completing the outcome-A checklist, the reviewer still
 * has a way to start their outcome-B appraisal (the study stays in To Do
 * with the Add button, or an equivalent affordance exists).
 * ACTUAL: the To Do tab is empty; the assertion fails deterministically.
 *
 * Deferred (2026-07-21): the checklist-add flow is being redesigned, so this
 * stays fixme'd rather than failing CI. Unskip once the new flow lands to
 * verify it covers the second-outcome case.
 *
 * Requires dev test server on localhost:3010 (DEV_MODE=true).
 */

import { test, expect } from '@playwright/test';
import { seedDualReviewerScenario, cleanupScenario, type DualReviewerScenario } from './helpers';
import {
  setupProjectWithStudy,
  addOutcome,
  markChecklistComplete,
  fillROB2Preliminary,
  answerAllROB2Domains,
} from './shared-steps';

test.setTimeout(300_000);

test.fixme('Reviewer can still add the second outcome checklist after completing the first', async ({
  context,
  page,
}) => {
  const scenario: DualReviewerScenario = await seedDualReviewerScenario();
  try {
    const projectId = await setupProjectWithStudy(context, page, scenario, 'Bughunt Add Deadend');
    await addOutcome(page, 'Outcome Alpha');
    await addOutcome(page, 'Outcome Beta');

    // Add and complete the outcome-A checklist only
    await page.getByRole('tab', { name: /To Do/i }).click();
    await page.getByRole('button', { name: /Select Checklist/i }).click();
    await page.getByText(/AMSTAR 2/i).click();
    await page.getByRole('option', { name: /RoB 2/i }).click();
    await page.getByText(/Select outcome/i).click();
    await page.getByRole('option', { name: 'Outcome Alpha' }).click();
    await page.getByRole('button', { name: /Add Checklist/i }).click();
    await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    await expect(page.getByText('Individually-randomized parallel-group trial')).toBeVisible({
      timeout: 10_000,
    });
    await fillROB2Preliminary(page, 'Drug X', 'Placebo');
    await answerAllROB2Domains(page, 'Y');
    await markChecklistComplete(page);

    // The reviewer still has outcome B to appraise: there must be an add
    // path. Today the study vanishes from To Do (their only checklist is
    // reviewer-completed) and ChecklistForm has no other mount point.
    await page.goto(`/projects/${projectId}`);
    await page.getByRole('tab', { name: /To Do/i }).click();
    await expect(
      page
        .getByRole('button', { name: 'Add', exact: true })
        .or(page.getByRole('button', { name: /Select Checklist/i })),
      'No UI path remains to add the outcome-B checklist after completing outcome A',
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await cleanupScenario(scenario);
  }
});
