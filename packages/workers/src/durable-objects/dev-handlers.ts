/**
 * Dev-only handlers for Yjs state inspection and manipulation.
 * Dynamically imported only when DEV_MODE is enabled to keep production bundle small.
 */
import * as Y from 'yjs';
import {
  getTemplate,
  getTemplateNames,
  getTemplateDescriptions,
  generateAMSTAR2Answers,
  generateROBINSIAnswers,
  generateROB2Answers,
} from '../lib/mock-templates';
import { CHECKLIST_STATUS } from '@corates/shared';
import { buildMemberYMap } from './ProjectDoc';

interface DevContext {
  doc: Y.Doc;
  stateId: string;
  yMapToPlain: (_map: Y.Map<unknown>) => Record<string, unknown>;
}

interface ExportData {
  version: number;
  exportedAt: string;
  projectId: string;
  meta: Record<string, unknown>;
  members: Array<{ userId: string; [key: string]: unknown }>;
  studies: Study[];
}

interface Study {
  id: string;
  name?: unknown;
  description?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  originalTitle?: unknown;
  firstAuthor?: unknown;
  publicationYear?: unknown;
  authors?: unknown;
  journal?: unknown;
  doi?: unknown;
  abstract?: unknown;
  pdfUrl?: unknown;
  pdfSource?: unknown;
  pdfAccessible?: unknown;
  reviewer1?: unknown;
  reviewer2?: unknown;
  checklists: Checklist[];
  pdfs: Pdf[];
  reconciliation?: unknown;
}

interface Checklist {
  id: string;
  type?: unknown;
  title?: unknown;
  assignedTo?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  answers?: Record<string, unknown>;
}

interface Pdf {
  fileName: string;
  key?: unknown;
  size?: unknown;
  uploadedBy?: unknown;
  uploadedAt?: unknown;
}

interface ImportData {
  meta?: Record<string, unknown>;
  members?: Array<{
    userId: string;
    role?: string;
    joinedAt?: string;
    name?: string | null;
    email?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    image?: string | null;
  }>;
  studies?: Array<{
    id: string;
    name?: unknown;
    description?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    originalTitle?: unknown;
    firstAuthor?: unknown;
    publicationYear?: unknown;
    authors?: unknown;
    journal?: unknown;
    doi?: unknown;
    abstract?: unknown;
    pdfUrl?: unknown;
    pdfSource?: unknown;
    pdfAccessible?: unknown;
    reviewer1?: unknown;
    reviewer2?: unknown;
    reconciliation?: Record<string, unknown>;
    checklists?: Array<{
      id: string;
      type?: string;
      title?: string | null;
      assignedTo?: string | null;
      status?: string;
      createdAt?: string;
      updatedAt?: string;
      outcomeId?: string | null;
      answers?: Record<string, unknown>;
    }>;
    pdfs?: Array<{
      fileName: string;
      key?: string;
      size?: number;
      uploadedBy?: string;
      uploadedAt?: string;
    }>;
  }>;
}

interface ImportRequest {
  json(): Promise<{
    data?: ImportData;
    mode?: 'replace' | 'merge';
    targetOrgId?: string;
    userMapping?: Record<string, string>;
    importer?: {
      userId?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }>;
}

/**
 * Remap user IDs throughout import data using the provided mapping.
 * Only remaps IDs that have an entry in the mapping -- unmapped IDs are left as-is.
 */
function remapUserIds(data: ImportData, mapping: Record<string, string>): ImportData {
  const remapped = JSON.parse(JSON.stringify(data)) as ImportData;

  if (remapped.members) {
    remapped.members = remapped.members.map(m => ({
      ...m,
      userId: mapping[m.userId] || m.userId,
    }));
  }

  if (remapped.studies) {
    for (const study of remapped.studies) {
      if (study.reviewer1 && mapping[study.reviewer1 as string]) {
        study.reviewer1 = mapping[study.reviewer1 as string];
      }
      if (study.reviewer2 && mapping[study.reviewer2 as string]) {
        study.reviewer2 = mapping[study.reviewer2 as string];
      }

      for (const cl of study.checklists || []) {
        if (cl.assignedTo && mapping[cl.assignedTo]) {
          cl.assignedTo = mapping[cl.assignedTo];
        }
      }

      for (const pdf of study.pdfs || []) {
        if (pdf.uploadedBy && mapping[pdf.uploadedBy]) {
          pdf.uploadedBy = mapping[pdf.uploadedBy];
        }
      }
    }
  }

  return remapped;
}

interface PatchOperation {
  path: string;
  value: unknown;
}

interface PatchResult {
  path: string;
  success: boolean;
  error?: string;
}

/**
 * Export the full Y.Doc state as JSON
 */
export async function handleDevExport(ctx: DevContext): Promise<Response> {
  const { doc, stateId, yMapToPlain } = ctx;

  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projectId: stateId,
    meta: yMapToPlain(doc.getMap('meta')),
    members: [],
    studies: [],
  };

