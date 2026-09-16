import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '../exportOptions';
import { countChecklists, filterStudiesForExport, pickStudies } from '../selectStudiesForExport';
import {
  OUTCOME_DISABILITY,
  OUTCOME_PAIN,
  REVIEWER_A,
  REVIEWER_B,
  checklist,
  reconciledCell,
  study,
} from './fixtures';

const base = {
  status: DEFAULT_EXPORT_OPTIONS.status,
  outcomeId: null,
  tool: null,
  reviewerId: null,
  consensusOnly: true,
};

const project = [
  study('dual', [...reconciledCell(OUTCOME_PAIN), ...reconciledCell(OUTCOME_DISABILITY)]),
  study('single', [checklist({ outcomeId: OUTCOME_PAIN })]),
  study('draft', [checklist({ outcomeId: OUTCOME_DISABILITY, status: 'in-progress' })]),
  study('reconciling', [
    checklist({ outcomeId: OUTCOME_PAIN, assignedTo: REVIEWER_A, status: 'reviewer-completed' }),
    checklist({ outcomeId: OUTCOME_PAIN, assignedTo: REVIEWER_B, status: 'reviewer-completed' }),
    checklist({
      outcomeId: OUTCOME_PAIN,
      kind: 'consensus',
      assignedTo: null,
      status: 'reconciling',
    }),
  ]),
  study('awaiting', [checklist({ outcomeId: OUTCOME_PAIN, status: 'reviewer-completed' })]),
  study('amstar', [checklist({ type: 'AMSTAR2', outcomeId: null })]),
  study('empty', []),
];

describe('filterStudiesForExport', () => {
  it('defaults to finalized work and drops studies with nothing to export', () => {
    const result = filterStudiesForExport(project, base);
    expect(result.map(s => s.id)).toEqual(['dual', 'single', 'amstar']);
    expect(countChecklists(result)).toBe(4);
  });

  it('keeps in-progress checklists when the status scope is any', () => {
    const result = filterStudiesForExport(project, { ...base, status: 'any' });
    expect(result.map(s => s.id)).toEqual([
      'dual',
      'single',
      'draft',
      'reconciling',
      'awaiting',
      'amstar',
    ]);
    expect(result.find(s => s.id === 'reconciling')!.checklists.map(cl => cl.kind)).toEqual([
      'consensus',
    ]);
  });

  it('finalized with consensus only off keeps the reviewer copies behind a finalized consensus', () => {
    const result = filterStudiesForExport(project, { ...base, consensusOnly: false });
    expect(result.map(s => s.id)).toEqual(['dual', 'single', 'amstar']);
    expect(result.find(s => s.id === 'dual')!.checklists).toHaveLength(6);
  });

  it('filters by outcome', () => {
    const result = filterStudiesForExport(project, { ...base, outcomeId: OUTCOME_DISABILITY });
    expect(result.map(s => s.id)).toEqual(['dual']);
    expect(result[0].checklists.every(cl => cl.outcomeId === OUTCOME_DISABILITY)).toBe(true);
  });

  it('filters by tool', () => {
    const result = filterStudiesForExport(project, { ...base, tool: 'AMSTAR2' });
    expect(result.map(s => s.id)).toEqual(['amstar']);
  });

  it('hides reviewer copies where a consensus exists but keeps the single-reviewer record', () => {
    const result = filterStudiesForExport(project, { ...base, status: 'any' });
    const dual = result.find(s => s.id === 'dual')!;
    expect(dual.checklists.every(cl => cl.kind === 'consensus')).toBe(true);
    expect(dual.checklists).toHaveLength(2);
    const single = result.find(s => s.id === 'single')!;
    expect(single.checklists).toHaveLength(1);
  });

  it("a reviewer filter returns that reviewer's copies regardless of consensus only", () => {
    const result = filterStudiesForExport(project, {
      ...base,
      status: 'any',
      reviewerId: REVIEWER_B,
    });
    expect(result.map(s => s.id)).toEqual(['dual', 'reconciling']);
    expect(result[0].checklists.every(cl => cl.assignedTo === REVIEWER_B)).toBe(true);
    const finished = filterStudiesForExport(project, { ...base, reviewerId: REVIEWER_B });
    expect(finished.map(s => s.id)).toEqual(['dual']);
    expect(finished[0].checklists).toHaveLength(2);
  });
});

describe('pickStudies', () => {
  it('returns every eligible study for null and only the named ones otherwise', () => {
    const eligible = filterStudiesForExport(project, base);
    expect(pickStudies(eligible, null)).toBe(eligible);
    expect(pickStudies(eligible, ['single', 'draft', 'nope']).map(s => s.id)).toEqual(['single']);
  });
});
