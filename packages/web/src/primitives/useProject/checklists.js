/**
 * Checklist operations for useProject
 */

import * as Y from 'yjs';
import { createChecklistOfType, CHECKLIST_TYPES } from '@/checklist-registry';

/**
 * Creates checklist operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Checklist operations
 */
export function createChecklistOperations(projectId, getYDoc, isSynced) {
  /**
   * Create a checklist in a study
   * @param {string} studyId - The study ID
   * @param {string} type - Checklist type (default: 'AMSTAR2')
   * @param {string|null} assignedTo - User ID to assign to
   * @returns {string|null} The checklist ID or null if failed
   */
  function createChecklist(studyId, type = 'AMSTAR2', assignedTo = null) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);

    if (!studyYMap) return null;

    let checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) {
      checklistsMap = new Y.Map();
      studyYMap.set('checklists', checklistsMap);
    }

    const checklistId = crypto.randomUUID();
    const now = Date.now();

    // Get the default answers structure for this checklist type using the registry
    let answersData = {};
    const checklistTemplate = createChecklistOfType(type, {
      id: checklistId,
      name: `${type} Checklist`,
      createdAt: now,
    });

    // Extract answers based on checklist type
    if (type === CHECKLIST_TYPES.AMSTAR2) {
      // AMSTAR2: Extract question answers (q1, q2, etc.)
      for (const [key, value] of Object.entries(checklistTemplate)) {
        if (/^q\d+[a-z]*$/i.test(key)) {
          answersData[key] = value;
        }
      }
    } else if (type === CHECKLIST_TYPES.ROBINS_I) {
      // ROBINS-I: Extract all domain and section data
      const robinsKeys = [
        'planning',
        'sectionA',
        'sectionB',
        'sectionC',
        'sectionD',
        'confoundingEvaluation',
        'domain1a',
        'domain1b',
        'domain2',
        'domain3',
        'domain4',
        'domain5',
        'domain6',
        'overall',
      ];
      for (const key of robinsKeys) {
        if (checklistTemplate[key] !== undefined) {
          answersData[key] = checklistTemplate[key];
        }
      }
    }

    const checklistYMap = new Y.Map();
    checklistYMap.set('type', type);
    checklistYMap.set('title', `${type} Checklist`);
    checklistYMap.set('assignedTo', assignedTo);
    checklistYMap.set('status', 'pending');
    checklistYMap.set('isReconciled', false);
    checklistYMap.set('createdAt', now);
    checklistYMap.set('updatedAt', now);

    // Store answers as a Y.Map
    const answersYMap = new Y.Map();

    if (type === CHECKLIST_TYPES.AMSTAR2) {
      // AMSTAR2: Store each question as a nested Y.Map with answers, critical, and note
      // Note: q9 and q11 are multi-part questions (q9a/q9b, q11a/q11b) but get one note each
      // at the parent level (q9, q11)
      const multiPartParents = ['q9', 'q11'];
      const subQuestionPattern = /^(q9|q11)[a-z]$/;

      for (const [questionKey, questionData] of Object.entries(answersData)) {
        const questionYMap = new Y.Map();
        questionYMap.set('answers', questionData.answers);
        questionYMap.set('critical', questionData.critical);

        // Add note for non-sub-questions
        // Sub-questions (q9a, q9b, q11a, q11b) don't get notes - the parent does
        if (!subQuestionPattern.test(questionKey)) {
          questionYMap.set('note', new Y.Text());
        }

        answersYMap.set(questionKey, questionYMap);
      }

      // Add note entries for multi-part parent questions (q9, q11)
      // These don't have answer data but need a note
      for (const parentKey of multiPartParents) {
        if (!answersYMap.has(parentKey)) {
          const parentYMap = new Y.Map();
          parentYMap.set('note', new Y.Text());
          answersYMap.set(parentKey, parentYMap);
        }
      }
    } else if (type === CHECKLIST_TYPES.ROBINS_I) {
      // ROBINS-I: Store each section/domain as nested Y.Maps to support concurrent edits
      for (const [key, value] of Object.entries(answersData)) {
        const sectionYMap = new Y.Map();

        // Domain keys have nested 'answers' object with individual questions
        if (key.startsWith('domain') || key === 'overall') {
          // Store judgement and direction at section level
          sectionYMap.set('judgement', value.judgement ?? null);
          if (value.direction !== undefined) {
            sectionYMap.set('direction', value.direction ?? null);
          }

          // Store each question as a nested Y.Map for concurrent edits
          if (value.answers) {
            const answersNestedYMap = new Y.Map();
            for (const [qKey, qValue] of Object.entries(value.answers)) {
              const questionYMap = new Y.Map();
              questionYMap.set('answer', qValue.answer ?? null);
              questionYMap.set('comment', qValue.comment ?? '');
              answersNestedYMap.set(qKey, questionYMap);
            }
            sectionYMap.set('answers', answersNestedYMap);
          }
        } else if (key === 'sectionB') {
          // Section B has individual questions (b1, b2, b3) and stopAssessment
          for (const [subKey, subValue] of Object.entries(value)) {
            if (typeof subValue === 'object' && subValue !== null) {
              const questionYMap = new Y.Map();
              questionYMap.set('answer', subValue.answer ?? null);
              questionYMap.set('comment', subValue.comment ?? '');
              sectionYMap.set(subKey, questionYMap);
            } else {
              sectionYMap.set(subKey, subValue);
            }
          }
        } else if (key === 'confoundingEvaluation') {
          // Confounding evaluation has arrays - store as JSON for now
          sectionYMap.set('predefined', value.predefined ?? []);
          sectionYMap.set('additional', value.additional ?? []);
        } else if (key === 'sectionD') {
          // Section D has sources object and otherSpecify
          sectionYMap.set('sources', value.sources ?? {});
          sectionYMap.set('otherSpecify', value.otherSpecify ?? '');
        } else {
          // Other sections (planning, sectionA, sectionC): store each field
          for (const [fieldKey, fieldValue] of Object.entries(value)) {
            sectionYMap.set(fieldKey, fieldValue);
          }
        }

        answersYMap.set(key, sectionYMap);
      }
    } else {
      // Other types: Store data directly (will be serialized as JSON)
      for (const [key, value] of Object.entries(answersData)) {
        answersYMap.set(key, value);
      }
    }

    checklistYMap.set('answers', answersYMap);

    checklistsMap.set(checklistId, checklistYMap);

    // Update study's updatedAt
    studyYMap.set('updatedAt', now);

    return checklistId;
  }

  /**
   * Update a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {Object} updates - Fields to update
   */
  function updateChecklist(studyId, checklistId, updates) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return;

    if (updates.title !== undefined) checklistYMap.set('title', updates.title);
    if (updates.assignedTo !== undefined) checklistYMap.set('assignedTo', updates.assignedTo);
    if (updates.status !== undefined) checklistYMap.set('status', updates.status);
    if (updates.isReconciled !== undefined) checklistYMap.set('isReconciled', updates.isReconciled);
    checklistYMap.set('updatedAt', Date.now());
  }

  /**
   * Delete a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   */
  function deleteChecklist(studyId, checklistId) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    checklistsMap.delete(checklistId);
    studyYMap.set('updatedAt', Date.now());
  }

  /**
   * Get a specific checklist's Y.Map for answer updates
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @returns {Y.Map|null} The answers Y.Map or null
   */
  function getChecklistAnswersMap(studyId, checklistId) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    return checklistYMap.get('answers');
  }

  /**
   * Get full checklist data including answers in plain object format
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @returns {Object|null} The checklist data or null
   */
  function getChecklistData(studyId, checklistId) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    const data = checklistYMap.toJSON ? checklistYMap.toJSON() : {};
    const checklistType = checklistYMap.get('type');

    // Convert answers Y.Map to plain object with question keys at top level
    const answers = {};
    const answersMap = checklistYMap.get('answers');
    if (answersMap && typeof answersMap.entries === 'function') {
      for (const [key, sectionYMap] of answersMap.entries()) {
        // ROBINS-I: Reconstruct nested structure from Y.Maps
        if (checklistType === 'ROBINS_I' && sectionYMap instanceof Y.Map) {
          if (key.startsWith('domain')) {
            const sectionData = {
              judgement: sectionYMap.get('judgement') ?? null,
              answers: {}, // Always initialize answers for domains
            };
            const direction = sectionYMap.get('direction');
            if (direction !== undefined) {
              sectionData.direction = direction;
            }

            // Reconstruct nested answers
            const answersNestedYMap = sectionYMap.get('answers');
            if (answersNestedYMap instanceof Y.Map) {
              for (const [qKey, questionYMap] of answersNestedYMap.entries()) {
                sectionData.answers[qKey] = questionYMap instanceof Y.Map ? {
                    answer: questionYMap.get('answer') ?? null,
                    comment: questionYMap.get('comment') ?? '',
                  } : questionYMap;
              }
            }
            answers[key] = sectionData;
          } else if (key === 'overall') {
            // Overall section has judgement and direction but no nested answers
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
              sectionData[subKey] = subValue instanceof Y.Map ? {
                  answer: subValue.get('answer') ?? null,
                  comment: subValue.get('comment') ?? '',
                } : subValue;
            }
            answers[key] = sectionData;
          } else {
            // Other sections: convert Y.Map to plain object
            answers[key] = sectionYMap.toJSON ? sectionYMap.toJSON() : sectionYMap;
          }
        } else {
          // AMSTAR2 and other types
          const sectionData = sectionYMap.toJSON ? sectionYMap.toJSON() : sectionYMap;
          answers[key] = sectionData;
        }
      }
    }

    return {
      ...data,
      answers,
    };
  }

  /**
   * Update a single answer/section in a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} key - The answer key (e.g., 'q1' for AMSTAR2, 'domain1a' for ROBINS-I)
   * @param {Object} data - The answer data (structure depends on checklist type)
   */
  function updateChecklistAnswer(studyId, checklistId, key, data) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return;

    let answersMap = checklistYMap.get('answers');
    if (!answersMap) {
      answersMap = new Y.Map();
      checklistYMap.set('answers', answersMap);
    }

    const checklistType = checklistYMap.get('type');

    // AMSTAR2: Store as nested Y.Map with answers and critical (preserving existing note)
    if (checklistType === 'AMSTAR2' && data.answers !== undefined) {
      let questionYMap = answersMap.get(key);
      if (!questionYMap || !(questionYMap instanceof Y.Map)) {
        questionYMap = new Y.Map();
        answersMap.set(key, questionYMap);
      }
      questionYMap.set('answers', data.answers);
      questionYMap.set('critical', data.critical);
      // Note: Y.Text note is preserved - we don't overwrite it here
      // If no note exists yet, create one (for existing checklists without notes)
      if (!questionYMap.get('note')) {
        questionYMap.set('note', new Y.Text());
      }
    }
    // ROBINS-I: Update nested Y.Maps granularly for concurrent edit support
    else if (checklistType === 'ROBINS_I') {
      let sectionYMap = answersMap.get(key);

      // Create section Y.Map if it doesn't exist
      if (!sectionYMap || !(sectionYMap instanceof Y.Map)) {
        sectionYMap = new Y.Map();
        answersMap.set(key, sectionYMap);
      }

      // Domain keys have nested 'answers' object with individual questions
      if (key.startsWith('domain') || key === 'overall') {
        // Update judgement and direction at section level
        if (data.judgement !== undefined) {
          sectionYMap.set('judgement', data.judgement);
        }
        if (data.direction !== undefined) {
          sectionYMap.set('direction', data.direction);
        }

        // Update individual questions in answers
        if (data.answers) {
          let answersNestedYMap = sectionYMap.get('answers');
          if (!answersNestedYMap || !(answersNestedYMap instanceof Y.Map)) {
            answersNestedYMap = new Y.Map();
            sectionYMap.set('answers', answersNestedYMap);
          }

          for (const [qKey, qValue] of Object.entries(data.answers)) {
            let questionYMap = answersNestedYMap.get(qKey);
            if (!questionYMap || !(questionYMap instanceof Y.Map)) {
              questionYMap = new Y.Map();
              answersNestedYMap.set(qKey, questionYMap);
            }
            if (qValue.answer !== undefined) questionYMap.set('answer', qValue.answer);
            if (qValue.comment !== undefined) questionYMap.set('comment', qValue.comment);
          }
        }
      } else if (key === 'sectionB') {
        // Section B: update individual questions or stopAssessment
        for (const [subKey, subValue] of Object.entries(data)) {
          if (typeof subValue === 'object' && subValue !== null) {
            let questionYMap = sectionYMap.get(subKey);
            if (!questionYMap || !(questionYMap instanceof Y.Map)) {
              questionYMap = new Y.Map();
              sectionYMap.set(subKey, questionYMap);
            }
            if (subValue.answer !== undefined) questionYMap.set('answer', subValue.answer);
            if (subValue.comment !== undefined) questionYMap.set('comment', subValue.comment);
          } else {
            sectionYMap.set(subKey, subValue);
          }
        }
      } else if (key === 'confoundingEvaluation') {
        // Confounding evaluation: update arrays
        if (data.predefined !== undefined) sectionYMap.set('predefined', data.predefined);
        if (data.additional !== undefined) sectionYMap.set('additional', data.additional);
      } else if (key === 'sectionD') {
        // Section D: update sources or otherSpecify
        if (data.sources !== undefined) sectionYMap.set('sources', data.sources);
        if (data.otherSpecify !== undefined) sectionYMap.set('otherSpecify', data.otherSpecify);
      } else {
        // Other sections: update individual fields
        for (const [fieldKey, fieldValue] of Object.entries(data)) {
          sectionYMap.set(fieldKey, fieldValue);
        }
      }
    }
    // Other types: Store data directly
    else {
      answersMap.set(key, data);
    }

    // Auto-transition status from 'pending' to 'in-progress' on first edit
    const currentStatus = checklistYMap.get('status');
    if (currentStatus === 'pending') {
      checklistYMap.set('status', 'in-progress');
    }

    checklistYMap.set('updatedAt', Date.now());
  }

  /**
   * Get a Y.Text reference for a question's note (for direct binding)
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} questionKey - The question key (e.g., 'q1', 'q9' for multi-part)
   * @returns {Y.Text|null} The Y.Text reference or null
   */
  function getQuestionNote(studyId, checklistId, questionKey) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    const answersMap = checklistYMap.get('answers');
    if (!answersMap) return null;

    const questionYMap = answersMap.get(questionKey);
    if (!questionYMap || !(questionYMap instanceof Y.Map)) return null;

    const note = questionYMap.get('note');
    // Return existing note, or create one if missing (for existing checklists)
    if (note instanceof Y.Text) {
      return note;
    }

    // Create note if it doesn't exist (backward compatibility)
    if (isSynced()) {
      const newNote = new Y.Text();
      questionYMap.set('note', newNote);
      return newNote;
    }

    return null;
  }

  return {
    createChecklist,
    updateChecklist,
    deleteChecklist,
    getChecklistAnswersMap,
    getChecklistData,
    updateChecklistAnswer,
    getQuestionNote,
  };
}
