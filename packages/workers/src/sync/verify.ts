/**
 * Cutover invariant checks (CORATES-MAPPING.md §9): compare a project's
 * pre-freeze old-plane export against the engine's post-import export and
 * report every divergence. The cutover driver runs this per project and
 * refuses to unfreeze on violations; the workerd rehearsal test runs it
 * against a real WorkspaceDO.
 */

/* eslint-disable corates/corates-error-helpers -- cutover tooling:
   hard-fail assertions for the migration operator, not app domain errors */

import * as Y from 'yjs';
import {
  answerRowId,
  defaultAnswerRows,
  reconciliationRowId,
  textAnswerKeys,
  type ChecklistType,
} from '@corates/shared/sync';
import { CHECKLIST_STATUS, getOutcomeKey } from '@corates/shared/checklists';
import {
  normalizeChecklistStatus,
  oldExportSchema,
  remapLegacySectionBKeys,
  type OldProjectExport,
} from './transform';
import type { JsonValue } from '@corates/shared/sync';

export interface VerifyResult {
  ok: boolean;
  violations: string[];
  /** Non-fatal notes (dropped keys were already reported at transform time). */
  notes: string[];
}

interface EngineExport {
  rows: Array<{ tbl: string; id: string; data: Record<string, unknown> }>;
  extension?: { fields: Record<string, string> };
}

const FIELD_TEXT_KEY = 't';

function fromBase64(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  const nodeBuffer = (
    globalThis as { Buffer?: { from(value: string, encoding: string): Uint8Array } }
  ).Buffer;
  if (!nodeBuffer) throw new Error('fromBase64: no atob and no Buffer available');
  return nodeBuffer.from(value, 'base64');
}

function decodeFieldText(encoded: string): string {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, fromBase64(encoded));
  const text = doc.getText(FIELD_TEXT_KEY).toString();
  doc.destroy();
  return text;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Verify one project: `oldExport` is the patched pre-freeze export,
 * `engineExport` the engine's export after import.
 */
