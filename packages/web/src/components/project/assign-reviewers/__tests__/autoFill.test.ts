import { describe, it, expect } from 'vitest';
import { autoFillSlots, countLoad } from '../autoFill';

// Keeps the shuffle a no-op so tie-breaks follow member order.
const random = () => 0;

function emptyRows(count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`s${i}`, { reviewer1: null, reviewer2: null }]),
  );
}

describe('autoFillSlots', () => {
  it('fills both slots on every row with two different people', () => {
    const result = autoFillSlots(emptyRows(3), { memberIds: ['a', 'b', 'c'], random });
    for (const slots of Object.values(result)) {
      expect(slots.reviewer1).not.toBeNull();
      expect(slots.reviewer2).not.toBeNull();
      expect(slots.reviewer1).not.toBe(slots.reviewer2);
    }
  });

  it('spreads studies evenly across the team', () => {
    const result = autoFillSlots(emptyRows(6), { memberIds: ['a', 'b', 'c'], random });
    expect(countLoad(result, {})).toEqual({ a: 4, b: 4, c: 4 });
  });

  it('keeps slots that are already filled', () => {
    const rows = { s1: { reviewer1: 'b', reviewer2: null } };
    const result = autoFillSlots(rows, { memberIds: ['a', 'b'], random });
    expect(result.s1).toEqual({ reviewer1: 'b', reviewer2: 'a' });
  });

  it('counts existing project load so a busy member gets fewer new studies', () => {
    const result = autoFillSlots(emptyRows(2), {
      memberIds: ['a', 'b', 'c'],
      baseLoad: { a: 10 },
      random,
    });
    const load = countLoad(result, {});
    expect(load.a ?? 0).toBe(0);
    expect(load.b).toBe(2);
    expect(load.c).toBe(2);
  });

  it('follows relative shares', () => {
    const result = autoFillSlots(emptyRows(8), {
      memberIds: ['a', 'b', 'c'],
      weights: { a: 50, b: 25, c: 25 },
      random,
    });
    expect(countLoad(result, {})).toEqual({ a: 8, b: 4, c: 4 });
  });

  it('leaves out members with a zero share', () => {
    const result = autoFillSlots(emptyRows(4), {
      memberIds: ['a', 'b', 'c'],
      weights: { a: 50, b: 50, c: 0 },
      random,
    });
    expect(countLoad(result, {})).toEqual({ a: 4, b: 4 });
  });

  it('leaves the second slot empty when only one member exists', () => {
    const result = autoFillSlots(emptyRows(1), { memberIds: ['a'], random });
    expect(result.s0).toEqual({ reviewer1: 'a', reviewer2: null });
  });

  it('returns rows untouched with no members', () => {
    const rows = emptyRows(1);
    expect(autoFillSlots(rows, { memberIds: [], random })).toBe(rows);
  });
});
