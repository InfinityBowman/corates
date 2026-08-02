/**
 * The cutover transformer: one ProjectDoc dev-export (the old Yjs plane's
 * JSON) → one sync-engine import snapshot. Run once per project at cutover
 * by scripts/sync-cutover; rehearsed continuously by the workerd test that
 * pushes its output through a real WorkspaceDO import.
 *
 * Input is the PATCHED export shape (`formatVersion: 2`) — the exporter that
 * ships today drops checklist.outcomeId, annotations, reconciliations, and
 * the pdf tag/citation fields, so the runbook's first step deploys a
 * completeness patch to the old worker (see
 * scripts/sync-cutover/old-exporter-patch.md). Version-1 exports are
 * refused rather than silently migrated lossily.
 *
 * Mapping rules (CORATES-MAPPING.md §9):
 * - The old `answers` map is already flat-keyed on any doc a client has
 *   opened since the flat-key migration; those values (Y.Text already
 *   serialized to strings by the exporter's toJSON) overlay the type's
 *   default rows. Docs never opened since then still carry NESTED section
 *   shapes — those flatten through the same shared `expandAnswerUpdate` +
 *   text-key resolution the app's own write path uses.
 * - Keys outside the instrument's default row set are dropped and reported,
 *   never imported.
 * - Members and meta are NOT migrated — D1 owns them (one authority per
 *   fact). `meta.outcomes` is the exception: outcomes are workspace content.
 * - In-progress reconciliations seed Yjs fields: each non-empty text answer
 *   of a not-yet-finalized consensus checklist becomes a fresh per-field
 *   Y.Doc (library text key, base64 update) under the snapshot's extension
 *   state, field id = the answer row id.
 */

/* eslint-disable corates/corates-error-helpers -- cutover tooling:
   hard-fail assertions for the migration operator, not app domain errors */

import * as Y from 'yjs';
import { z } from 'zod';
import {
  answerRowId,
  checklistAnswerInputSchema,
  defaultAnswerRows,
  expandAnswerUpdate,
  reconciliationRowId,
  resolveNestedTextValue,
  syncApp,
  textAnswerKeys,
  type ChecklistAnswerInput,
  type ChecklistType,
  type JsonValue,
} from '@corates/shared/sync';
import { CHECKLIST_STATUS, getOutcomeKey } from '@corates/shared/checklists';

// ---------------------------------------------------------------------------
// The patched old-export shape (formatVersion 2)

const timeValue = z.union([z.number(), z.string()]).optional();

const oldChecklistSchema = z.looseObject({
  id: z.string(),
  type: z.enum(['AMSTAR2', 'ROB2', 'ROBINS_I']),
  title: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  status: z.string().optional(),
  outcomeId: z.string().nullable().optional(),
  createdAt: timeValue,
  updatedAt: timeValue,
  answers: z.record(z.string(), z.unknown()).default({}),
});

const oldPdfSchema = z.looseObject({
  fileName: z.string(),
  key: z.string(),
  size: z.number().optional(),
  uploadedBy: z.string().optional(),
  uploadedAt: timeValue,
  id: z.string().optional(),
  tag: z.string().optional(),
  title: z.string().optional(),
  firstAuthor: z.string().optional(),
  publicationYear: z.string().optional(),
  journal: z.string().optional(),
  doi: z.string().optional(),
});

const oldAnnotationSchema = z.looseObject({
  id: z.string().optional(),
  pdfId: z.string(),
  type: z.string().optional(),
  pageIndex: z.number().optional(),
  embedPdfData: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: timeValue,
  updatedAt: timeValue,
});

const oldReconciliationSchema = z.looseObject({
  checklist1Id: z.string(),
  checklist2Id: z.string(),
  reconciledChecklistId: z.string().optional(),
  type: z.string(),
  outcomeId: z.string().nullable().optional(),
  currentPage: z.number().optional(),
  viewMode: z.string().optional(),
  updatedAt: timeValue,
});

const oldStudySchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  createdAt: timeValue,
  updatedAt: timeValue,
  originalTitle: z.string().nullable().optional(),
  firstAuthor: z.string().nullable().optional(),
  publicationYear: z.union([z.string(), z.number()]).nullable().optional(),
  authors: z.string().nullable().optional(),
  journal: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
  pdfSource: z.string().nullable().optional(),
  pdfAccessible: z.boolean().nullable().optional(),
  pmid: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  reviewer1: z.string().nullable().optional(),
  reviewer2: z.string().nullable().optional(),
  checklists: z.array(oldChecklistSchema).default([]),
  pdfs: z.array(oldPdfSchema).default([]),
  annotations: z
    .record(z.string(), z.record(z.string(), oldAnnotationSchema))
    .optional(),
  reconciliations: z.record(z.string(), oldReconciliationSchema).optional(),
});

export const oldExportSchema = z.looseObject({
  formatVersion: z.literal(2, {
    error:
      'transformer requires the patched exporter (formatVersion 2) — the shipped v1 export drops outcomeId/annotations/reconciliations/pdf metadata',
  }),
  projectId: z.string(),
  exportedAt: z.string().optional(),
  meta: z
    .looseObject({
      outcomes: z
        .record(
          z.string(),
          z.looseObject({
            name: z.string(),
            createdAt: timeValue,
            createdBy: z.string().optional(),
          }),
        )
        .optional(),
    })
    .default({}),
  studies: z.array(oldStudySchema).default([]),
});

export type OldProjectExport = z.infer<typeof oldExportSchema>;

// ---------------------------------------------------------------------------
// Output

export interface EngineImportSnapshot {
  formatVersion: 1;
  schemaVersion: number;
  workspaceId: string;
  rows: Array<{ tbl: string; id: string; data: Record<string, unknown> }>;
  extension?: { fields: Record<string, string> };
}

export interface TransformReport {
  projectId: string;
  studies: number;
  checklists: number;
  answers: number;
  outcomes: number;
  pdfs: number;
  annotations: number;
  reconciliations: number;
  fieldSeeds: number;
  /** Flat keys present in the export but not in the instrument's row set. */
  droppedAnswerKeys: string[];
  warnings: string[];
}

export interface TransformResult {
  snapshot: EngineImportSnapshot;
  report: TransformReport;
}

// ---------------------------------------------------------------------------
// Helpers

const MIGRATION_ACTOR = 'migration';

function coerceTime(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** The engine's paved-path text key inside a field doc (ARCHITECTURE.md#yjs-fields). */
const FIELD_TEXT_KEY = 't';

function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  // Node (the CLI driver) has Buffer but no btoa before v16 polyfills.
  const nodeBuffer = (
    globalThis as {
      Buffer?: { from(bytes: Uint8Array): { toString(encoding: string): string } };
    }
  ).Buffer;
  if (!nodeBuffer) throw new Error('toBase64: no btoa and no Buffer available');
  return nodeBuffer.from(bytes).toString('base64');
}

/** A fresh one-text Y.Doc encoded for the yjsFields extension snapshot. */
export function encodeFieldSeed(text: string): string {
  const doc = new Y.Doc();
  doc.getText(FIELD_TEXT_KEY).insert(0, text);
  const update = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return toBase64(update);
}

/**
 * Old exports carry answers either flat (any client opened the doc since the
 * flat-key migration ran) or nested (untouched since). Flat is the common
 * case; detect by dotted keys or bare question keys holding primitives.
 */
function answersAreFlat(answers: Record<string, unknown>): boolean {
  const keys = Object.keys(answers);
  if (keys.length === 0) return true;
  if (keys.some(key => key.includes('.'))) return true;
  // Bare question keys (d1_1, q3…) hold primitives on the flat plane but
  // never exist as top-level keys on the nested plane.
  return keys.some(key => /^[dq]\d/i.test(key) && typeof answers[key] !== 'object');
}

/** Nested section shapes → flat writes, via the app's own expansion path. */
function flattenNestedAnswers(
  type: ChecklistType,
  answers: Record<string, unknown>,
  warnings: string[],
  checklistId: string,
): Record<string, JsonValue> {
  const flat: Record<string, JsonValue> = {};
  for (const [key, data] of Object.entries(answers)) {
    const parsed = checklistAnswerInputSchema.safeParse({ type, key, data });
    if (!parsed.success) {
      warnings.push(`checklist ${checklistId}: nested section "${key}" failed validation, skipped`);
      continue;
    }
    for (const write of expandAnswerUpdate(parsed.data as ChecklistAnswerInput)) {
      flat[write.key] = write.value;
    }
  }
  for (const textKey of textAnswerKeys(type)) {
    const text = resolveNestedTextValue(answers, textKey);
    if (text) flat[textKey] = text;
  }
  return flat;
}

