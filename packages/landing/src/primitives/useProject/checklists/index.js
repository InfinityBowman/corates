/**
 * Checklist operations for useProject
 * Main coordinator that delegates to type-specific handlers
 */

import * as Y from 'yjs';
import { createChecklistOfType, CHECKLIST_TYPES } from '@/checklist-registry';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { createCommonOperations } from './common.js';
import { AMSTAR2Handler } from './handlers/amstar2.js';
import { ROBINSIHandler } from './handlers/robins-i.js';
import { ROB2Handler } from './handlers/rob2.js';

/**
 * Creates checklist operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Checklist operations
 */
export function createChecklistOperations(_projectId, getYDoc, _isSynced) {
  // Initialize common operations
  const commonOps = createCommonOperations(getYDoc);

  // Initialize type-specific handlers
  const amstar2Handler = new AMSTAR2Handler();
  const robinsIHandler = new ROBINSIHandler();
  const rob2Handler = new ROB2Handler();

  // Handler registry
  const handlers = {
    [CHECKLIST_TYPES.AMSTAR2]: amstar2Handler,
    [CHECKLIST_TYPES.ROBINS_I]: robinsIHandler,
    [CHECKLIST_TYPES.ROB2]: rob2Handler,
  };

  /**
   * Get handler for a checklist type
   * @param {string} type - The checklist type
   * @returns {ChecklistHandler|null} The handler or null
   */
  function getHandler(type) {
    return handlers[type] || null;
  }

  /**
   * Check if a checklist type requires an outcome
   * @param {string} type - The checklist type
   * @returns {boolean} True if the type requires an outcome
   */
  function requiresOutcome(type) {
    return type === CHECKLIST_TYPES.ROB2 || type === CHECKLIST_TYPES.ROBINS_I;
  }

  /**
   * Create a checklist in a study
   * @param {string} studyId - The study ID
   * @param {string} type - Checklist type (default: 'AMSTAR2')
   * @param {string|null} assignedTo - User ID to assign to
   * @param {string|null} outcomeId - Outcome ID (required for ROB2/ROBINS_I)
   * @returns {string|null} The checklist ID or null if failed
   */
  function createChecklist(studyId, type = 'AMSTAR2', assignedTo = null, outcomeId = null) {
    try {
      const ydoc = getYDoc();
      if (!ydoc) {
        console.error('[createChecklist] No YDoc available');
        return null;
      }

      // Validate outcome requirement for ROB2 and ROBINS_I
      if (requiresOutcome(type) && !outcomeId) {
        console.error(`[createChecklist] ${type} requires an outcomeId`);
        return null;
      }

      const studiesMap = ydoc.getMap('reviews');
      const studyYMap = studiesMap.get(studyId);

      if (!studyYMap) {
        // Debug: log all study IDs in the YDoc
        const studyIds = Array.from(studiesMap.keys());
        console.error('[createChecklist] Study not found:', studyId);
        console.error('[createChecklist] Available studies in YDoc:', studyIds);
        console.error('[createChecklist] YDoc clientID:', ydoc.clientID);
        return null;
      }

      let checklistsMap = studyYMap.get('checklists');
      if (!checklistsMap) {
        checklistsMap = new Y.Map();
        studyYMap.set('checklists', checklistsMap);
      }

      // Check for duplicate: same type + outcome + assignedTo
      if (requiresOutcome(type) && outcomeId) {
        for (const [, existingChecklistYMap] of checklistsMap.entries()) {
          const existingType = existingChecklistYMap.get('type');
          const existingOutcomeId = existingChecklistYMap.get('outcomeId');
          const existingAssignedTo = existingChecklistYMap.get('assignedTo');

          if (
            existingType === type &&
            existingOutcomeId === outcomeId &&
            existingAssignedTo === assignedTo
          ) {
            console.error(
              `[createChecklist] User already has a ${type} checklist for this outcome`,
            );
            return null;
          }
        }
      }

      const checklistId = crypto.randomUUID();
      const now = Date.now();

      // Get the default answers structure for this checklist type using the registry
      const checklistTemplate = createChecklistOfType(type, {
        id: checklistId,
        name: `${type} Checklist`,
        createdAt: now,
      });

      // Get handler for this type
      const handler = getHandler(type);
      if (!handler) {
        console.warn('[createChecklist] No handler for type, using fallback:', type);
        // Fallback for unknown types: store data directly
        const checklistYMap = new Y.Map();
        checklistYMap.set('type', type);
        checklistYMap.set('title', `${type} Checklist`);
        checklistYMap.set('assignedTo', assignedTo);
        checklistYMap.set('status', CHECKLIST_STATUS.PENDING);
        checklistYMap.set('createdAt', now);
        checklistYMap.set('updatedAt', now);
        if (outcomeId) {
          checklistYMap.set('outcomeId', outcomeId);
        }

        const answersYMap = new Y.Map();
        Object.entries(checklistTemplate).forEach(([key, value]) => {
          answersYMap.set(key, value);
        });
        checklistYMap.set('answers', answersYMap);
        checklistsMap.set(checklistId, checklistYMap);
        studyYMap.set('updatedAt', now);
        return checklistId;
      }

      // Extract answers using handler
      const answersData = handler.extractAnswersFromTemplate(checklistTemplate);

      // Create checklist Y.Map
      const checklistYMap = new Y.Map();
      checklistYMap.set('type', type);
      checklistYMap.set('title', `${type} Checklist`);
      checklistYMap.set('assignedTo', assignedTo);
      checklistYMap.set('status', CHECKLIST_STATUS.PENDING);
      checklistYMap.set('createdAt', now);
      checklistYMap.set('updatedAt', now);

      // Set outcomeId if provided
      if (outcomeId) {
        checklistYMap.set('outcomeId', outcomeId);
      }

      // Create answers Y.Map using handler
      const answersYMap = handler.createAnswersYMap(answersData);
      checklistYMap.set('answers', answersYMap);

      // For ROBINS-I, auto-fill sectionA.outcome with the outcome name
      if (type === CHECKLIST_TYPES.ROBINS_I && outcomeId) {
        const metaMap = ydoc.getMap('meta');
        const outcomesMap = metaMap.get('outcomes');
        if (outcomesMap) {
          const outcomeYMap = outcomesMap.get(outcomeId);
          if (outcomeYMap) {
            const outcomeName = outcomeYMap.get('name');
            if (outcomeName) {
              const sectionAYMap = answersYMap.get('sectionA');
              if (sectionAYMap) {
                const outcomeYText = sectionAYMap.get('outcome');
                if (outcomeYText && typeof outcomeYText.insert === 'function') {
                  outcomeYText.insert(0, outcomeName);
                }
              }
            }
          }
        }
      }

      checklistsMap.set(checklistId, checklistYMap);

      // Update study's updatedAt
      studyYMap.set('updatedAt', now);

      return checklistId;
    } catch (err) {
      console.error('[createChecklist] Error creating checklist:', err);
      return null;
    }
  }

  /**
   * Get full checklist data including answers in plain object format
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @returns {Object|null} The checklist data or null
   */
  function getChecklistData(studyId, checklistId) {
    const result = commonOps.getChecklistYMap(studyId, checklistId);
    if (!result) return null;

    const { checklistYMap, checklistType } = result;
    const data = checklistYMap.toJSON ? checklistYMap.toJSON() : {};

    // Get handler for this type
    const handler = getHandler(checklistType);
    const answersMap = checklistYMap.get('answers');

    let answers = {};
    if (answersMap && typeof answersMap.entries === 'function') {
      if (handler) {
        // Use handler to serialize
        answers = handler.serializeAnswers(answersMap);
      } else {
        // Fallback for unknown types: simple toJSON
        for (const [key, sectionYMap] of answersMap.entries()) {
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
    const result = commonOps.getChecklistYMap(studyId, checklistId);
    if (!result) return;

    const { checklistYMap, checklistType } = result;

    let answersMap = checklistYMap.get('answers');
    if (!answersMap) {
      answersMap = new Y.Map();
      checklistYMap.set('answers', answersMap);
    }

    // Get handler for this type
    const handler = getHandler(checklistType);
    if (handler) {
      // Use handler to update
      handler.updateAnswer(answersMap, key, data);
    } else {
      // Fallback for unknown types: store data directly
      answersMap.set(key, data);
    }

    // Auto-transition status from 'pending' to 'in-progress' on first edit
    const currentStatus = checklistYMap.get('status');
    if (currentStatus === CHECKLIST_STATUS.PENDING) {
      checklistYMap.set('status', CHECKLIST_STATUS.IN_PROGRESS);
    }

    checklistYMap.set('updatedAt', Date.now());
  }

  /**
   * Get a Y.Text reference for a question's note (AMSTAR2-specific)
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} questionKey - The question key (e.g., 'q1', 'q9' for multi-part)
   * @returns {Y.Text|null} The Y.Text reference or null
   */
  function getQuestionNote(studyId, checklistId, questionKey) {
    const textGetter = amstar2Handler.getTextGetter(getYDoc);
    if (!textGetter) return null;
    return textGetter(studyId, checklistId, questionKey);
  }

  /**
   * Get a Y.Text reference for a ROBINS-I free-text field
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} sectionKey - The section key
   * @param {string} fieldKey - The field key
   * @param {string} [questionKey] - Optional question key
   * @returns {Y.Text|null} The Y.Text reference or null
   */
  function getRobinsText(studyId, checklistId, sectionKey, fieldKey, questionKey = null) {
    const textGetter = robinsIHandler.getTextGetter(getYDoc);
    if (!textGetter) return null;
    return textGetter(studyId, checklistId, sectionKey, fieldKey, questionKey);
  }

  /**
   * Get a Y.Text reference for a ROB-2 free-text field
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} sectionKey - The section key
   * @param {string} fieldKey - The field key
   * @param {string} [questionKey] - Optional question key
   * @returns {Y.Text|null} The Y.Text reference or null
   */
  function getRob2Text(studyId, checklistId, sectionKey, fieldKey, questionKey = null) {
    const textGetter = rob2Handler.getTextGetter(getYDoc);
    if (!textGetter) return null;
    return textGetter(studyId, checklistId, sectionKey, fieldKey, questionKey);
  }

  return {
    createChecklist,
    updateChecklist: commonOps.updateChecklist,
    deleteChecklist: commonOps.deleteChecklist,
    getChecklistAnswersMap: commonOps.getChecklistAnswersMap,
    getChecklistData,
    updateChecklistAnswer,
    getQuestionNote,
    getRobinsText,
    getRob2Text,
  };
}