  // Export members
  const membersMap = doc.getMap('members');
  for (const [userId, value] of membersMap.entries()) {
    exportData.members.push({
      userId,
      ...yMapToPlain(value as Y.Map<unknown>),
    });
  }

  // Export studies (reviews) with nested checklists and pdfs
  const reviewsMap = doc.getMap('reviews');
  for (const [studyId, studyValue] of reviewsMap.entries()) {
    const studyYMap = studyValue as Y.Map<unknown>;
    const studyData = yMapToPlain(studyYMap);
    const study: Study = {
      id: studyId,
      name: studyData.name,
      description: studyData.description,
      createdAt: studyData.createdAt,
      updatedAt: studyData.updatedAt,
      originalTitle: studyData.originalTitle,
      firstAuthor: studyData.firstAuthor,
      publicationYear: studyData.publicationYear,
      authors: studyData.authors,
      journal: studyData.journal,
      doi: studyData.doi,
      abstract: studyData.abstract,
      pdfUrl: studyData.pdfUrl,
      pdfSource: studyData.pdfSource,
      pdfAccessible: studyData.pdfAccessible,
      reviewer1: studyData.reviewer1,
      reviewer2: studyData.reviewer2,
      checklists: [],
      pdfs: [],
      reconciliation: studyData.reconciliation || null,
    };

    // Export checklists
    const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
    if (checklistsMap && checklistsMap.entries) {
      for (const [checklistId, checklistValue] of checklistsMap.entries()) {
        const checklistData = yMapToPlain(checklistValue as Y.Map<unknown>);
        study.checklists.push({
          id: checklistId,
          type: checklistData.type,
          title: checklistData.title,
          assignedTo: checklistData.assignedTo,
          status: checklistData.status || 'pending',
          createdAt: checklistData.createdAt,
          updatedAt: checklistData.updatedAt,
          answers: (checklistData.answers as Record<string, unknown>) || {},
        });
      }
    }

    // Export PDFs
    const pdfsMap = studyYMap.get('pdfs') as Y.Map<unknown> | undefined;
    if (pdfsMap && pdfsMap.entries) {
      for (const [fileName, pdfValue] of pdfsMap.entries()) {
        const pdfData = yMapToPlain(pdfValue as Y.Map<unknown>);
        study.pdfs.push({
          fileName,
          key: pdfData.key,
          size: pdfData.size,
          uploadedBy: pdfData.uploadedBy,
          uploadedAt: pdfData.uploadedAt,
        });
      }
    }

    exportData.studies.push(study);
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Build the checklist `answers` Y.Map.
 *
 * IMPORTANT: the web checklist handlers (packages/web/.../checklists/handlers/
 * {amstar2,rob2,robins-i}.ts) store answers as a FLAT, dotted-key Y.Map -- e.g.
 * `preliminary.aim`, `d1_1`, `d1_1.comment`, `domain1.direction`, `q1.answers`,
 * with Y.Text for every free-text field. Their `serializeAnswers` only reads
 * dotted keys, so a nested structure deserializes to `{}` (empty answers and a
 * null score). This builder mirrors each handler's `createAnswersYMap` exactly.
 *
 * Two input shapes are supported:
 *  - generator/nested (mock templates): { preliminary: { aim, ... }, domain1: { answers, direction }, ... }
 *  - already-flat (exported project JSON): { 'preliminary.aim': ..., 'd1_1': ..., ... }
 */
function importAnswers(answers: Record<string, unknown>, checklistType: string): Y.Map<unknown> {
  const isAlreadyFlat = Object.keys(answers).some(k => k.includes('.'));
  return isAlreadyFlat ? buildFlatAnswersYMap(answers) : buildAnswersYMap(answers, checklistType);
}

// Free-text fields are stored as Y.Text; everything else is a plain value.
function mkText(value: unknown): Y.Text {
  const text = new Y.Text();
  if (typeof value === 'string' && value.length > 0) text.insert(0, value);
  return text;
}

// Keys (or key suffixes) whose values are Y.Text across all checklist handlers.
const FLAT_TEXT_FIELD_KEYS = new Set([
  'preliminary.experimental',
  'preliminary.comparator',
  'preliminary.numericalResult',
  'planning.confoundingFactors',
  'sectionA.numericalResult',
  'sectionA.furtherDetails',
  'sectionA.outcome',
  'sectionC.participants',
  'sectionC.interventionStrategy',
  'sectionC.comparatorStrategy',
  'sectionD.otherSpecify',
]);

function isFlatTextKey(key: string): boolean {
  return key.endsWith('.note') || key.endsWith('.comment') || FLAT_TEXT_FIELD_KEYS.has(key);
}

// Re-import already-flat (exported) answers, restoring Y.Text for text fields.
function buildFlatAnswersYMap(answers: Record<string, unknown>): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(answers)) {
    map.set(key, isFlatTextKey(key) ? mkText(value) : value);
  }
  return map;
}

