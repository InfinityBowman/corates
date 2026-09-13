import { describe, expect, it } from 'vitest';
import { createTestEngine } from '@cf-sync/server/testing';
import { syncApp } from '../app.js';

const NOW = 1_753_500_000_000;

/** A checklist row as version 1 stored it: no `kind`, consensus marked by a null assignee. */
function v1Checklist(
  id: string,
  studyId: string,
  type: 'AMSTAR2' | 'ROB2',
  assignedTo: string | null,
  outcomeId: string | null,
  status = 'pending',
) {
  return {
    id,
    studyId,
    type,
    title: `${type} Checklist`,
    assignedTo,
    status,
    outcomeId,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('migration to version 2', () => {
  const rows = {
    studies: {
      s1: {
        id: 's1',
        name: 'Trial',
        reviewer1: 'alice',
        reviewer2: 'bob',
        createdAt: NOW,
        updatedAt: NOW,
      },
      s2: { id: 's2', name: 'Review', reviewer1: 'alice', createdAt: NOW, updatedAt: NOW },
    },
    outcomes: { o1: { id: 'o1', name: 'Pain', createdAt: NOW, createdBy: 'alice' } },
    checklists: {
      'c-alice': v1Checklist('c-alice', 's1', 'ROB2', 'alice', 'o1', 'reviewer-completed'),
      'c-bob': v1Checklist('c-bob', 's1', 'ROB2', 'bob', 'o1', 'reviewer-completed'),
      'c-consensus': v1Checklist('c-consensus', 's1', 'ROB2', null, 'o1', 'reconciling'),
      // Carol held slot 2 before Bob; her checklist survived the swap.
      'c-orphan': v1Checklist('c-orphan', 's1', 'ROB2', 'carol', 'o1', 'in-progress'),
      'c-amstar': v1Checklist('c-amstar', 's2', 'AMSTAR2', 'alice', null),
    },
    // Version 1 keyed this by outcome alone.
    reconciliations: {
      's1:o1': {
        id: 's1:o1',
        studyId: 's1',
        outcomeKey: 'o1',
        outcomeId: 'o1',
        type: 'ROB2',
        checklist1Id: 'c-alice',
        checklist2Id: 'c-bob',
        reconciledChecklistId: 'c-consensus',
        currentPage: 2,
        updatedAt: NOW,
      },
    },
  };

  function migrated() {
    return createTestEngine(syncApp, { storedVersion: 1, rows });
  }

  it('derives kind from the null assignee', () => {
    const engine = migrated();
    expect(engine.get('checklists', 'c-alice')?.kind).toBe('reviewer');
    expect(engine.get('checklists', 'c-bob')?.kind).toBe('reviewer');
    expect(engine.get('checklists', 'c-consensus')?.kind).toBe('consensus');
    expect(engine.get('checklists', 'c-amstar')?.kind).toBe('reviewer');
  });

  it('keeps an orphaned checklist as reviewer work, assignee intact', () => {
    const engine = migrated();
    expect(engine.get('checklists', 'c-orphan')).toMatchObject({
      kind: 'reviewer',
      assignedTo: 'carol',
      status: 'in-progress',
    });
  });

  it('backfills one plan row per distinct cell', () => {
    const engine = migrated();
    const plans = engine.list('appraisals').map(row => row.data);
    expect(plans).toHaveLength(2);
    expect(engine.get('appraisals', 's1:ROB2:o1')).toMatchObject({
      studyId: 's1',
      type: 'ROB2',
      outcomeId: 'o1',
      outcomeKey: 'ROB2:o1',
      createdAt: NOW,
    });
    expect(engine.get('appraisals', 's2:type:AMSTAR2')).toMatchObject({
      studyId: 's2',
      type: 'AMSTAR2',
      outcomeId: null,
      outcomeKey: 'type:AMSTAR2',
    });
  });

  it('moves a reconciliation row to the instrument-qualified key', () => {
    const engine = migrated();
    expect(engine.get('reconciliations', 's1:o1')).toBeNull();
    expect(engine.get('reconciliations', 's1:ROB2:o1')).toMatchObject({
      id: 's1:ROB2:o1',
      outcomeKey: 'ROB2:o1',
      outcomeId: 'o1',
      type: 'ROB2',
      checklist1Id: 'c-alice',
      checklist2Id: 'c-bob',
      reconciledChecklistId: 'c-consensus',
      currentPage: 2,
    });
    expect(engine.list('reconciliations')).toHaveLength(1);
  });

  it('does not materialize checklists for already-filled slots', () => {
    const engine = migrated();
    expect(engine.list('checklists')).toHaveLength(5);
  });

  it('leaves every other row untouched', () => {
    const engine = migrated();
    expect(engine.get('studies', 's1')).toMatchObject({ reviewer1: 'alice', reviewer2: 'bob' });
    expect(engine.get('outcomes', 'o1')?.name).toBe('Pain');
  });
});
