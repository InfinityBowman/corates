/**
 * Base handler interface for checklist type-specific operations
 *
 * All checklist type handlers must implement these methods.
 */

import * as Y from 'yjs';

/**
 * Base handler class that defines the interface for checklist type handlers
 */
export class ChecklistHandler {
  /**
   * Extract answer structure from checklist template
   * @param {Object} _template - The checklist template from createChecklistOfType
   * @returns {Object} Extracted answers data structure
   */
  extractAnswersFromTemplate(_template) {
    throw new Error('extractAnswersFromTemplate must be implemented by subclass');
  }

  /**
   * Create Y.Map structure for answers from extracted data
   * @param {Object} _answersData - The extracted answers data
   * @returns {Y.Map} The answers Y.Map
   */
  createAnswersYMap(_answersData) {
    throw new Error('createAnswersYMap must be implemented by subclass');
  }

  /**
   * Serialize answers Y.Map to plain object
   * @param {Y.Map} _answersMap - The answers Y.Map
   * @returns {Object} Plain object with answers
   */
  serializeAnswers(_answersMap) {
    throw new Error('serializeAnswers must be implemented by subclass');
  }

  /**
   * Update a single answer/section in the answers Y.Map
   * @param {Y.Map} _answersMap - The answers Y.Map
   * @param {string} _key - The answer key (e.g., 'q1' for AMSTAR2, 'domain1a' for ROBINS-I)
   * @param {Object} _data - The answer data
   */
  updateAnswer(_answersMap, _key, _data) {
    throw new Error('updateAnswer must be implemented by subclass');
  }

  /**
   * Get type-specific text getter function
   * @param {Function} _getYDoc - Function that returns the Y.Doc
   * @returns {Function|null} Text getter function or null if not applicable
   */
  getTextGetter(_getYDoc) {
    return null; // Optional - defaults to null
  }
}

/**
 * Helper to convert Y.Text to string safely
 * @param {*} value - Value that might be Y.Text
 * @returns {string} String representation
 */
export function yTextToString(value) {
  if (value instanceof Y.Text) {
    return value.toString();
  }
  return value ?? '';
}
