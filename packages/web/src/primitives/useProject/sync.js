/**
 * Y.js sync utilities for useProject
 * Handles syncing Y.Doc state to the project store
 */

import projectStore from '@/stores/projectStore.js';
import { scoreChecklistOfType } from '@/checklist-registry/index.js';
import { getAnswers as getAMSTAR2Answers } from '@/components/checklist/AMSTAR2Checklist/checklist.js';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';

/**
 * Creates sync utilities for syncing Y.Doc to store
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @returns {Object} Sync utilities
 */
export function createSyncManager(projectId, getYDoc) {
  /**
   * Sync the Y.Doc state to the project store
   */
  function syncFromYDoc() {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studiesList = [];

    for (const [studyId, studyYMap] of studiesMap.entries()) {
      const studyData = studyYMap.toJSON ? studyYMap.toJSON() : studyYMap;
      const study = buildStudyFromYMap(studyId, studyData, studyYMap);
      studiesList.push(study);
    }

    // Sort by createdAt
    studiesList.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    // Sync meta
    const metaMap = ydoc.getMap('meta');
    const metaData = metaMap.toJSON ? metaMap.toJSON() : {};

    // Sync members
    const membersMap = ydoc.getMap('members');
    const membersList = buildMembersList(membersMap);

    // Update store with all data
    projectStore.setProjectData(projectId, {
      studies: studiesList,
      meta: metaData,
      members: membersList,
    });
  }

  return {
    syncFromYDoc,
  };
}

/**
 * Build a study object from Y.Map data
 */
function buildStudyFromYMap(studyId, studyData, studyYMap) {
  const study = {
    id: studyId,
    name: studyData.name || '',
    description: studyData.description || '',
    // Reference metadata fields
    originalTitle: studyData.originalTitle || null,
    firstAuthor: studyData.firstAuthor || null,
    publicationYear: studyData.publicationYear || null,
    authors: studyData.authors || null,
    journal: studyData.journal || null,
    doi: studyData.doi || null,
    abstract: studyData.abstract || null,
    importSource: studyData.importSource || null,
    pdfUrl: studyData.pdfUrl || null,
    pdfSource: studyData.pdfSource || null,
    pdfAccessible: Boolean(studyData.pdfAccessible || false),
    pmid: studyData.pmid || null,
    url: studyData.url || null,
    volume: studyData.volume || null,
    issue: studyData.issue || null,
    pages: studyData.pages || null,
    type: studyData.type || null,
    // Reviewer assignments
    reviewer1: studyData.reviewer1 || null,
    reviewer2: studyData.reviewer2 || null,
    createdAt: studyData.createdAt,
    updatedAt: studyData.updatedAt,
    checklists: [],
    pdfs: [],
  };

  // Get checklists from nested Y.Map
  const checklistsMap = studyYMap.get ? studyYMap.get('checklists') : null;
  if (checklistsMap && typeof checklistsMap.entries === 'function') {
    for (const [checklistId, checklistYMap] of checklistsMap.entries()) {
      const checklistData = checklistYMap.toJSON ? checklistYMap.toJSON() : checklistYMap;
      const checklistType = checklistData.type || 'AMSTAR2';
      const status = checklistData.status || 'pending';

      const checklistEntry = {
        id: checklistId,
        type: checklistType,
        title: checklistData.title || null,
        assignedTo: checklistData.assignedTo || null,
        status: status,
        createdAt: checklistData.createdAt,
        updatedAt: checklistData.updatedAt,
        score: null,
        answers: null,
      };

      // Extract answers and compute score for finalized checklists
      if (status === CHECKLIST_STATUS.FINALIZED) {
        const answersMap = checklistYMap.get('answers');
        if (answersMap && typeof answersMap.entries === 'function') {
          const answers = extractAnswersFromYMap(answersMap, checklistType);
          checklistEntry.answers = answers;

          // Compute score from answers
          const score = scoreChecklistOfType(checklistType, answers);
          if (score && score !== 'Error') {
            checklistEntry.score = score;
          }

          // For AMSTAR2, also compute the consolidated answers for charts
          if (checklistType === 'AMSTAR2') {
            checklistEntry.consolidatedAnswers = getAMSTAR2Answers(answers);
          }
        }
      }

      study.checklists.push(checklistEntry);
    }
  }

  // Get PDFs from nested Y.Map
  const pdfsMap = studyYMap.get ? studyYMap.get('pdfs') : null;
  if (pdfsMap && typeof pdfsMap.entries === 'function') {
    for (const [pdfId, pdfYMap] of pdfsMap.entries()) {
      const pdfData = pdfYMap.toJSON ? pdfYMap.toJSON() : pdfYMap;
      study.pdfs.push({
        id: pdfData.id || pdfId,
        fileName: pdfData.fileName || pdfId, // fallback for old structure where pdfId was fileName
        key: pdfData.key,
        size: pdfData.size,
        uploadedBy: pdfData.uploadedBy,
        uploadedAt: pdfData.uploadedAt,
        tag: pdfData.tag || 'secondary',
        // Citation metadata
        title: pdfData.title || null,
        firstAuthor: pdfData.firstAuthor || null,
        publicationYear: pdfData.publicationYear || null,
        journal: pdfData.journal || null,
        doi: pdfData.doi || null,
      });
    }
  }

  // Get reconciliation progress if any
  const reconciliationMap = studyYMap.get ? studyYMap.get('reconciliation') : null;
  if (reconciliationMap) {
    const reconciliationData =
      reconciliationMap.toJSON ? reconciliationMap.toJSON() : reconciliationMap;
    if (reconciliationData.checklist1Id && reconciliationData.checklist2Id) {
      study.reconciliation = {
        checklist1Id: reconciliationData.checklist1Id,
        checklist2Id: reconciliationData.checklist2Id,
        reconciledChecklistId: reconciliationData.reconciledChecklistId || null,
        currentPage: reconciliationData.currentPage || 0,
        viewMode: reconciliationData.viewMode || 'questions',
        updatedAt: reconciliationData.updatedAt,
      };
    }
  }

  // Get annotations from nested Y.Map
  const annotationsMap = studyYMap.get ? studyYMap.get('annotations') : null;
  if (annotationsMap && typeof annotationsMap.entries === 'function') {
    study.annotations = buildAnnotationsFromYMap(annotationsMap);
  } else {
    study.annotations = {};
  }

  return study;
}

