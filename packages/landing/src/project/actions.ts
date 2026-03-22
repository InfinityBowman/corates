/**
 * Typed project actions singleton.
 * Components use `project.study.create(...)` for write operations.
 * All action modules import connectionPool directly.
 */

import { connectionPool } from './ConnectionPool';
import { studyActions } from './actions/studies';
import { checklistActions } from './actions/checklists';
import { pdfActions } from './actions/pdfs';
import { projectActions } from './actions/project';
import { memberActions } from './actions/members';
import { reconciliationActions } from './actions/reconciliation';
import { outcomeActions } from './actions/outcomes';

export const project = {
  study: studyActions,
  checklist: checklistActions,
  pdf: pdfActions,
  project: projectActions,
  member: memberActions,
  reconciliation: reconciliationActions,
  outcome: outcomeActions,

  getActiveProjectId: () => connectionPool.getActiveProjectId(),
  getActiveOrgId: () => connectionPool.getActiveOrgId(),
};
