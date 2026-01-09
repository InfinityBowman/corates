import { describe, it, expect } from 'vitest';
import {
  CHECKLIST_STATUS,
  isEditable,
  getStatusLabel,
  canTransitionTo,
  getStatusStyle,
} from '../status.js';

describe('Checklist Status', () => {
  describe('CHECKLIST_STATUS', () => {
    it('should have all expected statuses', () => {
      expect(CHECKLIST_STATUS.PENDING).toBe('pending');
      expect(CHECKLIST_STATUS.IN_PROGRESS).toBe('in-progress');
      expect(CHECKLIST_STATUS.REVIEWER_COMPLETED).toBe('reviewer-completed');
      expect(CHECKLIST_STATUS.RECONCILING).toBe('reconciling');
      expect(CHECKLIST_STATUS.FINALIZED).toBe('finalized');
    });
  });

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

  describe('canTransitionTo', () => {
    it('should allow pending to transition to in-progress', () => {
      expect(canTransitionTo('pending', 'in-progress')).toBe(true);
    });

    it('should allow in-progress to transition to reviewer-completed', () => {
      expect(canTransitionTo('in-progress', 'reviewer-completed')).toBe(true);
    });

    it('should allow in-progress to transition to finalized', () => {
      expect(canTransitionTo('in-progress', 'finalized')).toBe(true);
    });

    it('should allow reconciling to transition to finalized', () => {
      expect(canTransitionTo('reconciling', 'finalized')).toBe(true);
    });

    it('should not allow finalized to transition anywhere', () => {
      expect(canTransitionTo('finalized', 'pending')).toBe(false);
      expect(canTransitionTo('finalized', 'in-progress')).toBe(false);
    });

    it('should not allow reviewer-completed to transition', () => {
      expect(canTransitionTo('reviewer-completed', 'in-progress')).toBe(false);
    });

    it('should allow staying in the same state', () => {
      expect(canTransitionTo('pending', 'pending')).toBe(true);
      expect(canTransitionTo('in-progress', 'in-progress')).toBe(true);
    });

    it('should not allow skipping states', () => {
      expect(canTransitionTo('pending', 'finalized')).toBe(false);
    });
  });

  describe('getStatusStyle', () => {
    it('should return Tailwind class strings for all statuses', () => {
      expect(typeof getStatusStyle('pending')).toBe('string');
      expect(typeof getStatusStyle('in-progress')).toBe('string');
      expect(typeof getStatusStyle('reviewer-completed')).toBe('string');
      expect(typeof getStatusStyle('reconciling')).toBe('string');
      expect(typeof getStatusStyle('finalized')).toBe('string');
    });

    it('should include background classes', () => {
      expect(getStatusStyle('pending')).toContain('bg-');
      expect(getStatusStyle('in-progress')).toContain('bg-');
    });
  });
});
