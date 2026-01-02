/**
 * AMSTAR2 checklist type handler
 */

import * as Y from 'yjs';
import { ChecklistHandler } from './base.js';

export class AMSTAR2Handler extends ChecklistHandler {
  /**
   * Extract answer structure from AMSTAR2 checklist template
   * @param {Object} template - The checklist template from createChecklistOfType
   * @returns {Object} Extracted answers data structure
   */
  extractAnswersFromTemplate(template) {
    const answersData = {};
    // AMSTAR2: Extract question answers (q1, q2, etc.)
    Object.entries(template).forEach(([key, value]) => {
      if (/^q\d+[a-z]*$/i.test(key)) {
        answersData[key] = value;
      }
    });
    return answersData;
  }

  /**
   * Create Y.Map structure for AMSTAR2 answers
   * @param {Object} answersData - The extracted answers data
   * @returns {Y.Map} The answers Y.Map
   */
  createAnswersYMap(answersData) {
    const answersYMap = new Y.Map();

    // AMSTAR2: Store each question as a nested Y.Map with answers, critical, and note
    // Note: q9 and q11 are multi-part questions (q9a/q9b, q11a/q11b) but get one note each
    // at the parent level (q9, q11)
    const multiPartParents = ['q9', 'q11'];
    const subQuestionPattern = /^(q9|q11)[a-z]$/;

    // Track which keys we've added to avoid checking with .has() before map is in document
    const addedKeys = new Set();

    Object.entries(answersData).forEach(([questionKey, questionData]) => {
      const questionYMap = new Y.Map();
      questionYMap.set('answers', questionData.answers);
      questionYMap.set('critical', questionData.critical);

      // Add note for non-sub-questions
      // Sub-questions (q9a, q9b, q11a, q11b) don't get notes - the parent does
      if (!subQuestionPattern.test(questionKey)) {
        questionYMap.set('note', new Y.Text());
      }

      answersYMap.set(questionKey, questionYMap);
      addedKeys.add(questionKey);
    });

    // Add note entries for multi-part parent questions (q9, q11)
    // These don't have answer data but need a note
    multiPartParents.forEach(parentKey => {
      if (!addedKeys.has(parentKey)) {
        const parentYMap = new Y.Map();
        parentYMap.set('note', new Y.Text());
        answersYMap.set(parentKey, parentYMap);
      }
    });

    return answersYMap;
  }

  /**
   * Serialize AMSTAR2 answers Y.Map to plain object
   * @param {Y.Map} answersMap - The answers Y.Map
   * @returns {Object} Plain object with answers
   */
  serializeAnswers(answersMap) {
    const answers = {};
    for (const [key, sectionYMap] of answersMap.entries()) {
      // AMSTAR2: Simple toJSON conversion
      const sectionData = sectionYMap.toJSON ? sectionYMap.toJSON() : sectionYMap;
      answers[key] = sectionData;
    }
    return answers;
  }

  /**
   * Update a single answer in AMSTAR2 checklist
   * @param {Y.Map} answersMap - The answers Y.Map
   * @param {string} key - The question key (e.g., 'q1')
   * @param {Object} data - The answer data { answers, critical }
   */
  updateAnswer(answersMap, key, data) {
    if (data.answers !== undefined) {
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
  }

  /**
   * Get type-specific text getter function for AMSTAR2
   * @param {Function} getYDoc - Function that returns the Y.Doc
   * @returns {Function} getQuestionNote function
   */
  getTextGetter(getYDoc) {
    return (studyId, checklistId, questionKey) => {
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
      const newNote = new Y.Text();
      questionYMap.set('note', newNote);
      return newNote;
    };
  }
}
