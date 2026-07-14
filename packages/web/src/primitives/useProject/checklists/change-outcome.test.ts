/**
 * Tests for changeChecklistOutcome: moving a study's checklists between
 * outcomes, including the finalized consensus checklist and its
 * reconciliation progress entry.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { CHECKLIST_STATUS, getOutcomeKey } from '@corates/shared/checklists';
import { createChecklistOperations } from './index';
import { createReconciliationOperations } from '../reconciliation';

const STUDY_ID = 'study-1';
const OUTCOME_A = 'outcome-a';
const OUTCOME_B = 'outcome-b';

function setupDoc() {
  const ydoc = new Y.Doc();

  const outcomesMap = new Y.Map();
  for (const [id, name] of [
    [OUTCOME_A, 'Employment'],
    [OUTCOME_B, 'Credentialing'],
  ]) {
    const outcomeYMap = new Y.Map();
    outcomeYMap.set('name', name);
    outcomesMap.set(id, outcomeYMap);
  }
  ydoc.getMap('meta').set('outcomes', outcomesMap);

  const studyYMap = new Y.Map();
  ydoc.getMap('reviews').set(STUDY_ID, studyYMap);

  const ops = createChecklistOperations('project-1', () => ydoc);
  const reconciliationOps = createReconciliationOperations('project-1', () => ydoc);
  return { ydoc, ops, reconciliationOps };
}

function getChecklist(ydoc: Y.Doc, checklistId: string): Record<string, unknown> {
  const studyYMap = ydoc.getMap('reviews').get(STUDY_ID) as Y.Map<unknown>;
  const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown>;
  return (checklistsMap.get(checklistId) as Y.Map<unknown>).toJSON();
}

describe('changeChecklistOutcome', () => {
  let ydoc: Y.Doc;
  let ops: ReturnType<typeof createChecklistOperations>;
  let reconciliationOps: ReturnType<typeof createReconciliationOperations>;

  beforeEach(() => {
    ({ ydoc, ops, reconciliationOps } = setupDoc());
  });

  it('moves both reviewer checklists to the target outcome', () => {
    const c1 = ops.createChecklist(STUDY_ID, 'ROB2', 'user-1', OUTCOME_A)!;
    const c2 = ops.createChecklist(STUDY_ID, 'ROB2', 'user-2', OUTCOME_A)!;

    const result = ops.changeChecklistOutcome(STUDY_ID, 'ROB2', OUTCOME_A, OUTCOME_B);

    expect(result.success).toBe(true);
    expect(getChecklist(ydoc, c1).outcomeId).toBe(OUTCOME_B);
    expect(getChecklist(ydoc, c2).outcomeId).toBe(OUTCOME_B);
  });

  it('moves a finalized consensus checklist and re-keys reconciliation progress', () => {
    const c1 = ops.createChecklist(STUDY_ID, 'ROB2', 'user-1', OUTCOME_A)!;
    const c2 = ops.createChecklist(STUDY_ID, 'ROB2', 'user-2', OUTCOME_A)!;
    const consensus = ops.createChecklist(STUDY_ID, 'ROB2', null, OUTCOME_A)!;
    ops.updateChecklist(STUDY_ID, consensus, { status: CHECKLIST_STATUS.FINALIZED });
    reconciliationOps.saveReconciliationProgress(STUDY_ID, OUTCOME_A, 'ROB2', {
      checklist1Id: c1,
      checklist2Id: c2,
      reconciledChecklistId: consensus,
    });

    const result = ops.changeChecklistOutcome(STUDY_ID, 'ROB2', OUTCOME_A, OUTCOME_B);

    expect(result.success).toBe(true);
    expect(getChecklist(ydoc, consensus).outcomeId).toBe(OUTCOME_B);

    expect(reconciliationOps.getReconciliationProgress(STUDY_ID, OUTCOME_A, 'ROB2')).toBeNull();
    const moved = reconciliationOps.getReconciliationProgress(STUDY_ID, OUTCOME_B, 'ROB2');
    expect(moved?.checklist1Id).toBe(c1);
    expect(moved?.checklist2Id).toBe(c2);
    expect(moved?.reconciledChecklistId).toBe(consensus);
    expect(moved?.outcomeId).toBe(OUTCOME_B);

    const studyYMap = ydoc.getMap('reviews').get(STUDY_ID) as Y.Map<unknown>;
    const reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<unknown>;
    expect(reconciliationsMap.has(getOutcomeKey(OUTCOME_A, 'ROB2'))).toBe(false);
  });

  it('blocks when a reconciliation is in progress', () => {
    ops.createChecklist(STUDY_ID, 'ROB2', 'user-1', OUTCOME_A);
    ops.createChecklist(STUDY_ID, 'ROB2', 'user-2', OUTCOME_A);
    const consensus = ops.createChecklist(STUDY_ID, 'ROB2', null, OUTCOME_A)!;
    ops.updateChecklist(STUDY_ID, consensus, { status: CHECKLIST_STATUS.RECONCILING });

    const result = ops.changeChecklistOutcome(STUDY_ID, 'ROB2', OUTCOME_A, OUTCOME_B);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/in progress/i);
    expect(getChecklist(ydoc, consensus).outcomeId).toBe(OUTCOME_A);
  });

  it('blocks when a reviewer already has a checklist under the target outcome', () => {
    const c1 = ops.createChecklist(STUDY_ID, 'ROB2', 'user-1', OUTCOME_A)!;
    ops.createChecklist(STUDY_ID, 'ROB2', 'user-1', OUTCOME_B);

    const result = ops.changeChecklistOutcome(STUDY_ID, 'ROB2', OUTCOME_A, OUTCOME_B);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    expect(getChecklist(ydoc, c1).outcomeId).toBe(OUTCOME_A);
  });

  it('errors when the target outcome does not exist', () => {
    ops.createChecklist(STUDY_ID, 'ROB2', 'user-1', OUTCOME_A);

    const result = ops.changeChecklistOutcome(STUDY_ID, 'ROB2', OUTCOME_A, 'missing-outcome');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('errors when no checklists exist for the source outcome', () => {
    const result = ops.changeChecklistOutcome(STUDY_ID, 'ROB2', OUTCOME_A, OUTCOME_B);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no checklists/i);
  });

  it('updates the auto-filled ROBINS-I Section A outcome text but not user-edited text', () => {
    const autoFilled = ops.createChecklist(STUDY_ID, 'ROBINS_I', 'user-1', OUTCOME_A)!;
    const userEdited = ops.createChecklist(STUDY_ID, 'ROBINS_I', 'user-2', OUTCOME_A)!;
    ops.setTextValue(
      STUDY_ID,
      userEdited,
      { type: 'ROBINS_I', sectionKey: 'sectionA', fieldKey: 'outcome' },
      'Employment at 12 months',
    );

    const result = ops.changeChecklistOutcome(STUDY_ID, 'ROBINS_I', OUTCOME_A, OUTCOME_B);

    expect(result.success).toBe(true);
    const autoText = ops.getTextRef(STUDY_ID, autoFilled, {
      type: 'ROBINS_I',
      sectionKey: 'sectionA',
      fieldKey: 'outcome',
    });
    const editedText = ops.getTextRef(STUDY_ID, userEdited, {
      type: 'ROBINS_I',
      sectionKey: 'sectionA',
      fieldKey: 'outcome',
    });
    expect(autoText?.toString()).toBe('Credentialing');
    expect(editedText?.toString()).toBe('Employment at 12 months');
  });
});
