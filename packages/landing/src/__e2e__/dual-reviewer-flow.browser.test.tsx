/**
 * E2E Test: Dual-Reviewer AMSTAR2 Workflow
 *
 * Tests the full happy path:
 * 1. User A creates a project
 * 2. User A adds a study
 * 3. User A assigns reviewers (self + User B)
 * 4. User A creates and fills an AMSTAR2 checklist, marks complete
 * 5. User B creates and fills their checklist, marks complete
 * 6. Reconciliation
 * 7. Verify completed checklist
 *
 * Prerequisites: pnpm dev:workers running at localhost:8787 with DEV_MODE=true
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { render, cleanup } from 'vitest-browser-react';
import React from 'react';
import { createTestApp } from './helpers/app';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  type DualReviewerScenario,
} from './helpers/seed';
import { injectSessionCookie, clearBrowserState } from './helpers/auth';

// Shared state across sequential tests
let scenario: DualReviewerScenario;
let currentApp: ReturnType<typeof createTestApp>;

function renderApp(path: string) {
  currentApp = createTestApp(path);
  return render(<currentApp.TestApp />);
}

describe('Dual-Reviewer AMSTAR2 Workflow', () => {
  beforeAll(async () => {
    scenario = await seedDualReviewerScenario();
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(async () => {
    await clearBrowserState();
    if (scenario) {
      await cleanupScenario(scenario);
    }
  });

  // -- Phase 1: User A creates a project --

  it('User A sees the dashboard after login', async () => {
    await injectSessionCookie(scenario.cookieA);
    renderApp('/dashboard');

    // Dashboard should load and show a "New Project" button
    await expect
      .element(page.getByRole('button', { name: /New Project/i }))
      .toBeVisible({ timeout: 10_000 });
  });
});
