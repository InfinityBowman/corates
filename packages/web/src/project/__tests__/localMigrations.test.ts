import { describe, expect, it } from 'vitest';
import { syncApp } from '@corates/shared/sync';
import { migrateLocalRows } from '../localMigrations';
import { LOCAL_REVIEWER_ID } from '../localProject';

const NOW = 1_753_500_000_000;

function study(id: string, extra: Record<string, unknown> = {}) {
  return { id, name: id, description: '', createdAt: NOW, updatedAt: NOW, ...extra };
}

function checklist(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    studyId: id,
    type: 'AMSTAR2',
    title: 'AMSTAR2 Checklist',
    assignedTo: null,
    status: 'pending',
    outcomeId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

describe('migrateLocalRows', () => {
  it('brings unstamped version 1 rows to the current schema as a single-reviewer study', () => {
    const { schemaVersion, rows } = migrateLocalRows({
      rows: {
        studies: [study('s1'), study('s2')],
        checklists: [
          checklist('s1', { status: 'in-progress' }),
          checklist('s2', { status: 'reviewer-completed' }),
          checklist('s2-consensus', { studyId: 's2', status: 'finalized' }),
        ],
        answers: [],
      },
    });

    expect(schemaVersion).toBe(syncApp.version);
    const byId = new Map(rows.checklists.map(row => [(row as { id: string }).id, row]));
    expect(byId.get('s1')).toMatchObject({ kind: 'reviewer', assignedTo: LOCAL_REVIEWER_ID });
    expect(byId.get('s2')).toMatchObject({ kind: 'reviewer', assignedTo: LOCAL_REVIEWER_ID });
    expect(byId.get('s2-consensus')).toMatchObject({ kind: 'consensus', assignedTo: null });
    expect(rows.studies.every(row => (row as { reviewer1?: string }).reviewer1 === 'local')).toBe(
      true,
    );
    // The version 2 step's plan backfill ran too.
    expect(rows.appraisals.map(row => (row as { id: string }).id).sort()).toEqual([
      's1:type:AMSTAR2',
      's2:type:AMSTAR2',
    ]);
    expect(rows.outcomes).toEqual([]);
    expect(rows.reconciliations).toEqual([]);
  });

  it('assigns an unstamped reviewer row that already carries kind', () => {
    const { rows } = migrateLocalRows({
      rows: {
        studies: [study('s1')],
        checklists: [checklist('s1', { kind: 'reviewer' })],
        answers: [],
        appraisals: [],
      },
    });
    expect(rows.checklists[0]).toMatchObject({ kind: 'reviewer', assignedTo: LOCAL_REVIEWER_ID });
  });

  it('leaves rows stamped at the current version alone', () => {
    const stored = {
      studies: [study('s1', { reviewer1: LOCAL_REVIEWER_ID })],
      checklists: [checklist('s1', { kind: 'reviewer', assignedTo: LOCAL_REVIEWER_ID })],
      appraisals: [],
      answers: [],
      outcomes: [],
      reconciliations: [],
    };
    const { schemaVersion, rows } = migrateLocalRows({
      schemaVersion: syncApp.version,
      rows: stored,
    });
    expect(schemaVersion).toBe(syncApp.version);
    expect(rows).toEqual(stored);
  });

  it('refuses rows stamped ahead of the deployed schema', () => {
    expect(() =>
      migrateLocalRows({
        schemaVersion: syncApp.version + 1,
        rows: { studies: [], checklists: [], answers: [] },
      }),
    ).toThrow(/ahead of the deployed version/);
  });

  it('refuses a row the current schema rejects', () => {
    expect(() =>
      migrateLocalRows({
        schemaVersion: syncApp.version,
        rows: { studies: [{ id: 's1' }], checklists: [], answers: [] },
      }),
    ).toThrow(/validation failed/);
  });
});
