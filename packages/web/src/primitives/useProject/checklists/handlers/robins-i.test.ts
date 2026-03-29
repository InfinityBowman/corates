/**
 * Tests for ROBINSIHandler - comment field Y.Text preservation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { ROBINSIHandler } from './robins-i.js';

describe('ROBINSIHandler - comment field Y.Text handling', () => {
  let handler;
  let doc;

  beforeEach(() => {
    handler = new ROBINSIHandler();
    doc = new Y.Doc();
  });

  describe('setYTextField helper method', () => {
    it('should create Y.Text when field does not exist', () => {
      const questionYMap = doc.getMap('question');
      handler.setYTextField(questionYMap, 'comment', 'New comment');

      const comment = questionYMap.get('comment');
      expect(comment).toBeInstanceOf(Y.Text);
      expect(comment.toString()).toBe('New comment');
    });

    it('should update existing Y.Text in place, preserving object identity', () => {
      const questionYMap = doc.getMap('question');
      const existingText = new Y.Text();
      existingText.insert(0, 'Original comment');
      questionYMap.set('comment', existingText);

      handler.setYTextField(questionYMap, 'comment', 'Updated comment');

      const comment = questionYMap.get('comment');
      expect(comment).toBe(existingText);
      expect(comment.toString()).toBe('Updated comment');
    });

    it('should upgrade legacy string to Y.Text', () => {
      const questionYMap = doc.getMap('question');
      questionYMap.set('comment', 'Legacy string comment');

      handler.setYTextField(questionYMap, 'comment', 'New comment');

      const comment = questionYMap.get('comment');
      expect(comment).toBeInstanceOf(Y.Text);
      expect(comment.toString()).toBe('New comment');
    });

    it('should handle null by converting to empty string', () => {
      const questionYMap = doc.getMap('question');
      const existingText = new Y.Text();
      existingText.insert(0, 'Existing text');
      questionYMap.set('comment', existingText);

      handler.setYTextField(questionYMap, 'comment', null);

      const comment = questionYMap.get('comment');
      expect(comment).toBeInstanceOf(Y.Text);
      expect(comment.toString()).toBe('');
      expect(comment).toBe(existingText);
    });
  });
});