export function verifyProjectMigration(oldExport: unknown, engineExport: unknown): VerifyResult {
  const violations: string[] = [];
  const notes: string[] = [];

  const parsedOld = oldExportSchema.safeParse(oldExport);
  if (!parsedOld.success) {
    return { ok: false, violations: [`old export failed validation: ${parsedOld.error.message}`], notes };
  }
  const old: OldProjectExport = parsedOld.data;
  const engine = engineExport as EngineExport;
  if (!engine || !Array.isArray(engine.rows)) {
    return { ok: false, violations: ['engine export has no rows array'], notes };
  }

  const byTable = new Map<string, Map<string, Record<string, unknown>>>();
  for (const row of engine.rows) {
    let table = byTable.get(row.tbl);
    if (!table) {
      table = new Map();
      byTable.set(row.tbl, table);
    }
    table.set(row.id, row.data);
  }
  const table = (name: string) => byTable.get(name) ?? new Map<string, Record<string, unknown>>();

  // --- outcomes
  const outcomes = Object.entries(old.meta.outcomes ?? {});
  if (table('outcomes').size !== outcomes.length) {
    violations.push(`outcomes: expected ${outcomes.length}, engine has ${table('outcomes').size}`);
  }
  for (const [outcomeId, outcome] of outcomes) {
    const row = table('outcomes').get(outcomeId);
    if (!row) violations.push(`outcome ${outcomeId} missing`);
    else if (row.name !== outcome.name) {
      violations.push(`outcome ${outcomeId} name: "${outcome.name}" → "${String(row.name)}"`);
    }
  }

  // --- studies
  if (table('studies').size !== old.studies.length) {
    violations.push(`studies: expected ${old.studies.length}, engine has ${table('studies').size}`);
  }

  let expectedChecklists = 0;
  let expectedPdfs = 0;
  let expectedAnnotations = 0;
  let expectedReconciliations = 0;

  for (const study of old.studies) {
    const studyRow = table('studies').get(study.id);
    if (!studyRow) {
      violations.push(`study ${study.id} missing`);
      continue;
    }
    // Expected values mirror the transformer's write conditions exactly:
    // strings are written only when truthy, pdfAccessible when non-null,
    // publicationYear is stringified.
    const expectedStudyFields: Array<[string, unknown]> = [
      ['name', study.name ?? 'Untitled Study'],
      ['reviewer1', study.reviewer1 || undefined],
      ['reviewer2', study.reviewer2 || undefined],
      ['doi', study.doi || undefined],
      ['originalTitle', study.originalTitle || undefined],
      ['firstAuthor', study.firstAuthor || undefined],
      [
        'publicationYear',
        study.publicationYear != null ? String(study.publicationYear) : undefined,
      ],
      ['authors', study.authors || undefined],
      ['journal', study.journal || undefined],
      ['abstract', study.abstract || undefined],
      ['importSource', study.importSource || undefined],
      ['pdfUrl', study.pdfUrl || undefined],
      ['pdfSource', study.pdfSource || undefined],
      ['pdfAccessible', study.pdfAccessible ?? undefined],
      ['pmid', study.pmid || undefined],
      ['url', study.url || undefined],
      ['volume', study.volume || undefined],
      ['issue', study.issue || undefined],
      ['pages', study.pages || undefined],
      ['type', study.type || undefined],
    ];
    for (const [field, expected] of expectedStudyFields) {
      if (expected !== undefined && studyRow[field] !== expected) {
        violations.push(`study ${study.id} ${field}: "${String(expected)}" → "${String(studyRow[field])}"`);
      }
    }

    const checklistById = new Map(study.checklists.map(checklist => [checklist.id, checklist]));

    for (const checklist of study.checklists) {
      expectedChecklists++;
      const type = checklist.type as ChecklistType;
      const row = table('checklists').get(checklist.id);
      if (!row) {
        violations.push(`checklist ${checklist.id} missing`);
        continue;
      }
      if (row.type !== type) violations.push(`checklist ${checklist.id} type mismatch`);
      if (row.status !== normalizeChecklistStatus(checklist.status)) {
        violations.push(
          `checklist ${checklist.id} status: "${checklist.status}" → "${String(row.status)}"`,
        );
      }
      if ((row.assignedTo ?? null) !== (checklist.assignedTo ?? null)) {
        violations.push(`checklist ${checklist.id} assignedTo mismatch`);
      }
      if ((row.outcomeId ?? null) !== (checklist.outcomeId ?? null)) {
        violations.push(`checklist ${checklist.id} outcomeId mismatch`);
      }

      // Answers: every default key exists as a row; every exported flat value
      // survives exactly. (Nested legacy answers are compared by the keys the
      // transformer reported — the workerd rehearsal covers that path.)
      const defaults = defaultAnswerRows(type);
      let answerRows = 0;
      for (const key of Object.keys(defaults)) {
        if (!table('answers').has(answerRowId(checklist.id, key))) {
          violations.push(`checklist ${checklist.id} missing answer row "${key}"`);
        } else {
          answerRows++;
        }
      }
      // Same legacy-alias salvage the transformer applies (`b1.comment` →
      // `sectionB.b1.comment`), so the salvaged text is verified rather than
      // skipped as a dropped key.
      const exportedAnswers = remapLegacySectionBKeys(
        checklist.answers as Record<string, JsonValue>,
        defaults,
      );
      for (const [key, value] of Object.entries(exportedAnswers)) {
        if (!(key in defaults)) continue; // dropped by design, reported at transform
        const row = table('answers').get(answerRowId(checklist.id, key));
        if (row && !deepEqual(row.value, value)) {
          violations.push(
            `checklist ${checklist.id} answer "${key}": ${stableStringify(value).slice(0, 80)} → ${stableStringify(row.value).slice(0, 80)}`,
          );
        }
      }
      notes.push(`checklist ${checklist.id}: ${answerRows}/${Object.keys(defaults).length} answer rows`);
    }

    for (const pdf of study.pdfs) {
      expectedPdfs++;
      const id = pdf.id ?? `pdf:${pdf.key}`;
      const row = table('pdfs').get(id);
      if (!row) violations.push(`pdf ${id} missing`);
      else if (row.key !== pdf.key || row.fileName !== pdf.fileName) {
        violations.push(`pdf ${id} key/fileName mismatch`);
      }
    }

    for (const [checklistId, annotations] of Object.entries(study.annotations ?? {})) {
      for (const [annotationId, annotation] of Object.entries(annotations)) {
        expectedAnnotations++;
        const id = annotation.id ?? annotationId;
        const row = table('annotations').get(id);
        if (!row) violations.push(`annotation ${id} (checklist ${checklistId}) missing`);
      }
    }

    for (const progress of Object.values(study.reconciliations ?? {})) {
      expectedReconciliations++;
      const outcomeKey = getOutcomeKey(progress.outcomeId ?? null, progress.type);
      const id = reconciliationRowId(study.id, outcomeKey);
      const row = table('reconciliations').get(id);
      if (!row) {
        violations.push(`reconciliation ${id} missing`);
        continue;
      }
      if (
        row.checklist1Id !== progress.checklist1Id ||
        row.checklist2Id !== progress.checklist2Id ||
        (row.reconciledChecklistId ?? undefined) !== progress.reconciledChecklistId
      ) {
        violations.push(`reconciliation ${id} checklist ids mismatch`);
      }

      // In-progress consolidated notes must be readable back out of the Yjs
      // field seeds, character for character.
      const consensus = progress.reconciledChecklistId ?
        checklistById.get(progress.reconciledChecklistId)
      : undefined;
      if (consensus && normalizeChecklistStatus(consensus.status) !== CHECKLIST_STATUS.FINALIZED) {
        const type = consensus.type as ChecklistType;
        const consensusAnswers = remapLegacySectionBKeys(
          consensus.answers as Record<string, JsonValue>,
          defaultAnswerRows(type),
        );
        for (const textKey of textAnswerKeys(type)) {
          const text = consensusAnswers[textKey];
          if (typeof text !== 'string' || text.length === 0) continue;
          const fieldId = answerRowId(consensus.id, textKey);
          const encoded = engine.extension?.fields?.[fieldId];
          if (!encoded) {
            violations.push(`field seed ${fieldId} missing`);
            continue;
          }
          const decoded = decodeFieldText(encoded);
          if (decoded !== text) {
            violations.push(
              `field ${fieldId} text mismatch: "${text.slice(0, 40)}" → "${decoded.slice(0, 40)}"`,
            );
          }
        }
      }
    }
  }

  if (table('checklists').size !== expectedChecklists) {
    violations.push(
      `checklists: expected ${expectedChecklists}, engine has ${table('checklists').size}`,
    );
  }
  if (table('pdfs').size !== expectedPdfs) {
    violations.push(`pdfs: expected ${expectedPdfs}, engine has ${table('pdfs').size}`);
  }
  if (table('annotations').size !== expectedAnnotations) {
    violations.push(
      `annotations: expected ${expectedAnnotations}, engine has ${table('annotations').size}`,
    );
  }
  if (table('reconciliations').size !== expectedReconciliations) {
    violations.push(
      `reconciliations: expected ${expectedReconciliations}, engine has ${table('reconciliations').size}`,
    );
  }

  return { ok: violations.length === 0, violations, notes };
}
