/**
 * Sync-engine table schemas for the project workspace.
 *
 * One workspace per project. These tables hold the collaborative content that
 * lived in the per-project Y.Doc — and only the content: identity, membership,
 * and billing stay in D1 (one authority per fact; reads happen at authorize
 * time, never via write-mirroring). The old Y.Doc `meta`/`members` maps are
 * deleted, not migrated.
 *
 * Timestamps are epoch milliseconds throughout, matching the Y.Doc plane.
 */

import { z } from 'zod';
import { defineSchema } from '@cf-sync/protocol';
import type { RowOf } from '@cf-sync/protocol';
import type { ChecklistStatus } from '../checklists/index.js';

export const CHECKLIST_TYPE_VALUES = ['AMSTAR2', 'ROB2', 'ROBINS_I'] as const;
export type ChecklistType = (typeof CHECKLIST_TYPE_VALUES)[number];

const checklistTypeSchema = z.enum(CHECKLIST_TYPE_VALUES);

const CHECKLIST_STATUS_VALUES = [
  'pending',
  'in-progress',
  'reviewer-completed',
  'reconciling',
  'finalized',
] as const satisfies readonly ChecklistStatus[];

const checklistStatusSchema = z.enum(CHECKLIST_STATUS_VALUES);

/**
 * Citation-ish metadata carried on a study. All optional; `study.create` only
 * stores truthy values (matching the Y.Doc writer), `study.update` writes any
 * field that is present.
 */
export const studyMetadataSchema = z.object({
  originalTitle: z.string().optional(),
  firstAuthor: z.string().optional(),
  publicationYear: z.string().optional(),
  authors: z.string().optional(),
  journal: z.string().optional(),
  doi: z.string().optional(),
  abstract: z.string().optional(),
  importSource: z.string().optional(),
  pdfUrl: z.string().optional(),
  pdfSource: z.string().optional(),
  pdfAccessible: z.boolean().optional(),
  pmid: z.string().optional(),
  url: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  type: z.string().optional(),
});

export type StudyMetadata = z.infer<typeof studyMetadataSchema>;

export const pdfTagSchema = z.enum(['primary', 'protocol', 'secondary']);
export type PdfTag = z.infer<typeof pdfTagSchema>;

/** Citation metadata on an attached PDF; `pdf.updateMetadata` deletes fields set to ''. */
export const pdfCitationMetadataSchema = z.object({
  title: z.string().optional(),
  firstAuthor: z.string().optional(),
  publicationYear: z.string().optional(),
  journal: z.string().optional(),
  doi: z.string().optional(),
});

export type PdfCitationMetadata = z.infer<typeof pdfCitationMetadataSchema>;

export const syncSchema = defineSchema({
  /** One row per study (the Y.Doc's `reviews[studyId]` map, minus its child maps). */
  studies: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().default(''),
    reviewer1: z.string().optional(),
    reviewer2: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    ...studyMetadataSchema.shape,
  }),

  /** One row per checklist instance; answers live in `answers`, one row per field. */
  checklists: z.object({
    id: z.string(),
    studyId: z.string(),
    type: checklistTypeSchema,
    title: z.string(),
    assignedTo: z.string().nullable().default(null),
    status: checklistStatusSchema.default('pending'),
    outcomeId: z.string().nullable().default(null),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),

  /**
   * One row per (checklist, flat answer key) — row id `${checklistId}:${flatKey}`.
   * The flat key is the same dot-notation namespace the Y.Doc `answers` map has
   * used since the flat-key migration (`q1.answers`, `d1_1.comment`,
   * `sectionB.b2`, …), so a field-level write collides per field, not per
   * checklist. Values are validated per-key by the instrument's Zod schema in
   * `checklist.updateAnswer`; the row schema only guarantees JSON.
   */
  answers: z.object({
    id: z.string(),
    studyId: z.string(),
    checklistId: z.string(),
    key: z.string(),
    value: z.json(),
  }),

  /** One row per annotation; `embedPdfData` stays a serialized JSON string. */
  annotations: z.object({
    id: z.string(),
    studyId: z.string(),
    checklistId: z.string(),
    pdfId: z.string(),
    type: z.string(),
    pageIndex: z.number(),
    embedPdfData: z.string(),
    createdBy: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    /** Set on rows cloned by `annotation.merge`: the source checklist id. */
    mergedFrom: z.string().optional(),
  }),

  /** One row per outcome (was `meta.outcomes[outcomeId]`). */
  outcomes: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.number(),
    createdBy: z.string(),
  }),

  /**
   * One row per attached PDF. This is the UI-facing metadata authority; the D1
   * `mediaFiles` table is a parallel storage-accounting ledger written by the
   * upload route, not synced with this table.
   */
  pdfs: z.object({
    id: z.string(),
    studyId: z.string(),
    key: z.string(),
    fileName: z.string(),
    size: z.number(),
    uploadedBy: z.string(),
    uploadedAt: z.number(),
    tag: pdfTagSchema.default('secondary'),
    ...pdfCitationMetadataSchema.shape,
  }),

  /**
   * Reconciliation session state, one row per (study, outcome group) — row id
   * `${studyId}:${outcomeKey}` where outcomeKey is `getOutcomeKey(outcomeId, type)`.
   * Consolidated answers are not here: they are `answers` rows of the third,
   * reconciled checklist.
   */
  reconciliations: z.object({
    id: z.string(),
    studyId: z.string(),
    outcomeKey: z.string(),
    outcomeId: z.string().nullable(),
    type: checklistTypeSchema,
    checklist1Id: z.string(),
    checklist2Id: z.string(),
    reconciledChecklistId: z.string().optional(),
    currentPage: z.number().optional(),
    viewMode: z.string().optional(),
    updatedAt: z.number(),
  }),
});

export type SyncSchema = typeof syncSchema;

// Stored row shapes (schema output, defaults applied) — the read-side types.
export type StudyRow = RowOf<SyncSchema, 'studies'>;
export type ChecklistRow = RowOf<SyncSchema, 'checklists'>;
export type AnswerRow = RowOf<SyncSchema, 'answers'>;
export type AnnotationRow = RowOf<SyncSchema, 'annotations'>;
export type OutcomeRow = RowOf<SyncSchema, 'outcomes'>;
export type PdfRow = RowOf<SyncSchema, 'pdfs'>;
export type ReconciliationRow = RowOf<SyncSchema, 'reconciliations'>;