// Convert the generator's nested answer object into the flat Y.Map the handlers read.
function buildAnswersYMap(answers: Record<string, unknown>, checklistType: string): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  if (checklistType === 'AMSTAR2') {
    buildAmstar2Answers(map, answers);
  } else if (checklistType === 'ROB2') {
    buildRob2Answers(map, answers);
  } else if (checklistType === 'ROBINS_I') {
    buildRobinsIAnswers(map, answers);
  }
  return map;
}

function buildAmstar2Answers(map: Y.Map<unknown>, answers: Record<string, unknown>): void {
  const subQuestionPattern = /^(q9|q11)[a-z]$/;
  const added = new Set<string>();
  for (const [q, qdRaw] of Object.entries(answers)) {
    const qd = qdRaw as { answers?: unknown; critical?: boolean };
    map.set(`${q}.answers`, qd.answers);
    map.set(`${q}.critical`, qd.critical ?? false);
    if (!subQuestionPattern.test(q)) map.set(`${q}.note`, new Y.Text());
    added.add(q);
  }
  for (const parent of ['q9', 'q11']) {
    if (!added.has(parent)) map.set(`${parent}.note`, new Y.Text());
  }
}

function buildRob2Answers(map: Y.Map<unknown>, answers: Record<string, unknown>): void {
  for (const [key, valRaw] of Object.entries(answers)) {
    const val = valRaw as Record<string, unknown>;
    if (key === 'preliminary') {
      map.set('preliminary.aim', val.aim ?? null);
      map.set('preliminary.studyDesign', val.studyDesign ?? null);
      map.set('preliminary.deviationsToAddress', val.deviationsToAddress ?? []);
      map.set('preliminary.sources', val.sources ?? {});
      map.set('preliminary.experimental', mkText(val.experimental));
      map.set('preliminary.comparator', mkText(val.comparator));
      map.set('preliminary.numericalResult', mkText(val.numericalResult));
    } else if (key === 'overall') {
      map.set('overall.direction', val.direction ?? null);
    } else if (key.startsWith('domain')) {
      // ROB2 judgements are computed from answers, so only the direction is stored.
      if (val.direction !== undefined) map.set(`${key}.direction`, val.direction ?? null);
      setDomainQuestions(map, val.answers);
    }
  }
}

