/**
 * Row-id conventions for the sync tables.
 *
 * Answer rows are addressed by checklist + flat key; the same string doubles as
 * the field id for collaborative-text fields, so a reconciliation note's Yjs
 * field and its row share one name.
 */

/** Row id in `answers`: one row per (checklist, flat answer key). */
export function answerRowId(checklistId: string, flatKey: string): string {
  return `${checklistId}:${flatKey}`;
}

/** Row id in `reconciliations`: one row per (study, outcome group). */
export function reconciliationRowId(studyId: string, outcomeKey: string): string {
  return `${studyId}:${outcomeKey}`;
}
