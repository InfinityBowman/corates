/**
 * ROBINS-I checklist type handler
 */

import * as Y from 'yjs';
import { ChecklistHandler, yTextToString } from './base.js';

export class ROBINSIHandler extends ChecklistHandler {
  /**
   * Extract answer structure from ROBINS-I checklist template
   * @param {Object} template - The checklist template from createChecklistOfType
   * @returns {Object} Extracted answers data structure
   */
  extractAnswersFromTemplate(template) {
    const answersData = {};
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
    robinsKeys.forEach(key => {
      if (template[key] !== undefined) {
        answersData[key] = template[key];
      }
    });
    return answersData;
  }

  /**
   * Create Y.Map structure for ROBINS-I answers
   * @param {Object} answersData - The extracted answers data
   * @returns {Y.Map} The answers Y.Map
   */
  createAnswersYMap(answersData) {
    const answersYMap = new Y.Map();

    // ROBINS-I: Store each section/domain as nested Y.Maps to support concurrent edits
    Object.entries(answersData).forEach(([key, value]) => {
      const sectionYMap = new Y.Map();

      // Domain keys have nested 'answers' object with individual questions
      if (key.startsWith('domain') || key === 'overall') {
        // Store judgement and direction at section level
        sectionYMap.set('judgement', value.judgement ?? null);
        sectionYMap.set('judgementSource', value.judgementSource ?? 'auto');
        if (value.direction !== undefined) {
          sectionYMap.set('direction', value.direction ?? null);
        }

        // Store each question as a nested Y.Map for concurrent edits
        if (value.answers) {
          const answersNestedYMap = new Y.Map();
          Object.entries(value.answers).forEach(([qKey, qValue]) => {
            const questionYMap = new Y.Map();
            questionYMap.set('answer', qValue.answer ?? null);
            questionYMap.set('comment', new Y.Text());
            answersNestedYMap.set(qKey, questionYMap);
          });
          sectionYMap.set('answers', answersNestedYMap);
        }
      } else if (key === 'sectionB') {
        // Section B has individual questions (b1, b2, b3) and stopAssessment
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (typeof subValue === 'object' && subValue !== null) {
            const questionYMap = new Y.Map();
            questionYMap.set('answer', subValue.answer ?? null);
            questionYMap.set('comment', new Y.Text());
            sectionYMap.set(subKey, questionYMap);
          } else {
            sectionYMap.set(subKey, subValue);
          }
        });
      } else if (key === 'confoundingEvaluation') {
        // Confounding evaluation has arrays - store as JSON for now
        sectionYMap.set('predefined', value.predefined ?? []);
        sectionYMap.set('additional', value.additional ?? []);
      } else if (key === 'sectionD') {
        // Section D has sources object and otherSpecify
        sectionYMap.set('sources', value.sources ?? {});
        sectionYMap.set('otherSpecify', new Y.Text());
      } else if (key === 'planning') {
        // Planning section: confoundingFactors is free text
        sectionYMap.set('confoundingFactors', new Y.Text());
      } else if (key === 'sectionA') {
        // Section A: numericalResult, furtherDetails, outcome are free text
        sectionYMap.set('numericalResult', new Y.Text());
        sectionYMap.set('furtherDetails', new Y.Text());
        sectionYMap.set('outcome', new Y.Text());
      } else if (key === 'sectionC') {
        // Section C: participants, interventionStrategy, comparatorStrategy are free text
        sectionYMap.set('participants', new Y.Text());
        sectionYMap.set('interventionStrategy', new Y.Text());
        sectionYMap.set('comparatorStrategy', new Y.Text());
        sectionYMap.set('isPerProtocol', value.isPerProtocol ?? false);
      } else {
        // Other sections: store each field
        Object.entries(value).forEach(([fieldKey, fieldValue]) => {
          sectionYMap.set(fieldKey, fieldValue);
        });
      }

      answersYMap.set(key, sectionYMap);
    });

    return answersYMap;
  }

  /**
   * Serialize ROBINS-I answers Y.Map to plain object
   * @param {Y.Map} answersMap - The answers Y.Map
   * @returns {Object} Plain object with answers
   */
  serializeAnswers(answersMap) {
    const answers = {};
    for (const [key, sectionYMap] of answersMap.entries()) {
      if (!(sectionYMap instanceof Y.Map)) {
        answers[key] = sectionYMap;
        continue;
      }

      if (key.startsWith('domain')) {
        const sectionData = {
          judgement: sectionYMap.get('judgement') ?? null,
          judgementSource: sectionYMap.get('judgementSource') ?? 'auto',
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
            if (questionYMap instanceof Y.Map) {
              const commentValue = questionYMap.get('comment');
              sectionData.answers[qKey] = {
                answer: questionYMap.get('answer') ?? null,
                comment: yTextToString(commentValue),
              };
            } else {
              sectionData.answers[qKey] = questionYMap;
            }
          }
        }
        answers[key] = sectionData;
      } else if (key === 'overall') {
        // Overall section has judgement and direction but no nested answers
        const sectionData = {
          judgement: sectionYMap.get('judgement') ?? null,
          judgementSource: sectionYMap.get('judgementSource') ?? 'auto',
        };
        const direction = sectionYMap.get('direction');
        if (direction !== undefined) {
          sectionData.direction = direction;
        }
        answers[key] = sectionData;
      } else if (key === 'sectionB') {
        const sectionData = {};
        for (const [subKey, subValue] of sectionYMap.entries()) {
          if (subValue instanceof Y.Map) {
            const commentValue = subValue.get('comment');
            sectionData[subKey] = {
              answer: subValue.get('answer') ?? null,
              comment: yTextToString(commentValue),
            };
          } else {
            sectionData[subKey] = subValue;
          }
        }
        answers[key] = sectionData;
      } else {
        // Other sections (planning, sectionA, sectionC, sectionD): convert Y.Map to plain object
        // Convert Y.Text fields to strings
        const sectionData = {};
        for (const [fieldKey, fieldValue] of sectionYMap.entries()) {
          if (fieldValue instanceof Y.Text) {
            sectionData[fieldKey] = fieldValue.toString();
          } else {
            sectionData[fieldKey] = fieldValue;
          }
        }
        answers[key] = sectionData;
      }
    }
    return answers;
  }

  /**
   * Set a Y.Text field value, preserving the Y.Text object if it exists
   * @param {Y.Map} questionYMap - The question Y.Map
   * @param {string} fieldKey - The field key (e.g., 'comment')
   * @param {string|null} value - The string value to set (null becomes empty string)
   */
  setYTextField(questionYMap, fieldKey, value) {
    const commentStr = value ?? '';
    const existing = questionYMap.get(fieldKey);
    if (existing instanceof Y.Text) {
      // Replace contents of existing Y.Text to preserve object identity
      existing.delete(0, existing.length);
      existing.insert(0, commentStr);
    } else {
      // Create new Y.Text if it doesn't exist or was overwritten with a string
      const newText = new Y.Text();
      newText.insert(0, commentStr);
      questionYMap.set(fieldKey, newText);
    }
  }

  /**
   * Update a single answer/section in ROBINS-I checklist
   * @param {Y.Map} answersMap - The answers Y.Map
   * @param {string} key - The section key (e.g., 'domain1a', 'sectionB')
   * @param {Object} data - The answer data
   */
  updateAnswer(answersMap, key, data) {
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
      if (data.judgementSource !== undefined) {
        sectionYMap.set('judgementSource', data.judgementSource);
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

        Object.entries(data.answers).forEach(([qKey, qValue]) => {
          let questionYMap = answersNestedYMap.get(qKey);
          if (!questionYMap || !(questionYMap instanceof Y.Map)) {
            questionYMap = new Y.Map();
            answersNestedYMap.set(qKey, questionYMap);
          }
          if (qValue.answer !== undefined) questionYMap.set('answer', qValue.answer);
          if (qValue.comment !== undefined) this.setYTextField(questionYMap, 'comment', qValue.comment);
        });
      }
    } else if (key === 'sectionB') {
      // Section B: update individual questions or stopAssessment
      Object.entries(data).forEach(([subKey, subValue]) => {
        if (typeof subValue === 'object' && subValue !== null) {
          let questionYMap = sectionYMap.get(subKey);
          if (!questionYMap || !(questionYMap instanceof Y.Map)) {
            questionYMap = new Y.Map();
            sectionYMap.set(subKey, questionYMap);
          }
          if (subValue.answer !== undefined) questionYMap.set('answer', subValue.answer);
          if (subValue.comment !== undefined) this.setYTextField(questionYMap, 'comment', subValue.comment);
        } else {
          sectionYMap.set(subKey, subValue);
        }
      });
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
      Object.entries(data).forEach(([fieldKey, fieldValue]) => {
        sectionYMap.set(fieldKey, fieldValue);
      });
    }
  }

  /**
   * Get type-specific text getter function for ROBINS-I
   * @param {Function} getYDoc - Function that returns the Y.Doc
   * @returns {Function} getRobinsText function
   */
  getTextGetter(getYDoc) {
    return (studyId, checklistId, sectionKey, fieldKey, questionKey = null) => {
      const ydoc = getYDoc();
      if (!ydoc) return null;

      const studiesMap = ydoc.getMap('reviews');
      const studyYMap = studiesMap.get(studyId);
      if (!studyYMap) return null;

      const checklistsMap = studyYMap.get('checklists');
      if (!checklistsMap) return null;

      const checklistYMap = checklistsMap.get(checklistId);
      if (!checklistYMap) return null;

      const checklistType = checklistYMap.get('type');
      if (checklistType !== 'ROBINS_I') return null;

      const answersMap = checklistYMap.get('answers');
      if (!answersMap) return null;

      const sectionYMap = answersMap.get(sectionKey);
      if (!sectionYMap || !(sectionYMap instanceof Y.Map)) return null;

      // Handle domain questions (domain1a, domain1b, etc.)
      if (sectionKey.startsWith('domain') && questionKey) {
        const answersNestedYMap = sectionYMap.get('answers');
        if (!answersNestedYMap || !(answersNestedYMap instanceof Y.Map)) return null;

        const questionYMap = answersNestedYMap.get(questionKey);
        if (!questionYMap || !(questionYMap instanceof Y.Map)) return null;

        const text = questionYMap.get(fieldKey);
        if (text instanceof Y.Text) {
          return text;
        }

        // Create Y.Text if it doesn't exist
        const newText = new Y.Text();
        questionYMap.set(fieldKey, newText);
        return newText;
      }

      // Handle sectionB questions (b1, b2, b3)
      if (sectionKey === 'sectionB' && questionKey) {
        const questionYMap = sectionYMap.get(questionKey);
        if (!questionYMap || !(questionYMap instanceof Y.Map)) return null;

        const text = questionYMap.get(fieldKey);
        if (text instanceof Y.Text) {
          return text;
        }

        // Create Y.Text if it doesn't exist
        const newText = new Y.Text();
        questionYMap.set(fieldKey, newText);
        return newText;
      }

      // Handle section-level fields (planning, sectionA, sectionC, sectionD)
      const text = sectionYMap.get(fieldKey);
      if (text instanceof Y.Text) {
        return text;
      }

      // Create Y.Text if it doesn't exist
      const newText = new Y.Text();
      sectionYMap.set(fieldKey, newText);
      return newText;
    };
  }
}