function buildRobinsIAnswers(map: Y.Map<unknown>, answers: Record<string, unknown>): void {
  for (const [key, valRaw] of Object.entries(answers)) {
    const val = valRaw as Record<string, unknown>;
    if (key === 'planning') {
      map.set('planning.confoundingFactors', mkText(val.confoundingFactors));
    } else if (key === 'sectionA') {
      map.set('sectionA.numericalResult', mkText(val.numericalResult));
      map.set('sectionA.furtherDetails', mkText(val.furtherDetails));
      map.set('sectionA.outcome', mkText(val.outcome));
    } else if (key === 'sectionB') {
      for (const [subKey, subValRaw] of Object.entries(val)) {
        if (typeof subValRaw === 'object' && subValRaw !== null) {
          map.set(`sectionB.${subKey}`, (subValRaw as { answer?: unknown }).answer ?? null);
          map.set(`sectionB.${subKey}.comment`, new Y.Text());
        } else {
          map.set(`sectionB.${subKey}`, subValRaw);
        }
      }
    } else if (key === 'sectionC') {
      map.set('sectionC.isPerProtocol', val.isPerProtocol ?? false);
      map.set('sectionC.participants', mkText(val.participants));
      map.set('sectionC.interventionStrategy', mkText(val.interventionStrategy));
      map.set('sectionC.comparatorStrategy', mkText(val.comparatorStrategy));
    } else if (key === 'sectionD') {
      map.set('sectionD.sources', val.sources ?? {});
      map.set('sectionD.otherSpecify', mkText(val.otherSpecify));
    } else if (key === 'confoundingEvaluation') {
      map.set('confoundingEvaluation.predefined', val.predefined ?? []);
      map.set('confoundingEvaluation.additional', val.additional ?? []);
    } else if (key.startsWith('domain') || key === 'overall') {
      if (val.direction !== undefined) map.set(`${key}.direction`, val.direction ?? null);
      map.set(`${key}.judgement`, val.judgement ?? null);
      setDomainQuestions(map, val.answers);
    }
  }
}

// Domain question answers are stored as bare keys (e.g. `d1_1`) plus a Y.Text comment.
function setDomainQuestions(map: Y.Map<unknown>, domainAnswers: unknown): void {
  if (!domainAnswers || typeof domainAnswers !== 'object') return;
  for (const [qKey, qVal] of Object.entries(domainAnswers as Record<string, unknown>)) {
    map.set(qKey, (qVal as { answer?: unknown }).answer ?? null);
    map.set(`${qKey}.comment`, new Y.Text());
  }
}

/**
 * Import Y.Doc state from JSON
 * mode: 'replace' (clear existing state) or 'merge' (deep merge)
 * targetOrgId: if provided, overrides the orgId in imported data (prevents org mismatch)
 * importer: current user info - will be added as member if not already in the data
 */
