/**
 * Named intent mutations for the project workspace — the six Y.Doc ops modules
 * re-expressed as deterministic mutators. Each runs twice (optimistic on the
 * client, authoritative on the server), so ids and timestamps always arrive as
 * args and every guard that used to be a console.error-and-return is a
 * permanent AppError the client surfaces as a MutationError.
 *
 * Every mutator starts with the write gate: `authorize` stamps
 * `{ role, writeAllowed }` on the socket at connect (from D1 membership +
 * billing), and mutators enforce it synchronously — no D1 access mid-commit.
 */

import { z } from 'zod';
import { AppError, crudMutators, defineMutators } from '@cf-sync/protocol';
import { CHECKLIST_STATUS, getOutcomeKey, requiresOutcome } from '../checklists/index.js';
import {
  AMSTAR2_KEY_SCHEMAS,
  ROB2_KEY_SCHEMAS,
  ROBINS_I_KEY_SCHEMAS,
  defaultAnswerRows,
  expandAnswerUpdate,
  type ChecklistAnswerInput,
} from './answer-rows.js';
import { answerRowId, reconciliationRowId } from './ids.js';
import {
  pdfCitationMetadataSchema,
  pdfTagSchema,
  studyMetadataSchema,
  syncSchema,
  type StudyMetadata,
} from './schema.js';

export const authContextSchema = z.object({
  role: z.enum(['owner', 'member']),
  writeAllowed: z.boolean(),
});

export type SyncAuthContext = z.infer<typeof authContextSchema>;

const timestamp = z.number().int().nonnegative();

const CHECKLIST_TYPE = z.enum(['AMSTAR2', 'ROB2', 'ROBINS_I']);

/** Default cap `checklist.setText` applies, matching the old `setTextValue`. */
export const DEFAULT_TEXT_MAX_LENGTH = 2000;

interface WriteGateContext {
  authoritative: boolean;
  auth?: SyncAuthContext | undefined;
}

/**
 * Enforced only on the authoritative run so an offline queue never rejects
 * locally; the server's rejection rolls the optimistic effect back. Fails
 * closed if the stamp is somehow missing.
 */
function assertWritable(ctx: WriteGateContext): void {
  if (!ctx.authoritative) return;
  if (!ctx.auth?.writeAllowed) {
    throw new AppError('ReadOnly', 'This account does not have write access to this project');
  }
}

/**
 * Runtime companion of `ChecklistAnswerInput`: one union branch per
 * (instrument, key), with `data` validated by that key's existing Zod schema —
 * the same validation the Y.Doc plane ran client-side, now enforced by the
 * server before apply.
 */
function answerBranches(
  type: string,
  schemas: Record<string, z.ZodType>,
): z.ZodType[] {
  return Object.entries(schemas).map(([key, data]) =>
    z.object({ type: z.literal(type), key: z.literal(key), data }),
  );
}

export const checklistAnswerInputSchema = z.union([
  ...answerBranches('AMSTAR2', AMSTAR2_KEY_SCHEMAS),
  ...answerBranches('ROB2', ROB2_KEY_SCHEMAS),
  ...answerBranches('ROBINS_I', ROBINS_I_KEY_SCHEMAS),
]) as unknown as z.ZodType<ChecklistAnswerInput, ChecklistAnswerInput>;

const studyFieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  metadata: studyMetadataSchema.optional(),
});

const pdfInfoSchema = z.object({
  id: z.string(),
  key: z.string(),
  fileName: z.string(),
  size: z.number(),
  uploadedBy: z.string(),
  uploadedAt: timestamp.optional(),
  ...pdfCitationMetadataSchema.shape,
});

type Tx = Parameters<(typeof crud)['sync.put']['apply']>[0];

const crud = crudMutators(syncSchema);

function rejectDirectWrite(): never {
  throw new AppError(
    'DirectWriteDisabled',
    'Direct row writes are disabled; use a named mutation via client.mutate.*',
  );
}

