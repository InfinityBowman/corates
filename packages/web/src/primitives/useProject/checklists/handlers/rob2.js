/**
 * ROB-2 checklist type handler
 */

import * as Y from 'yjs';
import { ChecklistHandler, yTextToString } from './base.js';

export class ROB2Handler extends ChecklistHandler {
  /**
   * Extract answer structure from ROB-2 checklist template
   * @param {Object} template - The checklist template from createChecklistOfType
   * @returns {Object} Extracted answers data structure
   */
  extractAnswersFromTemplate(template) {
    const answersData = {};
    // ROB-2: Extract preliminary and all domain data
    const rob2Keys = [
      'preliminary',
      'domain1',
      'domain2a',
      'domain2b',
      'domain3',
      'domain4',
      'domain5',
      'overall',
    ];
    rob2Keys.forEach(key => {
      if (template[key] !== undefined) {
        answersData[key] = template[key];
      }
    });
    return answersData;
  }

  /**
   * Create Y.Map structure for ROB-2 answers
   * @param {Object} answersData - The extracted answers data
   * @returns {Y.Map} The answers Y.Map
   */
  createAnswersYMap(answersData) {
    const answersYMap = new Y.Map();

    // ROB-2: Store each section/domain as nested Y.Maps
    Object.entries(answersData).forEach(([key, value]) => {
      const sectionYMap = new Y.Map();

      if (key.startsWith('domain')) {
        // Domain keys have nested 'answers' object with individual questions
        sectionYMap.set('judgement', value.judgement ?? null);
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
      } else if (key === 'overall') {
        // Overall section has judgement and direction but no nested answers
        sectionYMap.set('judgement', value.judgement ?? null);
        sectionYMap.set('direction', value.direction ?? null);
      } else if (key === 'preliminary') {
        // Preliminary section: multiple fields including free text
        sectionYMap.set('studyDesign', value.studyDesign ?? null);
        sectionYMap.set('experimental', new Y.Text());
        sectionYMap.set('comparator', new Y.Text());
        sectionYMap.set('numericalResult', new Y.Text());
        sectionYMap.set('aim', value.aim ?? null);
        sectionYMap.set('deviationsToAddress', value.deviationsToAddress ?? []);
        sectionYMap.set('sources', value.sources ?? {});
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
   * Serialize ROB-2 answers Y.Map to plain object
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
          answers: {},
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
        };
        const direction = sectionYMap.get('direction');
        if (direction !== undefined) {
          sectionData.direction = direction;
        }
        answers[key] = sectionData;
      } else if (key === 'preliminary') {
        // Preliminary section: convert Y.Text fields to strings
        const sectionData = {
          studyDesign: sectionYMap.get('studyDesign') ?? null,
          experimental: yTextToString(sectionYMap.get('experimental')),
          comparator: yTextToString(sectionYMap.get('comparator')),
          numericalResult: yTextToString(sectionYMap.get('numericalResult')),
          aim: sectionYMap.get('aim') ?? null,
          deviationsToAddress: sectionYMap.get('deviationsToAddress') ?? [],
          sources: sectionYMap.get('sources') ?? {},
        };
        answers[key] = sectionData;
      } else {
        // Other sections: convert Y.Map to plain object
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
   * @param {Y.Map} map - The Y.Map containing the field
   * @param {string} fieldKey - The field key
   * @param {string|null} value - The string value to set
   */
  setYTextField(map, fieldKey, value) {
    const str = value ?? '';
    const existing = map.get(fieldKey);
    if (existing instanceof Y.Text) {
      existing.delete(0, existing.length);
      existing.insert(0, str);
    } else {
      const newText = new Y.Text();
      newText.insert(0, str);
      map.set(fieldKey, newText);
    }
  }

  /**
   * Update a single answer/section in ROB-2 checklist
   * @param {Y.Map} answersMap - The answers Y.Map
   * @param {string} key - The section key (e.g., 'domain1', 'preliminary')
   * @param {Object} data - The answer data
   */
  updateAnswer(answersMap, key, data) {
    let sectionYMap = answersMap.get(key);

    // Create section Y.Map if it doesn't exist
    if (!sectionYMap || !(sectionYMap instanceof Y.Map)) {
      sectionYMap = new Y.Map();
      answersMap.set(key, sectionYMap);
    }

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

        Object.entries(data.answers).forEach(([qKey, qValue]) => {
          let questionYMap = answersNestedYMap.get(qKey);
          if (!questionYMap || !(questionYMap instanceof Y.Map)) {
            questionYMap = new Y.Map();
            answersNestedYMap.set(qKey, questionYMap);
          }
          if (qValue.answer !== undefined) questionYMap.set('answer', qValue.answer);
          if (qValue.comment !== undefined)
            this.setYTextField(questionYMap, 'comment', qValue.comment);
        });
      }
    } else if (key === 'preliminary') {
      // Preliminary section: update various fields
      if (data.studyDesign !== undefined) sectionYMap.set('studyDesign', data.studyDesign);
      if (data.aim !== undefined) sectionYMap.set('aim', data.aim);
      if (data.deviationsToAddress !== undefined)
        sectionYMap.set('deviationsToAddress', data.deviationsToAddress);
      if (data.sources !== undefined) sectionYMap.set('sources', data.sources);
      // Free text fields
      if (data.experimental !== undefined)
        this.setYTextField(sectionYMap, 'experimental', data.experimental);
      if (data.comparator !== undefined)
        this.setYTextField(sectionYMap, 'comparator', data.comparator);
      if (data.numericalResult !== undefined)
        this.setYTextField(sectionYMap, 'numericalResult', data.numericalResult);
    } else {
      // Other sections: update individual fields
      Object.entries(data).forEach(([fieldKey, fieldValue]) => {
        sectionYMap.set(fieldKey, fieldValue);
      });
    }
  }

  /**
   * Get type-specific text getter function for ROB-2
   * @param {Function} getYDoc - Function that returns the Y.Doc
   * @returns {Function} getRob2Text function
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
      if (checklistType !== 'ROB2') return null;

      const answersMap = checklistYMap.get('answers');
      if (!answersMap) return null;

      const sectionYMap = answersMap.get(sectionKey);
      if (!sectionYMap || !(sectionYMap instanceof Y.Map)) return null;

      // Handle domain questions
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

      // Handle section-level fields (preliminary, overall)
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
