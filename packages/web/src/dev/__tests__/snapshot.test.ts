import { describe, it, expect } from 'vitest';
import { collectSnapshotUserIds, remapSnapshotUserIds } from '../snapshot';

const snapshot = {
  formatVersion: 1,
  schemaVersion: 3,
  rows: [
    {
      tbl: 'studies',
      id: 's1',
      data: { id: 's1', name: 'Study 1', reviewer1: 'user_a', reviewer2: 'user_b' },
    },
    { tbl: 'checklists', id: 'c1', data: { id: 'c1', studyId: 's1', assignedTo: 'user_a' } },
    { tbl: 'checklists', id: 'c2', data: { id: 'c2', studyId: 's1', assignedTo: null } },
    { tbl: 'outcomes', id: 'o1', data: { id: 'o1', name: 'Mortality', createdBy: 'user_c' } },
    { tbl: 'pdfs', id: 'p1', data: { id: 'p1', studyId: 's1', uploadedBy: 'user_b' } },
    { tbl: 'answers', id: 'a1', data: { id: 'a1', checklistId: 'c1', key: 'q1', value: 'Yes' } },
  ],
};

describe('collectSnapshotUserIds', () => {
  it('collects distinct user ids from all user-bearing collections in order', () => {
    expect(collectSnapshotUserIds(snapshot)).toEqual(['user_a', 'user_b', 'user_c']);
  });

  it('returns [] for snapshots without a rows array', () => {
    expect(collectSnapshotUserIds({})).toEqual([]);
    expect(collectSnapshotUserIds({ rows: 'nope' })).toEqual([]);
  });
});

describe('remapSnapshotUserIds', () => {
  it('rewrites mapped ids and passes unmapped ids through', () => {
    const remapped = remapSnapshotUserIds(snapshot, { user_a: 'real_1', user_c: 'real_2' });
    expect(collectSnapshotUserIds(remapped)).toEqual(['real_1', 'user_b', 'real_2']);
    const rows = remapped.rows as Array<{ tbl: string; data: Record<string, unknown> }>;
    expect(rows[0].data.reviewer1).toBe('real_1');
    expect(rows[0].data.reviewer2).toBe('user_b');
    expect(rows[1].data.assignedTo).toBe('real_1');
    expect(rows[3].data.createdBy).toBe('real_2');
  });

  it('leaves non-user rows and snapshot metadata untouched', () => {
    const remapped = remapSnapshotUserIds(snapshot, { user_a: 'real_1' });
    expect(remapped.formatVersion).toBe(1);
    expect(remapped.schemaVersion).toBe(3);
    const rows = remapped.rows as Array<{ tbl: string; data: Record<string, unknown> }>;
    expect(rows[5]).toBe(snapshot.rows[5]);
  });

  it('does not mutate the input snapshot', () => {
    remapSnapshotUserIds(snapshot, { user_a: 'real_1' });
    expect(snapshot.rows[0].data.reviewer1).toBe('user_a');
  });

  it('returns the snapshot unchanged for an empty mapping', () => {
    expect(remapSnapshotUserIds(snapshot, {})).toBe(snapshot);
  });
});