/** Only truthy metadata values are stored — the Y.Doc writer's behavior. */
function truthyMetadata(metadata: StudyMetadata | undefined): Partial<StudyMetadata> {
  if (!metadata) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => Boolean(value)),
  ) as Partial<StudyMetadata>;
}

function createStudyRow(
  tx: Tx,
  study: z.output<typeof studyFieldsSchema> & { id: string },
  now: number,
): void {
  tx.put('studies', study.id, {
    id: study.id,
    name: study.name,
    description: study.description,
    ...truthyMetadata(study.metadata),
    createdAt: now,
    updatedAt: now,
  });
}

function touchStudy(tx: Tx, studyId: string, now: number): void {
  const study = tx.get('studies', studyId);
  if (study) tx.put('studies', studyId, { ...study, updatedAt: now });
}

function deleteAnswerRows(tx: Tx, checklistId: string): void {
  for (const row of tx.list('answers')) {
    if (row.data.checklistId === checklistId) tx.del('answers', row.id);
  }
}

export const syncMutators = defineMutators(
  syncSchema,
  {
    // Collections must be able to attach (they require the crud pair to exist),
    // but every real write goes through a named intent — so the pair exists and
    // rejects. Applies optimistically too: an accidental collection.insert
    // fails fast in dev instead of on the server.
    'sync.put': { ...crud['sync.put'], apply: rejectDirectWrite },
    'sync.del': { ...crud['sync.del'], apply: rejectDirectWrite },

    'study.create': {
      args: z.object({ id: z.string(), ...studyFieldsSchema.shape, now: timestamp }),
      apply: (tx, { id, name, description, metadata, now }, ctx) => {
        assertWritable(ctx);
        createStudyRow(tx, { id, name, description, metadata }, now);
      },
    },

    'study.importBatch': {
      args: z.object({
        studies: z.array(z.object({ id: z.string(), ...studyFieldsSchema.shape })),
        now: timestamp,
      }),
      apply: (tx, { studies, now }, ctx) => {
        assertWritable(ctx);
        for (const study of studies) createStudyRow(tx, study, now);
      },
    },

    'study.update': {
      args: z.object({
        id: z.string(),
        updates: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          reviewer1: z.string().optional(),
          reviewer2: z.string().optional(),
          ...studyMetadataSchema.shape,
        }),
        now: timestamp,
      }),
      apply: (tx, { id, updates, now }, ctx) => {
        assertWritable(ctx);
        const study = tx.get('studies', id);
        if (!study) throw new AppError('NotFound', `Study ${id} does not exist`);
        const merged = { ...study };
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
        }
        tx.put('studies', id, { ...merged, updatedAt: now });
      },
    },

    'study.delete': {
      args: z.object({ id: z.string() }),
      apply: (tx, { id }, ctx) => {
        assertWritable(ctx);
        // The Y.Doc plane deleted the whole `reviews[studyId]` subtree in one
        // map delete; rows cascade explicitly. Deleting an already-deleted
        // study is a no-op, not an error, so racing deletes both succeed.
        tx.del('studies', id);
        for (const table of ['checklists', 'answers', 'annotations', 'pdfs', 'reconciliations'] as const) {
          for (const row of tx.list(table)) {
            if (row.data.studyId === id) tx.del(table, row.id);
          }
        }
      },
    },

    'checklist.create': {
      args: z.object({
        id: z.string(),
        studyId: z.string(),
        type: CHECKLIST_TYPE,
        assignedTo: z.string().nullable().default(null),
        outcomeId: z.string().nullable().default(null),
        now: timestamp,
      }),
      apply: (tx, { id, studyId, type, assignedTo, outcomeId, now }, ctx) => {
        assertWritable(ctx);
        if (requiresOutcome(type) && !outcomeId) {
          throw new AppError('OutcomeRequired', `${type} checklists require an outcome`);
        }
        const study = tx.get('studies', studyId);
        if (!study) throw new AppError('NotFound', `Study ${studyId} does not exist`);

        if (requiresOutcome(type) && outcomeId) {
          for (const row of tx.list('checklists')) {
            if (
              row.data.studyId === studyId &&
              row.data.type === type &&
              row.data.outcomeId === outcomeId &&
              row.data.assignedTo === assignedTo
            ) {
              throw new AppError(
                'DuplicateChecklist',
                `A ${type} checklist for this outcome and reviewer already exists`,
              );
            }
          }
        }

        tx.put('checklists', id, {
          id,
          studyId,
          type,
          title: `${type} Checklist`,
          assignedTo,
          status: CHECKLIST_STATUS.PENDING,
          outcomeId,
          createdAt: now,
          updatedAt: now,
        });

        for (const [key, value] of Object.entries(defaultAnswerRows(type))) {
          tx.put('answers', answerRowId(id, key), {
            id: answerRowId(id, key),
            studyId,
            checklistId: id,
            key,
            value,
          });
        }

        // ROBINS-I starts Section A prefilled with the outcome name.
        if (type === 'ROBINS_I' && outcomeId) {
          const outcome = tx.get('outcomes', outcomeId);
          if (outcome?.name) {
            const key = 'sectionA.outcome';
            tx.put('answers', answerRowId(id, key), {
              id: answerRowId(id, key),
              studyId,
              checklistId: id,
              key,
              value: outcome.name,
            });
          }
        }

        tx.put('studies', studyId, { ...study, updatedAt: now });
      },
    },

    'checklist.update': {
      args: z.object({
        checklistId: z.string(),
        updates: z.object({
          title: z.string().optional(),
          assignedTo: z.string().nullable().optional(),
          status: z
            .enum(['pending', 'in-progress', 'reviewer-completed', 'reconciling', 'finalized'])
            .optional(),
        }),
        now: timestamp,
      }),
      apply: (tx, { checklistId, updates, now }, ctx) => {
        assertWritable(ctx);
        const checklist = tx.get('checklists', checklistId);
        if (!checklist) throw new AppError('NotFound', `Checklist ${checklistId} does not exist`);
        tx.put('checklists', checklistId, {
          ...checklist,
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.assignedTo !== undefined && { assignedTo: updates.assignedTo }),
          ...(updates.status !== undefined && { status: updates.status }),
          updatedAt: now,
        });
      },
    },

    'checklist.delete': {
      args: z.object({ checklistId: z.string(), now: timestamp }),
      apply: (tx, { checklistId, now }, ctx) => {
        assertWritable(ctx);
        const checklist = tx.get('checklists', checklistId);
        if (!checklist) return;
        tx.del('checklists', checklistId);
        deleteAnswerRows(tx, checklistId);
        touchStudy(tx, checklist.studyId, now);
      },
    },

    'checklist.changeOutcome': {
      args: z.object({
        studyId: z.string(),
        type: CHECKLIST_TYPE,
        fromOutcomeId: z.string(),
        toOutcomeId: z.string(),
        now: timestamp,
      }),
      apply: (tx, { studyId, type, fromOutcomeId, toOutcomeId, now }, ctx) => {
        assertWritable(ctx);
        if (!requiresOutcome(type)) {
          throw new AppError('InvalidOutcomeChange', `${type} checklists are not linked to outcomes`);
        }
        if (fromOutcomeId === toOutcomeId) {
          throw new AppError('InvalidOutcomeChange', 'The checklists are already under this outcome');
        }
        const toOutcome = tx.get('outcomes', toOutcomeId);
        if (!toOutcome) throw new AppError('NotFound', 'Target outcome not found');
        const fromOutcomeName = tx.get('outcomes', fromOutcomeId)?.name;

        const study = tx.get('studies', studyId);
        if (!study) throw new AppError('NotFound', `Study ${studyId} does not exist`);

        const movers = [];
        const targetAssignees = new Set<string | null>();
        for (const row of tx.list('checklists')) {
          if (row.data.studyId !== studyId || row.data.type !== type) continue;
          if (row.data.outcomeId === fromOutcomeId) movers.push(row.data);
          else if (row.data.outcomeId === toOutcomeId) targetAssignees.add(row.data.assignedTo);
        }

        if (movers.length === 0) {
          throw new AppError('NotFound', 'No checklists found for this outcome');
        }
        if (movers.some(checklist => checklist.status === CHECKLIST_STATUS.RECONCILING)) {
          throw new AppError(
            'ReconciliationInProgress',
            'Reconciliation is in progress for this outcome. Finish it before changing the outcome.',
          );
        }
        if (movers.some(checklist => targetAssignees.has(checklist.assignedTo))) {
          throw new AppError(
            'AssigneeConflict',
            'A checklist for the target outcome already exists for one of the reviewers',
          );
        }

        for (const mover of movers) {
          tx.put('checklists', mover.id, { ...mover, outcomeId: toOutcomeId, updatedAt: now });

          // Section A of ROBINS-I was auto-filled with the outcome name at
          // creation; keep it in sync only while it still matches the old name
          // so user-edited text is never overwritten.
          if (type === 'ROBINS_I' && fromOutcomeName) {
            const rowId = answerRowId(mover.id, 'sectionA.outcome');
            const answer = tx.get('answers', rowId);
            if (answer && answer.value === fromOutcomeName) {
              tx.put('answers', rowId, { ...answer, value: toOutcome.name });
            }
          }
        }

        const fromKey = getOutcomeKey(fromOutcomeId, type);
        const toKey = getOutcomeKey(toOutcomeId, type);
        const oldEntry = tx.get('reconciliations', reconciliationRowId(studyId, fromKey));
        if (oldEntry) {
          tx.put('reconciliations', reconciliationRowId(studyId, toKey), {
            ...oldEntry,
            id: reconciliationRowId(studyId, toKey),
            outcomeKey: toKey,
            outcomeId: toOutcomeId,
          });
          tx.del('reconciliations', reconciliationRowId(studyId, fromKey));
        }

        tx.put('studies', studyId, { ...study, updatedAt: now });
      },
    },

    'checklist.updateAnswer': {
      args: z.object({
        checklistId: z.string(),
        input: checklistAnswerInputSchema,
        now: timestamp,
      }),
      apply: (tx, { checklistId, input, now }, ctx) => {
        assertWritable(ctx);
        const checklist = tx.get('checklists', checklistId);
        if (!checklist) throw new AppError('NotFound', `Checklist ${checklistId} does not exist`);
        if (checklist.type !== input.type) {
          throw new AppError(
            'TypeMismatch',
            `Checklist ${checklistId} is ${checklist.type}; got a ${input.type} update`,
          );
        }

        for (const write of expandAnswerUpdate(input)) {
          tx.put('answers', answerRowId(checklistId, write.key), {
            id: answerRowId(checklistId, write.key),
            studyId: checklist.studyId,
            checklistId,
            key: write.key,
            value: write.value,
          });
        }

        tx.put('checklists', checklistId, {
          ...checklist,
          status:
            checklist.status === CHECKLIST_STATUS.PENDING
              ? CHECKLIST_STATUS.IN_PROGRESS
              : checklist.status,
          updatedAt: now,
        });
      },
    },

    'checklist.setText': {
      args: z.object({
        checklistId: z.string(),
        key: z.string().min(1),
        text: z.string(),
        maxLength: z.number().int().positive().default(DEFAULT_TEXT_MAX_LENGTH),
      }),
      apply: (tx, { checklistId, key, text, maxLength }, ctx) => {
        assertWritable(ctx);
        const checklist = tx.get('checklists', checklistId);
        if (!checklist) throw new AppError('NotFound', `Checklist ${checklistId} does not exist`);
        const value = text.length > maxLength ? text.substring(0, maxLength) : text;
        const rowId = answerRowId(checklistId, key);
        const existing = tx.get('answers', rowId);
        if (existing && existing.value === value) return;
        tx.put('answers', rowId, {
          id: rowId,
          studyId: checklist.studyId,
          checklistId,
          key,
          value,
        });
        // Deliberately no checklist.updatedAt bump: the Y.Doc plane's text
        // writes never bumped it either.
      },
    },

    'outcome.create': {
      args: z.object({
        id: z.string(),
        name: z.string(),
        createdBy: z.string(),
        now: timestamp,
      }),
      apply: (tx, { id, name, createdBy, now }, ctx) => {
        assertWritable(ctx);
        const trimmed = name.trim();
        if (!trimmed) throw new AppError('InvalidName', 'Outcome name cannot be empty');
        tx.put('outcomes', id, { id, name: trimmed, createdAt: now, createdBy });
      },
    },

    'outcome.update': {
      args: z.object({ id: z.string(), name: z.string() }),
      apply: (tx, { id, name }, ctx) => {
        assertWritable(ctx);
        const outcome = tx.get('outcomes', id);
        if (!outcome) throw new AppError('NotFound', `Outcome ${id} does not exist`);
        const trimmed = name.trim();
        if (!trimmed) throw new AppError('InvalidName', 'Outcome name cannot be empty');
        tx.put('outcomes', id, { ...outcome, name: trimmed });
      },
    },

    'outcome.delete': {
      args: z.object({ id: z.string() }),
      apply: (tx, { id }, ctx) => {
        assertWritable(ctx);
        for (const row of tx.list('checklists')) {
          if (row.data.outcomeId === id) {
            throw new AppError(
              'OutcomeInUse',
              'This outcome is assigned to existing checklists and cannot be deleted',
            );
          }
        }
        tx.del('outcomes', id);
      },
    },

    'pdf.attach': {
      args: z.object({
        studyId: z.string(),
        pdf: pdfInfoSchema,
        tag: pdfTagSchema.default('secondary'),
        now: timestamp,
      }),
      apply: (tx, { studyId, pdf, tag, now }, ctx) => {
        assertWritable(ctx);
        const study = tx.get('studies', studyId);
        if (!study) throw new AppError('NotFound', `Study ${studyId} does not exist`);

        // primary/protocol are exclusive per study: the current holder is
        // demoted to secondary, matching the old clearTag behavior.
        if (tag !== 'secondary') {
          for (const row of tx.list('pdfs')) {
            if (row.data.studyId === studyId && row.data.tag === tag) {
              tx.put('pdfs', row.id, { ...row.data, tag: 'secondary' });
            }
          }
        }

        tx.put('pdfs', pdf.id, {
          id: pdf.id,
          studyId,
          key: pdf.key,
          fileName: pdf.fileName,
          size: pdf.size,
          uploadedBy: pdf.uploadedBy,
          uploadedAt: pdf.uploadedAt ?? now,
          tag,
          ...(pdf.title && { title: pdf.title }),
          ...(pdf.firstAuthor && { firstAuthor: pdf.firstAuthor }),
          ...(pdf.publicationYear && { publicationYear: pdf.publicationYear }),
          ...(pdf.journal && { journal: pdf.journal }),
          ...(pdf.doi && { doi: pdf.doi }),
        });

        tx.put('studies', studyId, { ...study, updatedAt: now });
      },
    },

    'pdf.remove': {
      args: z.object({ pdfId: z.string(), now: timestamp }),
      apply: (tx, { pdfId, now }, ctx) => {
        assertWritable(ctx);
        const pdf = tx.get('pdfs', pdfId);
        if (!pdf) return;
        tx.del('pdfs', pdfId);
        touchStudy(tx, pdf.studyId, now);
      },
    },

    'pdf.updateTag': {
      args: z.object({ pdfId: z.string(), tag: pdfTagSchema, now: timestamp }),
      apply: (tx, { pdfId, tag, now }, ctx) => {
        assertWritable(ctx);
        const pdf = tx.get('pdfs', pdfId);
        if (!pdf) throw new AppError('NotFound', `PDF ${pdfId} does not exist`);
        if (tag !== 'secondary') {
          for (const row of tx.list('pdfs')) {
            if (row.id !== pdfId && row.data.studyId === pdf.studyId && row.data.tag === tag) {
              tx.put('pdfs', row.id, { ...row.data, tag: 'secondary' });
            }
          }
        }
        tx.put('pdfs', pdfId, { ...pdf, tag });
        touchStudy(tx, pdf.studyId, now);
      },
    },

    'pdf.updateMetadata': {
      args: z.object({
        pdfId: z.string(),
        metadata: pdfCitationMetadataSchema,
        now: timestamp,
      }),
      apply: (tx, { pdfId, metadata, now }, ctx) => {
        assertWritable(ctx);
        const pdf = tx.get('pdfs', pdfId);
        if (!pdf) throw new AppError('NotFound', `PDF ${pdfId} does not exist`);
        const merged: Record<string, unknown> = { ...pdf };
        for (const field of ['title', 'firstAuthor', 'publicationYear', 'journal', 'doi'] as const) {
          const value = metadata[field];
          if (value === undefined) continue;
          if (value) merged[field] = value;
          else delete merged[field];
        }
        tx.put('pdfs', pdfId, merged as typeof pdf);
        touchStudy(tx, pdf.studyId, now);
      },
    },

    'annotation.add': {
      args: z.object({
        id: z.string(),
        studyId: z.string(),
        checklistId: z.string(),
        pdfId: z.string(),
        type: z.string(),
        pageIndex: z.number(),
        embedPdfData: z.string(),
        createdBy: z.string().default('unknown'),
        now: timestamp,
      }),
      apply: (tx, { id, studyId, checklistId, pdfId, type, pageIndex, embedPdfData, createdBy, now }, ctx) => {
        assertWritable(ctx);
        tx.put('annotations', id, {
          id,
          studyId,
          checklistId,
          pdfId,
          type,
          pageIndex,
          embedPdfData,
          createdBy,
          createdAt: now,
          updatedAt: now,
        });
      },
    },

    'annotation.addBatch': {
      args: z.object({
        studyId: z.string(),
        checklistId: z.string(),
        pdfId: z.string(),
        annotations: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            pageIndex: z.number(),
            embedPdfData: z.string(),
          }),
        ),
        createdBy: z.string().default('unknown'),
        now: timestamp,
      }),
      apply: (tx, { studyId, checklistId, pdfId, annotations, createdBy, now }, ctx) => {
        assertWritable(ctx);
        for (const annotation of annotations) {
          tx.put('annotations', annotation.id, {
            ...annotation,
            studyId,
            checklistId,
            pdfId,
            createdBy,
            createdAt: now,
            updatedAt: now,
          });
        }
      },
    },

    'annotation.update': {
      args: z.object({
        id: z.string(),
        updates: z.object({
          type: z.string().optional(),
          pageIndex: z.number().optional(),
          embedPdfData: z.string(),
        }),
        now: timestamp,
      }),
      apply: (tx, { id, updates, now }, ctx) => {
        assertWritable(ctx);
        const annotation = tx.get('annotations', id);
        if (!annotation) throw new AppError('NotFound', `Annotation ${id} does not exist`);
        tx.put('annotations', id, {
          ...annotation,
          ...(updates.type !== undefined && { type: updates.type }),
          ...(updates.pageIndex !== undefined && { pageIndex: updates.pageIndex }),
          embedPdfData: updates.embedPdfData,
          updatedAt: now,
        });
      },
    },

    'annotation.delete': {
      args: z.object({ id: z.string() }),
      apply: (tx, { id }, ctx) => {
        assertWritable(ctx);
        tx.del('annotations', id);
      },
    },

    'annotation.clearForChecklist': {
      args: z.object({ checklistId: z.string() }),
      apply: (tx, { checklistId }, ctx) => {
        assertWritable(ctx);
        for (const row of tx.list('annotations')) {
          if (row.data.checklistId === checklistId) tx.del('annotations', row.id);
        }
      },
    },

    'annotation.merge': {
      args: z.object({
        targetChecklistId: z.string(),
        // The client enumerates what to copy and mints the new ids, so both
        // runs of the mutation clone the same set with the same identities.
        copies: z.array(z.object({ sourceAnnotationId: z.string(), newId: z.string() })),
        now: timestamp,
      }),
      apply: (tx, { targetChecklistId, copies, now }, ctx) => {
        assertWritable(ctx);
        for (const copy of copies) {
          const source = tx.get('annotations', copy.sourceAnnotationId);
          if (!source) continue;
          tx.put('annotations', copy.newId, {
            ...source,
            id: copy.newId,
            checklistId: targetChecklistId,
            embedPdfData: rewriteEmbedId(source.embedPdfData, copy.newId),
            mergedFrom: source.checklistId,
            updatedAt: now,
          });
        }
      },
    },

    'reconciliation.saveProgress': {
      args: z.object({
        studyId: z.string(),
        outcomeId: z.string().nullable(),
        type: CHECKLIST_TYPE,
        data: z.object({
          checklist1Id: z.string(),
          checklist2Id: z.string(),
          reconciledChecklistId: z.string().optional(),
          currentPage: z.number().optional(),
          viewMode: z.string().optional(),
        }),
        now: timestamp,
      }),
      apply: (tx, { studyId, outcomeId, type, data, now }, ctx) => {
        assertWritable(ctx);
        const study = tx.get('studies', studyId);
        if (!study) throw new AppError('NotFound', `Study ${studyId} does not exist`);
        const outcomeKey = getOutcomeKey(outcomeId, type);
        const id = reconciliationRowId(studyId, outcomeKey);
        const existing = tx.get('reconciliations', id);
        tx.put('reconciliations', id, {
          id,
          studyId,
          outcomeKey,
          outcomeId,
          type,
          checklist1Id: data.checklist1Id,
          checklist2Id: data.checklist2Id,
          reconciledChecklistId: data.reconciledChecklistId ?? existing?.reconciledChecklistId,
          currentPage: data.currentPage ?? existing?.currentPage,
          viewMode: data.viewMode ?? existing?.viewMode,
          updatedAt: now,
        });
        tx.put('studies', studyId, { ...study, updatedAt: now });
      },
    },

    'reconciliation.clearProgress': {
      args: z.object({
        studyId: z.string(),
        outcomeId: z.string().nullable(),
        type: CHECKLIST_TYPE,
        now: timestamp,
      }),
      apply: (tx, { studyId, outcomeId, type, now }, ctx) => {
        assertWritable(ctx);
        tx.del('reconciliations', reconciliationRowId(studyId, getOutcomeKey(outcomeId, type)));
        touchStudy(tx, studyId, now);
      },
    },
  },
  { authContext: authContextSchema },
);

/**
 * The serialized EmbedPDF payload carries its own id; a merged copy gets the
 * new id stitched in. An unparsable payload is copied verbatim rather than
 * failing the mutation.
 */
function rewriteEmbedId(embedPdfData: string, newId: string): string {
  try {
    const parsed = JSON.parse(embedPdfData) as Record<string, unknown>;
    return JSON.stringify({ ...parsed, id: newId });
  } catch {
    return embedPdfData;
  }
}

export type SyncMutators = typeof syncMutators;