// ---------------------------------------------------------------------------
// The transform

export function transformProjectExport(input: unknown): TransformResult {
  const parsed = oldExportSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`transform: export failed validation: ${parsed.error.message}`);
  }
  const oldExport = parsed.data;
  const now = coerceTime(oldExport.exportedAt, Date.now());

  const rows: EngineImportSnapshot['rows'] = [];
  const fields: Record<string, string> = {};
  const report: TransformReport = {
    projectId: oldExport.projectId,
    studies: 0,
    checklists: 0,
    answers: 0,
    outcomes: 0,
    pdfs: 0,
    annotations: 0,
    reconciliations: 0,
    fieldSeeds: 0,
    droppedAnswerKeys: [],
    warnings: [],
  };
  const put = (tbl: string, id: string, data: Record<string, unknown>) =>
    rows.push({ tbl, id, data });

  for (const [outcomeId, outcome] of Object.entries(oldExport.meta.outcomes ?? {})) {
    put('outcomes', outcomeId, {
      id: outcomeId,
      name: outcome.name,
      createdAt: coerceTime(outcome.createdAt, now),
      createdBy: outcome.createdBy ?? MIGRATION_ACTOR,
    });
    report.outcomes++;
  }

  for (const study of oldExport.studies) {
    const studyCreatedAt = coerceTime(study.createdAt, now);
    put('studies', study.id, {
      id: study.id,
      name: study.name ?? 'Untitled Study',
      description: study.description ?? '',
      ...(study.originalTitle ? { originalTitle: study.originalTitle } : {}),
      ...(study.firstAuthor ? { firstAuthor: study.firstAuthor } : {}),
      ...(study.publicationYear != null ? { publicationYear: String(study.publicationYear) } : {}),
      ...(study.authors ? { authors: study.authors } : {}),
      ...(study.journal ? { journal: study.journal } : {}),
      ...(study.doi ? { doi: study.doi } : {}),
      ...(study.abstract ? { abstract: study.abstract } : {}),
      ...(study.pdfUrl ? { pdfUrl: study.pdfUrl } : {}),
      ...(study.pdfSource ? { pdfSource: study.pdfSource } : {}),
      ...(study.pdfAccessible != null ? { pdfAccessible: study.pdfAccessible } : {}),
      ...(study.pmid ? { pmid: study.pmid } : {}),
      ...(study.url ? { url: study.url } : {}),
      ...(study.reviewer1 ? { reviewer1: study.reviewer1 } : {}),
      ...(study.reviewer2 ? { reviewer2: study.reviewer2 } : {}),
      createdAt: studyCreatedAt,
      updatedAt: coerceTime(study.updatedAt, studyCreatedAt),
    });
    report.studies++;

    const checklistById = new Map(study.checklists.map(checklist => [checklist.id, checklist]));

    for (const checklist of study.checklists) {
      const type = checklist.type as ChecklistType;
      if ((type === 'ROB2' || type === 'ROBINS_I') && !checklist.outcomeId) {
        throw new Error(
          `transform: checklist ${checklist.id} (${type}) has no outcomeId — ` +
            `the row plane requires one; fix the export before cutover`,
        );
      }
      const createdAt = coerceTime(checklist.createdAt, studyCreatedAt);
      put('checklists', checklist.id, {
        id: checklist.id,
        studyId: study.id,
        type,
        title: checklist.title ?? `${type} Checklist`,
        assignedTo: checklist.assignedTo ?? null,
        status: checklist.status ?? CHECKLIST_STATUS.PENDING,
        outcomeId: checklist.outcomeId ?? null,
        createdAt,
        updatedAt: coerceTime(checklist.updatedAt, createdAt),
      });
      report.checklists++;

      const defaults = defaultAnswerRows(type);
      const exported =
        answersAreFlat(checklist.answers) ?
          (checklist.answers as Record<string, JsonValue>)
        : flattenNestedAnswers(type, checklist.answers, report.warnings, checklist.id);

      const merged: Record<string, JsonValue> = { ...defaults };
      for (const [key, value] of Object.entries(exported)) {
        if (key in defaults) {
          merged[key] = value as JsonValue;
        } else {
          report.droppedAnswerKeys.push(`${checklist.id}:${key}`);
        }
      }
      for (const [key, value] of Object.entries(merged)) {
        const id = answerRowId(checklist.id, key);
        put('answers', id, { id, studyId: study.id, checklistId: checklist.id, key, value });
        report.answers++;
      }
    }

    for (const pdf of study.pdfs) {
      const id = pdf.id ?? `pdf:${pdf.key}`;
      put('pdfs', id, {
        id,
        studyId: study.id,
        key: pdf.key,
        fileName: pdf.fileName,
        size: pdf.size ?? 0,
        uploadedBy: pdf.uploadedBy ?? MIGRATION_ACTOR,
        uploadedAt: coerceTime(pdf.uploadedAt, now),
        tag: pdf.tag ?? 'secondary',
        ...(pdf.title ? { title: pdf.title } : {}),
        ...(pdf.firstAuthor ? { firstAuthor: pdf.firstAuthor } : {}),
        ...(pdf.publicationYear ? { publicationYear: pdf.publicationYear } : {}),
        ...(pdf.journal ? { journal: pdf.journal } : {}),
        ...(pdf.doi ? { doi: pdf.doi } : {}),
      });
      report.pdfs++;
    }

    for (const [checklistId, annotations] of Object.entries(study.annotations ?? {})) {
      for (const [annotationId, annotation] of Object.entries(annotations)) {
        const id = annotation.id ?? annotationId;
        const createdAt = coerceTime(annotation.createdAt, now);
        put('annotations', id, {
          id,
          studyId: study.id,
          checklistId,
          pdfId: annotation.pdfId,
          type: annotation.type ?? 'highlight',
          pageIndex: annotation.pageIndex ?? 0,
          embedPdfData: annotation.embedPdfData ?? '{}',
          createdBy: annotation.createdBy ?? MIGRATION_ACTOR,
          createdAt,
          updatedAt: coerceTime(annotation.updatedAt, createdAt),
        });
        report.annotations++;
      }
    }

    for (const progress of Object.values(study.reconciliations ?? {})) {
      // Recompute the key: the old plane used the same outcomeId||type:<type>
      // convention, but recomputing makes the invariant explicit.
      const outcomeKey = getOutcomeKey(progress.outcomeId ?? null, progress.type);
      const id = reconciliationRowId(study.id, outcomeKey);
      put('reconciliations', id, {
        id,
        studyId: study.id,
        outcomeKey,
        outcomeId: progress.outcomeId ?? null,
        type: progress.type,
        checklist1Id: progress.checklist1Id,
        checklist2Id: progress.checklist2Id,
        ...(progress.reconciledChecklistId ?
          { reconciledChecklistId: progress.reconciledChecklistId }
        : {}),
        ...(progress.currentPage != null ? { currentPage: progress.currentPage } : {}),
        ...(progress.viewMode ? { viewMode: progress.viewMode } : {}),
        updatedAt: coerceTime(progress.updatedAt, now),
      });
      report.reconciliations++;

      // In-progress consolidated notes land on Yjs fields (§5: never
      // LWW-then-upgrade). Finalized consensus checklists stay row-only.
      const consensus = progress.reconciledChecklistId ?
        checklistById.get(progress.reconciledChecklistId)
      : undefined;
      if (consensus && consensus.status !== CHECKLIST_STATUS.FINALIZED) {
        const type = consensus.type as ChecklistType;
        const exported =
          answersAreFlat(consensus.answers) ?
            (consensus.answers as Record<string, JsonValue>)
          : flattenNestedAnswers(type, consensus.answers, report.warnings, consensus.id);
        for (const textKey of textAnswerKeys(type)) {
          const text = exported[textKey];
          if (typeof text === 'string' && text.length > 0) {
            fields[answerRowId(consensus.id, textKey)] = encodeFieldSeed(text);
            report.fieldSeeds++;
          }
        }
      }
    }
  }

  return {
    snapshot: {
      formatVersion: 1,
      schemaVersion: syncApp.version,
      workspaceId: oldExport.projectId,
      rows,
      ...(Object.keys(fields).length > 0 ? { extension: { fields } } : {}),
    },
    report,
  };
}
