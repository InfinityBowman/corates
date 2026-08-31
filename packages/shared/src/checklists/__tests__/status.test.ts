import { describe, it, expect } from 'vitest';
import { isEditable, getStatusLabel } from '../status.js';

describe('Checklist Status', () => {
  describe('isEditable', () => {
    it('is true for pending and in-progress, false for later statuses', () => {
      expect(isEditable('pending')).toBe(true);
      expect(isEditable('in-progress')).toBe(true);
      expect(isEditable('reviewer-completed')).toBe(false);
      expect(isEditable('reconciling')).toBe(false);
      expect(isEditable('finalized')).toBe(false);
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct labels', () => {
      expect(getStatusLabel('pending')).toBe('Pending');
      expect(getStatusLabel('in-progress')).toBe('In Progress');
      expect(getStatusLabel('reviewer-completed')).toBe('Reviewer Completed');
      expect(getStatusLabel('reconciling')).toBe('Reconciling');
      expect(getStatusLabel('finalized')).toBe('Finalized');
    });

    it('should return the status itself for unknown statuses', () => {
      expect(getStatusLabel('invalid')).toBe('invalid');
    });

    it('should return Pending for undefined status', () => {
      expect(getStatusLabel(undefined)).toBe('Pending');
    });
  });
});
