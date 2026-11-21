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

/** Row id in `appraisals`: one row per (study, outcome group) plan cell. */
export function appraisalRowId(studyId: string, outcomeKey: string): string {
  return `${studyId}:${outcomeKey}`;
}

const INVITED_PREFIX = 'invite:';

/**
 * Reviewer-slot and `assignedTo` value for someone invited to the project who
 * has not joined yet; accepting the invitation swaps in their user id.
 */
export function invitedReviewerId(invitationId: string): string {
  return `${INVITED_PREFIX}${invitationId}`;
}

/** The invitation behind an invited-reviewer value, or null for a real user id. */
export function invitationIdOf(reviewerId: string | null | undefined): string | null {
  return reviewerId?.startsWith(INVITED_PREFIX) ? reviewerId.slice(INVITED_PREFIX.length) : null;
}
