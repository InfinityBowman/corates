/**
 * Dev-only handlers for Yjs state inspection and manipulation.
 * Dynamically imported only when DEV_MODE is enabled to keep production bundle small.
 */
import * as Y from 'yjs';
import { getTemplate, getTemplateNames, getTemplateDescriptions } from '../lib/mock-templates';

interface DevContext {
  doc: Y.Doc;
  stateId: string;
  yMapToPlain: (map: Y.Map<unknown>) => Record<string, unknown>;
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
    displayName?: string | null;
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
    importer?: {
      userId?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }>;
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
 * Helper to import checklist answers as Y.Maps
 */
function importAnswers(answers: Record<string, unknown>, checklistType: string): Y.Map<unknown> {
  const answersYMap = new Y.Map<unknown>();

  for (const [questionKey, questionData] of Object.entries(answers)) {
    const questionYMap = new Y.Map<unknown>();
    const qData = questionData as Record<string, unknown>;

    if (checklistType === 'AMSTAR2') {
      // AMSTAR2: answers is boolean[][], critical is boolean
      if (qData.answers) {
        questionYMap.set('answers', qData.answers);
      }
      if (qData.critical !== undefined) {
        questionYMap.set('critical', qData.critical);
      }
    } else if (checklistType === 'ROBINS_I') {
      // ROBINS-I has nested structure with judgement, answers map, etc.
      for (const [key, value] of Object.entries(qData)) {
        if (key === 'answers' && typeof value === 'object' && value !== null) {
          // Nested answers map for ROBINS-I questions
          const nestedAnswersMap = new Y.Map<unknown>();
          for (const [ansKey, ansValue] of Object.entries(value as Record<string, unknown>)) {
            const ansYMap = new Y.Map<unknown>();
            const ans = ansValue as Record<string, unknown>;
            if (ans.answer !== undefined) {
              ansYMap.set('answer', ans.answer);
            }
            nestedAnswersMap.set(ansKey, ansYMap);
          }
          questionYMap.set('answers', nestedAnswersMap);
        } else {
          questionYMap.set(key, value);
        }
      }
    }

    answersYMap.set(questionKey, questionYMap);
  }

  return answersYMap;
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
    const { data, mode = 'replace', targetOrgId, importer } = await request.json();

    if (!data) {
      return new Response(JSON.stringify({ error: 'Missing data field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    doc.transact(() => {
      const metaMap = doc.getMap('meta');
      const membersMap = doc.getMap('members');
      const reviewsMap = doc.getMap('reviews');

      if (mode === 'replace') {
        metaMap.clear();
        membersMap.clear();
        reviewsMap.clear();
      }

      // Import meta, but override orgId if targetOrgId is provided
      if (data.meta) {
        for (const [key, value] of Object.entries(data.meta)) {
          if (key === 'orgId' && targetOrgId) {
            metaMap.set('orgId', targetOrgId);
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
          const memberYMap = new Y.Map<unknown>();
          memberYMap.set('role', member.role);
          memberYMap.set('joinedAt', member.joinedAt);
          memberYMap.set('name', member.name || null);
          memberYMap.set('email', member.email || null);
          memberYMap.set('displayName', member.displayName || null);
          memberYMap.set('image', member.image || null);
          membersMap.set(member.userId, memberYMap);
        }
      }

      // Add importer as member if not already present
      if (importer?.userId && !membersMap.has(importer.userId)) {
        const importerYMap = new Y.Map<unknown>();
        importerYMap.set('role', 'owner');
        importerYMap.set('joinedAt', new Date().toISOString());
        importerYMap.set('name', importer.name || null);
        importerYMap.set('email', importer.email || null);
        importerYMap.set('displayName', importer.name || null);
        importerYMap.set('image', importer.image || null);
        membersMap.set(importer.userId, importerYMap);
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
                throw new Error(`Unknown root path: ${part}`);
              }
            } else {
              const yMap = target as Y.Map<unknown>;
              const next = yMap.get(part);
              if (!next) {
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

  // Re-use the import handler with the template data
  // Cast through unknown because MockProjectData and ImportData have compatible structures
  // but TypeScript can't verify all the nested types automatically
  const fakeRequest: ImportRequest = {
    json: async () => ({ data: templateData as unknown as ImportData, mode }),
  };

  return handleDevImport(ctx, fakeRequest);
}
