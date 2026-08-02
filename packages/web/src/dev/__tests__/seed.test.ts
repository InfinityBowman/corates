/**
 * The dev fixtures against the real row plane: every template and every
 * generator fill mode planned by `@/dev/seed` must apply cleanly through the
 * shared mutators (schema validation + guards), so the dev panel and the e2e
 * seeding seam cannot drift from the engine's write vocabulary unnoticed.
 */

import { describe, expect, it } from 'vitest';
import { createTestEngine } from '@cf-sync/server/testing';
import { syncApp, type ChecklistType } from '@corates/shared/sync';
import { getTemplate, getTemplateNames } from '../mock-templates';
import { planAddStudy, planTemplate, type SeedContext, type SeedMutation } from '../seed';

function newEngine() {
  return createTestEngine(syncApp, {
    principal: 'dev-user',
    auth: { role: 'owner', writeAllowed: true },
  });
}

function testContext(): SeedContext {
  let counter = 0;
  return { now: 1_753_500_000_000, id: prefix => `gen_${prefix}_${++counter}` };
}

function apply(engine: ReturnType<typeof newEngine>, plan: SeedMutation[]): void {
  // The plan is stringly-typed by design; erase the engine's mutator
  // generics but keep the method bound to its engine.
  const mutate = (name: string, args: unknown): { error?: unknown } =>
    (engine.mutate as (name: string, args: unknown) => { error?: unknown }).call(
      engine,
      name,
      args,
    );
  for (const mutation of plan) {
    const result = mutate(mutation.name, mutation.args);
    expect(
      result.error,
      `${mutation.name} failed: ${JSON.stringify(result.error)} args=${JSON.stringify(mutation.args).slice(0, 200)}`,
    ).toBeUndefined();
  }
}

describe('planAddStudy', () => {
  for (const type of ['AMSTAR2', 'ROB2', 'ROBINS_I'] as ChecklistType[]) {
    for (const fillMode of ['random', 'all-yes', 'mixed'] as const) {
      it(`seeds a ${type} study (${fillMode}) that the mutators accept`, () => {
        const engine = newEngine();
        const { plan, result } = planAddStudy(
          { type, fillMode, reviewer1: 'user-a', reviewer2: 'user-b', reconcile: true },
          testContext(),
        );
        apply(engine, plan);

        expect(engine.get('studies', result.studyId)).toBeTruthy();
        expect(result.checklistIds).toHaveLength(3);
        for (const checklistId of result.checklistIds) {
          const checklist = engine.get('checklists', checklistId);
          expect(checklist?.type).toBe(type);
        }
        // Filled modes write real answer content beyond the defaults.
        const answers = engine
          .list('answers')
          .filter(row => row.data.checklistId === result.checklistIds[0]);
        expect(answers.length).toBeGreaterThan(0);
        if (type !== 'AMSTAR2') {
          expect(result.outcomeId).toBeTruthy();
          expect(engine.get('outcomes', result.outcomeId!)).toBeTruthy();
        }
      });
    }
  }

  it('reuses an existing outcome id instead of creating one', () => {
    const engine = newEngine();
    engine.mutate('outcome.create', {
      id: 'outcome-1',
      name: 'Mortality',
      createdBy: 'user-a',
      now: 1_753_500_000_000,
    });
    const { plan, result } = planAddStudy(
      { type: 'ROB2', reviewer1: 'user-a', reviewer2: 'user-b', outcomeId: 'outcome-1' },
      testContext(),
    );
    apply(engine, plan);
    expect(result.outcomeId).toBe('outcome-1');
    expect(engine.list('outcomes')).toHaveLength(1);
  });
});

describe('planTemplate', () => {
  for (const name of getTemplateNames()) {
    it(`template "${name}" applies cleanly through the mutators`, () => {
      const engine = newEngine();
      const data = getTemplate(name)!;
      const plan = planTemplate(
        data,
        { actorId: 'dev-user', userMapping: { user_reviewer1: 'real-1', user_reviewer2: 'real-2' } },
        testContext(),
      );
      apply(engine, plan);

      expect(engine.list('studies')).toHaveLength(data.studies.length);
      const expectedChecklists = data.studies.reduce((n, s) => n + s.checklists.length, 0);
      expect(engine.list('checklists')).toHaveLength(expectedChecklists);
      // The user mapping reached assignment fields.
      if (data.studies.some(s => s.reviewer1 === 'user_reviewer1')) {
        expect(
          engine.list('studies').some(row => row.data.reviewer1 === 'real-1'),
        ).toBe(true);
      }
    });
  }
});
