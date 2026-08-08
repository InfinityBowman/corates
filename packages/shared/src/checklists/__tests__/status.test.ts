import { describe, it, expect } from 'vitest';
import { isEditable, getStatusLabel } from '../status.js';

describe('Checklist Status', () => {
  describe('isEditable', () => {
    it('should return true for pending status', () => {
      expect(isEditable('pending')).toBe(true);
    });

    it('should return true for in-progress status', () => {
      expect(isEditable('in-progress')).toBe(true);
    });

    it('should return false for reviewer-completed status', () => {
      expect(isEditable('reviewer-completed')).toBe(false);
    });

    it('should return false for reconciling status', () => {
      expect(isEditable('reconciling')).toBe(false);
    });

    it('should return false for finalized status', () => {
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
