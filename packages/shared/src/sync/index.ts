/**
 * @corates/shared/sync — the project workspace's sync-engine definition.
 *
 * Importable from both the worker and the browser (no runtime deps beyond
 * zod and @cf-sync/protocol). The worker also consumes `authContextSchema`'s
 * shape when building authorize verdicts; the answer-row helpers exist for the
 * client's read path and the migration transformer.
 */

export { syncApp, type SyncApp } from './app.js';
export {
  authContextSchema,
  checklistAnswerInputSchema,
  DEFAULT_TEXT_MAX_LENGTH,
  syncMutators,
  type SyncAuthContext,
  type SyncMutators,
} from './mutators.js';
export {
  CHECKLIST_TYPE_VALUES,
  pdfCitationMetadataSchema,
  pdfTagSchema,
  studyMetadataSchema,
  syncSchema,
  type ChecklistType,
  type PdfCitationMetadata,
  type PdfTag,
  type StudyMetadata,
  type SyncSchema,
  type StudyRow,
  type ChecklistRow,
  type AnswerRow,
  type AnnotationRow,
  type OutcomeRow,
  type PdfRow,
  type ReconciliationRow,
} from './schema.js';
export { presenceSchema, type PresenceState } from './presence.js';
export {
  defaultAnswerRows,
  expandAnswerUpdate,
  textAnswerKeys,
  type AnswerWrite,
  type ChecklistAnswerInput,
  type JsonValue,
} from './answer-rows.js';
export { answerRowId, reconciliationRowId } from './ids.js';
export {
  deriveFinalized,
  rob2JudgementsFromRows,
  robinsIJudgementsFromRows,
  ROB2_CHART_DOMAIN_KEYS,
  ROBINSI_CHART_DOMAIN_KEYS,
  scoreChecklistRows,
  serializeAnswerRows,
  textFieldKey,
  type AnswerRowMap,
  type DomainJudgements,
  type FinalizedDerivation,
} from './derive.js';
