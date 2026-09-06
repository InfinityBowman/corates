import { describe, it, expect } from 'vitest';
import { canReconcileChecklists } from './reconcile-access';

const pair = [{ assignedTo: 'alice' }, { assignedTo: 'bob' }];

describe('canReconcileChecklists', () => {
  it('allows an assigned reviewer', () => {
    expect(canReconcileChecklists(pair, 'alice', false)).toBe(true);
    expect(canReconcileChecklists(pair, 'bob', false)).toBe(true);
  });

  it('denies a member on neither checklist', () => {
    expect(canReconcileChecklists(pair, 'nora', false)).toBe(false);
  });

  it('always allows the owner', () => {
    expect(canReconcileChecklists(pair, 'nora', true)).toBe(true);
  });

  it('denies when there is no signed-in user', () => {
    expect(canReconcileChecklists(pair, null, false)).toBe(false);
    expect(canReconcileChecklists(pair, undefined, false)).toBe(false);
  });

  it('denies when the checklists are unassigned', () => {
    expect(canReconcileChecklists([{ assignedTo: null }, {}], 'alice', false)).toBe(false);
  });
});
