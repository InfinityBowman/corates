/**
 * Dev-only handlers for Yjs state inspection and manipulation.
 * Dynamically imported only when DEV_MODE is enabled to keep production bundle small.
 */
import * as Y from 'yjs';

/**
 * Export the full Y.Doc state as JSON
 */
export async function handleDevExport(ctx) {
  const { doc, stateId, yMapToPlain } = ctx;

  const exportData = {
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
      ...yMapToPlain(value),
    });
  }

  // Export studies (reviews) with nested checklists and pdfs
  const reviewsMap = doc.getMap('reviews');
  for (const [studyId, studyValue] of reviewsMap.entries()) {
    const studyData = yMapToPlain(studyValue);
    const study = {
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
    const checklistsMap = studyValue.get('checklists');
    if (checklistsMap && checklistsMap.entries) {
      for (const [checklistId, checklistValue] of checklistsMap.entries()) {
        const checklistData = yMapToPlain(checklistValue);
        study.checklists.push({
          id: checklistId,
          type: checklistData.type,
          title: checklistData.title,
          assignedTo: checklistData.assignedTo,
          status: checklistData.status || 'pending',
          createdAt: checklistData.createdAt,
          updatedAt: checklistData.updatedAt,
          answers: checklistData.answers || {},
        });
      }
    }

    // Export PDFs
    const pdfsMap = studyValue.get('pdfs');
    if (pdfsMap && pdfsMap.entries) {
      for (const [fileName, pdfValue] of pdfsMap.entries()) {
        const pdfData = yMapToPlain(pdfValue);
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
function importAnswers(answers, checklistType) {
  const answersYMap = new Y.Map();

  for (const [questionKey, questionData] of Object.entries(answers)) {
    const questionYMap = new Y.Map();

    if (checklistType === 'AMSTAR2') {
      // AMSTAR2: answers is boolean[][], critical is boolean
      if (questionData.answers) {
        questionYMap.set('answers', questionData.answers);
      }
      if (questionData.critical !== undefined) {
        questionYMap.set('critical', questionData.critical);
      }
    } else if (checklistType === 'ROBINS_I') {
      // ROBINS-I has nested structure with judgement, answers map, etc.
      for (const [key, value] of Object.entries(questionData)) {
        if (key === 'answers' && typeof value === 'object') {
          // Nested answers map for ROBINS-I questions
          const nestedAnswersMap = new Y.Map();
          for (const [ansKey, ansValue] of Object.entries(value)) {
            const ansYMap = new Y.Map();
            if (ansValue.answer !== undefined) {
              ansYMap.set('answer', ansValue.answer);
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
 */
export async function handleDevImport(ctx, request) {
  const { doc } = ctx;

  try {
    const { data, mode = 'replace' } = await request.json();

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

      // Import meta
      if (data.meta) {
        for (const [key, value] of Object.entries(data.meta)) {
          metaMap.set(key, value);
        }
      }

      // Import members
      if (data.members) {
        for (const member of data.members) {
          const memberYMap = new Y.Map();
          memberYMap.set('role', member.role);
          memberYMap.set('joinedAt', member.joinedAt);
          memberYMap.set('name', member.name || null);
          memberYMap.set('email', member.email || null);
          memberYMap.set('displayName', member.displayName || null);
          memberYMap.set('image', member.image || null);
          membersMap.set(member.userId, memberYMap);
        }
      }

      // Import studies
      if (data.studies) {
        for (const study of data.studies) {
          let studyYMap;

          if (mode === 'merge' && reviewsMap.has(study.id)) {
            studyYMap = reviewsMap.get(study.id);
          } else {
            studyYMap = new Y.Map();
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
          ];

          for (const field of studyFields) {
            if (study[field] !== undefined) {
              studyYMap.set(field, study[field]);
            }
          }

          // Import reconciliation if present
          if (study.reconciliation) {
            const reconYMap = new Y.Map();
            for (const [key, value] of Object.entries(study.reconciliation)) {
              reconYMap.set(key, value);
            }
            studyYMap.set('reconciliation', reconYMap);
          }

          // Import checklists
          if (study.checklists && study.checklists.length > 0) {
            let checklistsMap = studyYMap.get('checklists');
            if (!checklistsMap) {
              checklistsMap = new Y.Map();
              studyYMap.set('checklists', checklistsMap);
            }

            for (const checklist of study.checklists) {
              let checklistYMap;

              if (mode === 'merge' && checklistsMap.has(checklist.id)) {
                checklistYMap = checklistsMap.get(checklist.id);
              } else {
                checklistYMap = new Y.Map();
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
                const answersYMap = importAnswers(checklist.answers, checklist.type);
                checklistYMap.set('answers', answersYMap);
              }
            }
          }

          // Import PDFs
          if (study.pdfs && study.pdfs.length > 0) {
            let pdfsMap = studyYMap.get('pdfs');
            if (!pdfsMap) {
              pdfsMap = new Y.Map();
              studyYMap.set('pdfs', pdfsMap);
            }

            for (const pdf of study.pdfs) {
              const pdfYMap = new Y.Map();
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
    console.error('handleDevImport error:', error);
    return new Response(JSON.stringify({ error: 'Import failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Apply surgical patches to specific paths in Y.Doc
 * Format: { operations: [{ path: "studies.id.name", value: "New Name" }] }
 */
export async function handleDevPatch(ctx, request) {
  const { doc } = ctx;

  try {
    const { operations } = await request.json();

    if (!operations || !Array.isArray(operations)) {
      return new Response(JSON.stringify({ error: 'Missing operations array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    doc.transact(() => {
      for (const op of operations) {
        try {
          const pathParts = op.path.split('.');
          let target = doc;

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
              target = target.get(part);
              if (!target) {
                throw new Error(`Path not found: ${pathParts.slice(0, i + 1).join('.')}`);
              }
            }
          }

          // Set the value at the final key
          const finalKey = pathParts[pathParts.length - 1];
          if (target && typeof target.set === 'function') {
            target.set(finalKey, op.value);
            results.push({ path: op.path, success: true });
          } else {
            results.push({ path: op.path, success: false, error: 'Invalid target' });
          }
        } catch (err) {
          results.push({ path: op.path, success: false, error: err.message });
        }
      }
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('handleDevPatch error:', error);
    return new Response(JSON.stringify({ error: 'Patch failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Reset Y.Doc to empty state
 */
export async function handleDevReset(ctx) {
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
    console.error('handleDevReset error:', error);
    return new Response(JSON.stringify({ error: 'Reset failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get raw Yjs binary state for low-level debugging
 */
export async function handleDevRaw(ctx) {
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
    console.error('handleDevRaw error:', error);
    return new Response(JSON.stringify({ error: 'Raw export failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