/**
 * Build annotations map from Y.Map
 * Returns an object: { checklistId: [annotations] }
 */
function buildAnnotationsFromYMap(annotationsMap) {
  const annotations = {};
  for (const [checklistId, checklistAnnotationsMap] of annotationsMap.entries()) {
    if (!checklistAnnotationsMap || typeof checklistAnnotationsMap.entries !== 'function') {
      continue;
    }

    const checklistAnnotations = [];
    for (const [annotationId, annotationYMap] of checklistAnnotationsMap.entries()) {
      // Skip null/undefined entries
      if (!annotationYMap) continue;

      const annotationData = annotationYMap.toJSON ? annotationYMap.toJSON() : annotationYMap;

      // Parse embedPdfData from JSON string
      let embedPdfData = {};
      try {
        embedPdfData = JSON.parse(annotationData.embedPdfData || '{}');
      } catch (err) {
        console.warn('Failed to parse annotation embedPdfData:', annotationId, err);
      }

      checklistAnnotations.push({
        id: annotationData.id || annotationId,
        pdfId: annotationData.pdfId,
        type: annotationData.type,
        pageIndex: annotationData.pageIndex,
        embedPdfData,
        createdBy: annotationData.createdBy,
        createdAt: annotationData.createdAt,
        updatedAt: annotationData.updatedAt,
        mergedFrom: annotationData.mergedFrom || null,
      });
    }

    if (checklistAnnotations.length > 0) {
      annotations[checklistId] = checklistAnnotations;
    }
  }
  return annotations;
}

/**
 * Build members list from Y.Map
 */
function buildMembersList(membersMap) {
  const membersList = [];
  for (const [userId, memberYMap] of membersMap.entries()) {
    const memberData = memberYMap.toJSON ? memberYMap.toJSON() : memberYMap;
    membersList.push({
      userId,
      role: memberData.role,
      joinedAt: memberData.joinedAt,
      name: memberData.name,
      email: memberData.email,
      givenName: memberData.givenName,
      familyName: memberData.familyName,
      image: memberData.image,
    });
  }
  return membersList;
}

/**
 * Extract answers from Y.Map into a plain object suitable for scoring
 * @param {Y.Map} answersMap - The answers Y.Map from a checklist
 * @param {string} checklistType - The checklist type (AMSTAR2, ROBINS_I, etc.)
 * @returns {Object} Plain object with answers
 */
function extractAnswersFromYMap(answersMap, checklistType) {
  const answers = {};

  for (const [key, sectionYMap] of answersMap.entries()) {
    if (checklistType === 'ROBINS_I' && sectionYMap && typeof sectionYMap.get === 'function') {
      // ROBINS-I: Reconstruct nested structure
      if (key.startsWith('domain')) {
        const sectionData = {
          judgement: sectionYMap.get('judgement') ?? null,
          answers: {},
        };
        const direction = sectionYMap.get('direction');
        if (direction !== undefined) {
          sectionData.direction = direction;
        }

        const answersNestedYMap = sectionYMap.get('answers');
        if (answersNestedYMap && typeof answersNestedYMap.entries === 'function') {
          for (const [qKey, questionYMap] of answersNestedYMap.entries()) {
            if (questionYMap && typeof questionYMap.get === 'function') {
              sectionData.answers[qKey] = {
                answer: questionYMap.get('answer') ?? null,
                comment: questionYMap.get('comment') ?? '',
              };
            } else {
              sectionData.answers[qKey] = questionYMap;
            }
          }
        }
        answers[key] = sectionData;
      } else if (key === 'overall') {
        const sectionData = {
          judgement: sectionYMap.get('judgement') ?? null,
        };
        const direction = sectionYMap.get('direction');
        if (direction !== undefined) {
          sectionData.direction = direction;
        }
        answers[key] = sectionData;
      } else if (key === 'sectionB') {
        const sectionData = {};
        for (const [subKey, subValue] of sectionYMap.entries()) {
          if (subValue && typeof subValue.get === 'function') {
            sectionData[subKey] = {
              answer: subValue.get('answer') ?? null,
              comment: subValue.get('comment') ?? '',
            };
          } else {
            sectionData[subKey] = subValue;
          }
        }
        answers[key] = sectionData;
      } else {
        answers[key] = sectionYMap.toJSON ? sectionYMap.toJSON() : sectionYMap;
      }
    } else {
      // AMSTAR2 and other types: simple toJSON conversion
      answers[key] = sectionYMap.toJSON ? sectionYMap.toJSON() : sectionYMap;
    }
  }

  return answers;
}