export async function handleDevImport(ctx: DevContext, request: ImportRequest): Promise<Response> {
  const { doc } = ctx;

  try {
    const {
      data: rawData,
      mode = 'replace',
      targetOrgId,
      userMapping,
      importer,
    } = await request.json();

    if (!rawData) {
      return new Response(JSON.stringify({ error: 'Missing data field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Apply user ID remapping if provided
    const data =
      userMapping && Object.keys(userMapping).length > 0 ?
        remapUserIds(rawData, userMapping)
      : rawData;

    doc.transact(() => {
      const metaMap = doc.getMap('meta');
      const membersMap = doc.getMap('members');
      const reviewsMap = doc.getMap('reviews');

      if (mode === 'replace') {
        metaMap.clear();
        if (data.members) membersMap.clear();
        reviewsMap.clear();
      }

      // Import meta, but override orgId if targetOrgId is provided
      if (data.meta) {
        for (const [key, value] of Object.entries(data.meta)) {
          if (key === 'orgId' && targetOrgId) {
            metaMap.set('orgId', targetOrgId);
          } else if (key === 'outcomes' && value && typeof value === 'object') {
            // Outcomes must be a nested Y.Map so the client can read them via
            // metaMap.get('outcomes').get(outcomeId).
            const outcomesMap = new Y.Map<unknown>();
            for (const [outcomeId, outcomeData] of Object.entries(
              value as Record<string, unknown>,
            )) {
              const outcomeYMap = new Y.Map<unknown>();
              for (const [ok, ov] of Object.entries(outcomeData as Record<string, unknown>)) {
                outcomeYMap.set(ok, ov);
              }
              outcomesMap.set(outcomeId, outcomeYMap);
            }
            metaMap.set('outcomes', outcomesMap);
          } else {
            metaMap.set(key, value);
          }
        }
        // Ensure orgId is set even if not in imported data
        if (targetOrgId && !data.meta.orgId) {
          metaMap.set('orgId', targetOrgId);
        }
      }

      // Import members
      if (data.members) {
        for (const member of data.members) {
          membersMap.set(member.userId, buildMemberYMap(member));
        }
      }

      // Add importer as member if not already present
      if (importer?.userId && !membersMap.has(importer.userId)) {
        membersMap.set(
          importer.userId,
          buildMemberYMap({
            role: 'owner',
            joinedAt: new Date().toISOString(),
            name: importer.name || null,
            email: importer.email || null,
            image: importer.image || null,
          }),
        );
      }

      // Import studies
      if (data.studies) {
        for (const study of data.studies) {
          let studyYMap: Y.Map<unknown>;

          if (mode === 'merge' && reviewsMap.has(study.id)) {
            studyYMap = reviewsMap.get(study.id) as Y.Map<unknown>;
          } else {
            studyYMap = new Y.Map<unknown>();
            reviewsMap.set(study.id, studyYMap);
          }

          // Set study fields
          const studyFields = [
            'name',
            'description',
            'createdAt',
            'updatedAt',
            'originalTitle',
            'firstAuthor',
            'publicationYear',
            'authors',
            'journal',
            'doi',
            'abstract',
            'pdfUrl',
            'pdfSource',
            'pdfAccessible',
            'reviewer1',
            'reviewer2',
          ] as const;

          for (const field of studyFields) {
            const value = study[field];
            if (value !== undefined) {
              studyYMap.set(field, value);
            }
          }

          // Import reconciliation if present
          if (study.reconciliation) {
            const reconYMap = new Y.Map<unknown>();
            for (const [key, value] of Object.entries(study.reconciliation)) {
              reconYMap.set(key, value);
            }
            studyYMap.set('reconciliation', reconYMap);
          }

          // Import checklists
          if (study.checklists && study.checklists.length > 0) {
            let checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
            if (!checklistsMap) {
              checklistsMap = new Y.Map<unknown>();
              studyYMap.set('checklists', checklistsMap);
            }

            for (const checklist of study.checklists) {
              let checklistYMap: Y.Map<unknown>;

              if (mode === 'merge' && checklistsMap.has(checklist.id)) {
                checklistYMap = checklistsMap.get(checklist.id) as Y.Map<unknown>;
              } else {
                checklistYMap = new Y.Map<unknown>();
                checklistsMap.set(checklist.id, checklistYMap);
              }

              checklistYMap.set('type', checklist.type);
              checklistYMap.set('title', checklist.title || null);
              checklistYMap.set('assignedTo', checklist.assignedTo || null);
              checklistYMap.set('status', checklist.status || 'pending');
              checklistYMap.set('createdAt', checklist.createdAt);
              checklistYMap.set('updatedAt', checklist.updatedAt);
              // ROB2/ROBINS-I checklists are keyed to an outcome; without it the
              // reconciliation flow cannot pair the two reviewer checklists.
              if (checklist.outcomeId) {
                checklistYMap.set('outcomeId', checklist.outcomeId);
              }

              // Import answers
              if (checklist.answers) {
                const answersYMap = importAnswers(checklist.answers, checklist.type || '');
                checklistYMap.set('answers', answersYMap);
              }
            }
          }

          // Import PDFs
          if (study.pdfs && study.pdfs.length > 0) {
            let pdfsMap = studyYMap.get('pdfs') as Y.Map<unknown> | undefined;
            if (!pdfsMap) {
              pdfsMap = new Y.Map<unknown>();
              studyYMap.set('pdfs', pdfsMap);
            }

            for (const pdf of study.pdfs) {
              const pdfYMap = new Y.Map<unknown>();
              pdfYMap.set('key', pdf.key);
              pdfYMap.set('fileName', pdf.fileName);
              pdfYMap.set('size', pdf.size);
              pdfYMap.set('uploadedBy', pdf.uploadedBy);
              pdfYMap.set('uploadedAt', pdf.uploadedAt);
              pdfsMap.set(pdf.fileName, pdfYMap);
            }
          }
        }
      }
    });

    return new Response(JSON.stringify({ success: true, mode }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const err = error as Error;
    console.error('handleDevImport error:', error);
    return new Response(JSON.stringify({ error: 'Import failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Apply surgical patches to specific paths in Y.Doc
 * Format: { operations: [{ path: "studies.id.name", value: "New Name" }] }
 */
export async function handleDevPatch(ctx: DevContext, request: Request): Promise<Response> {
  const { doc } = ctx;

  try {
    const { operations } = (await request.json()) as { operations?: PatchOperation[] };

    if (!operations || !Array.isArray(operations)) {
      return new Response(JSON.stringify({ error: 'Missing operations array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: PatchResult[] = [];

    doc.transact(() => {
      for (const op of operations) {
        try {
          const pathParts = op.path.split('.');
          let target: Y.Doc | Y.Map<unknown> = doc;

          // Navigate to the parent of the target
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];

            // Map root keys to Yjs map names
            if (i === 0) {
              if (part === 'meta') {
                target = doc.getMap('meta');
              } else if (part === 'members') {
                target = doc.getMap('members');
              } else if (part === 'studies') {
                target = doc.getMap('reviews');
              } else {
                // eslint-disable-next-line corates/corates-error-helpers -- thrown as exception in dev-only code
                throw new Error(`Unknown root path: ${part}`);
              }
            } else {
              const yMap = target as Y.Map<unknown>;
              const next = yMap.get(part);
              if (!next) {
                // eslint-disable-next-line corates/corates-error-helpers -- thrown as exception in dev-only code
                throw new Error(`Path not found: ${pathParts.slice(0, i + 1).join('.')}`);
              }
              target = next as Y.Map<unknown>;
            }
          }

          // Set the value at the final key
          const finalKey = pathParts[pathParts.length - 1];
          if (target && typeof (target as Y.Map<unknown>).set === 'function') {
            (target as Y.Map<unknown>).set(finalKey, op.value);
            results.push({ path: op.path, success: true });
          } else {
            results.push({ path: op.path, success: false, error: 'Invalid target' });
          }
        } catch (err) {
          const error = err as Error;
          results.push({ path: op.path, success: false, error: error.message });
        }
      }
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const err = error as Error;
    console.error('handleDevPatch error:', error);
    return new Response(JSON.stringify({ error: 'Patch failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Reset Y.Doc to empty state
 */
export async function handleDevReset(ctx: DevContext): Promise<Response> {
  const { doc } = ctx;

  try {
    doc.transact(() => {
      doc.getMap('meta').clear();
      doc.getMap('members').clear();
      doc.getMap('reviews').clear();
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const err = error as Error;
    console.error('handleDevReset error:', error);
    return new Response(JSON.stringify({ error: 'Reset failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get raw Yjs binary state for low-level debugging
 */
export async function handleDevRaw(ctx: DevContext): Promise<Response> {
  const { doc } = ctx;

  try {
    const state = Y.encodeStateAsUpdate(doc);
    const base64 = btoa(String.fromCharCode(...state));

    return new Response(
      JSON.stringify({
        format: 'base64',
        size: state.length,
        data: base64,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const err = error as Error;
    console.error('handleDevRaw error:', error);
    return new Response(JSON.stringify({ error: 'Raw export failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Add a single study with filled checklists and optional reconciliation.
 * Generates answers using the appropriate checklist generator.
 */
export async function handleDevAddStudy(ctx: DevContext, request: Request): Promise<Response> {
  const { doc } = ctx;

  try {
    const body = (await request.json()) as {
      type: 'AMSTAR2' | 'ROB2' | 'ROBINS_I';
      fillMode?: 'random' | 'all-yes' | 'mixed';
      reviewer1: string;
      reviewer2: string;
      reconcile?: boolean;
      outcomeId?: string | null;
    };

    const {
      type,
      fillMode = 'random',
      reviewer1,
      reviewer2,
      reconcile = true,
      outcomeId: requestedOutcomeId,
    } = body;

    if (!type || !reviewer1 || !reviewer2) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, reviewer1, reviewer2' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (reviewer1 === reviewer2) {
      return new Response(
        JSON.stringify({ error: 'reviewer1 and reviewer2 must be different users' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date().toISOString();
    const seed1 = Date.now();
    const seed2 = seed1 + 9999;
    const studyId = `gen_${crypto.randomUUID().slice(0, 8)}`;
    const checklist1Id = `gen_cl1_${crypto.randomUUID().slice(0, 8)}`;
    const checklist2Id = `gen_cl2_${crypto.randomUUID().slice(0, 8)}`;
    const reconciledChecklistId = reconcile ? `gen_rec_${crypto.randomUUID().slice(0, 8)}` : null;

    // Determine outcome ID for ROB2/ROBINS_I
    const requiresOutcome = type === 'ROB2' || type === 'ROBINS_I';
    let outcomeId: string | null = null;

    doc.transact(() => {
      const reviewsMap = doc.getMap('reviews');
      const metaMap = doc.getMap('meta');

      // Handle outcome creation/selection for ROB2/ROBINS_I
      if (requiresOutcome) {
        if (requestedOutcomeId && requestedOutcomeId !== '__auto__') {
          outcomeId = requestedOutcomeId;
        } else {
          // Auto-create a new outcome
          let outcomesMap = metaMap.get('outcomes') as Y.Map<Y.Map<unknown>> | undefined;
          if (!outcomesMap) {
            outcomesMap = new Y.Map();
            metaMap.set('outcomes', outcomesMap);
          }
          const existingCount = outcomesMap.size;
          outcomeId = `gen_outcome_${crypto.randomUUID().slice(0, 8)}`;
          const outcomeYMap = new Y.Map<unknown>();
          outcomeYMap.set('name', `Generated Outcome ${existingCount + 1}`);
          outcomeYMap.set('createdAt', now);
          outcomesMap.set(outcomeId, outcomeYMap);
        }
      }

      // Count existing studies for naming
      const existingStudyCount = reviewsMap.size;
      const studyNum = existingStudyCount + 1;

      // Generate answers for both reviewers
      const answers1 = generateChecklistAnswers(type, fillMode, seed1);
      const answers2 = generateChecklistAnswers(type, fillMode, seed2);

      // Create study Y.Map
      const studyYMap = new Y.Map<unknown>();
      studyYMap.set('name', `Generated Study ${studyNum}`);
      studyYMap.set('description', `Auto-generated ${type} study`);
      studyYMap.set('createdAt', now);
      studyYMap.set('updatedAt', now);
      studyYMap.set('originalTitle', `Generated Study ${studyNum}`);
      studyYMap.set('firstAuthor', `Author${studyNum}`);
      studyYMap.set('publicationYear', String(2020 + (studyNum % 5)));
      studyYMap.set('authors', `Author${studyNum} A, Author${studyNum} B`);
      studyYMap.set('journal', 'Generated Journal');
      studyYMap.set('reviewer1', reviewer1);
      studyYMap.set('reviewer2', reviewer2);

      // Create checklists map
      const checklistsMap = new Y.Map<Y.Map<unknown>>();

      // Reviewer 1 checklist
      const cl1YMap = buildChecklistYMap({
        id: checklist1Id,
        type,
        assignedTo: reviewer1,
        status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
        answers: answers1,
        outcomeId,
        now,
      });
      checklistsMap.set(checklist1Id, cl1YMap);

      // Reviewer 2 checklist
      const cl2YMap = buildChecklistYMap({
        id: checklist2Id,
        type,
        assignedTo: reviewer2,
        status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
        answers: answers2,
        outcomeId,
        now,
      });
      checklistsMap.set(checklist2Id, cl2YMap);

      // Reconciled checklist (third checklist)
      if (reconcile && reconciledChecklistId) {
        const reconAnswers = generateChecklistAnswers(type, fillMode, seed1 + 5555);
        const recYMap = buildChecklistYMap({
          id: reconciledChecklistId,
          type,
          assignedTo: null,
          status: CHECKLIST_STATUS.FINALIZED,
          answers: reconAnswers,
          outcomeId,
          now,
        });
        recYMap.set('reviewerName', 'Consensus');
        const sourceArr = new Y.Array<string>();
        sourceArr.push([checklist1Id, checklist2Id]);
        recYMap.set('sourceChecklists', sourceArr);
        checklistsMap.set(reconciledChecklistId, recYMap);

        // Create reconciliations map
        const reconciliationsMap = new Y.Map<Y.Map<unknown>>();
        const outcomeKey = outcomeId || `type:${type}`;
        const progressMap = new Y.Map<unknown>();
        progressMap.set('checklist1Id', checklist1Id);
        progressMap.set('checklist2Id', checklist2Id);
        progressMap.set('reconciledChecklistId', reconciledChecklistId);
        progressMap.set('type', type);
        progressMap.set('updatedAt', now);
        if (outcomeId) progressMap.set('outcomeId', outcomeId);
        reconciliationsMap.set(outcomeKey, progressMap);
        studyYMap.set('reconciliations', reconciliationsMap);
      }

      studyYMap.set('checklists', checklistsMap);
      reviewsMap.set(studyId, studyYMap);
    });

    return new Response(
      JSON.stringify({
        success: true,
        studyId,
        checklistIds: [
          checklist1Id,
          checklist2Id,
          ...(reconciledChecklistId ? [reconciledChecklistId] : []),
        ],
        outcomeId,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const err = error as Error;
    console.error('handleDevAddStudy error:', error);
    return new Response(JSON.stringify({ error: 'Add study failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function generateChecklistAnswers(
  type: 'AMSTAR2' | 'ROB2' | 'ROBINS_I',
  fillMode: string,
  seed: number,
): Record<string, unknown> {
  if (type === 'AMSTAR2') {
    return generateAMSTAR2Answers({ fill: fillMode as 'random' | 'all-yes' | 'mixed', seed });
  } else if (type === 'ROB2') {
    return { ...generateROB2Answers({ fill: fillMode as 'random' | 'all-yes' | 'mixed', seed }) };
  } else {
    const fill =
      fillMode === 'all-yes' ? 'complete'
      : fillMode === 'mixed' ? 'partial'
      : 'random';
    return generateROBINSIAnswers({ fill: fill as 'random' | 'complete' | 'partial', seed });
  }
}

function buildChecklistYMap(opts: {
  id: string;
  type: string;
  assignedTo: string | null;
  status: string;
  answers: Record<string, unknown>;
  outcomeId: string | null;
  now: string;
}): Y.Map<unknown> {
  const yMap = new Y.Map<unknown>();
  yMap.set('type', opts.type);
  yMap.set('title', null);
  yMap.set('assignedTo', opts.assignedTo);
  yMap.set('status', opts.status);
  yMap.set('createdAt', opts.now);
  yMap.set('updatedAt', opts.now);
  if (opts.outcomeId) {
    yMap.set('outcomeId', opts.outcomeId);
  }

  yMap.set('answers', buildAnswersYMap(opts.answers, opts.type));

  return yMap;
}

/**
 * List available mock templates
 */
export async function handleDevTemplates(): Promise<Response> {
  return new Response(
    JSON.stringify({
      templates: getTemplateNames(),
      descriptions: getTemplateDescriptions(),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Apply a mock template to the Y.Doc
 * URL param: ?template=template-name
 * Query param mode: 'replace' (default) or 'merge'
 */
export async function handleDevApplyTemplate(ctx: DevContext, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const templateName = url.searchParams.get('template');
  const mode = (url.searchParams.get('mode') || 'replace') as 'replace' | 'merge';

  if (!templateName) {
    return new Response(
      JSON.stringify({
        error: 'Missing template parameter',
        available: getTemplateNames(),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const templateData = getTemplate(templateName);
  if (!templateData) {
    return new Response(
      JSON.stringify({
        error: `Unknown template: ${templateName}`,
        available: getTemplateNames(),
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Extract study identifiers before applying so the client can fetch real metadata + PDFs
  const studyIdentifiers = templateData.studies.map(s => ({
    id: s.id,
    doi: s.doi || null,
  }));

  // Parse userMapping and targetOrgId from request body if present
  let userMapping: Record<string, string> | undefined;
  let targetOrgId: string | undefined;
  try {
    const body = (await request.json()) as {
      userMapping?: Record<string, string>;
      targetOrgId?: string;
    };
    userMapping = body?.userMapping;
    targetOrgId = body?.targetOrgId;
  } catch {
    // No body or invalid JSON is fine -- just skip mapping
  }

  // Strip members from template data -- templates should not overwrite real project membership
  const { members: _templateMembers, ...templateWithoutMembers } =
    templateData as unknown as Record<string, unknown>;

  const fakeRequest: ImportRequest = {
    json: async () => ({
      data: templateWithoutMembers as unknown as ImportData,
      mode,
      targetOrgId,
      userMapping,
    }),
  };

  const importResponse = await handleDevImport(ctx, fakeRequest);
  const importResult = (await importResponse.json()) as Record<string, unknown>;

  return new Response(JSON.stringify({ ...importResult, studies: studyIdentifiers }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
