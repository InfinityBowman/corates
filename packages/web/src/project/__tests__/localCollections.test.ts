import { describe, expect, it } from 'vitest';
import { createLocalCollections, seedLocalCollections } from '../localCollections';

const base = {
  studyId: 's1',
  type: 'AMSTAR2',
  title: 'AMSTAR2 Checklist',
  assignedTo: null,
  outcomeId: null,
  createdAt: 1,
  updatedAt: 1,
};

describe('seedLocalCollections', () => {
  it('derives kind for rows persisted before it existed and keeps a stored kind', () => {
    const collections = createLocalCollections('p1');
    seedLocalCollections(collections, {
      studies: [],
      answers: [],
      checklists: [
        { ...base, id: 'practice', status: 'in-progress' },
        { ...base, id: 'reconciled', status: 'finalized' },
        { ...base, id: 'stored', status: 'finalized', kind: 'reviewer' },
      ],
    });
    // Local reviewer checklists are unassigned too, so status is the only legacy marker.
    expect(collections.checklists.get('practice')?.kind).toBe('reviewer');
    expect(collections.checklists.get('reconciled')?.kind).toBe('consensus');
    expect(collections.checklists.get('stored')?.kind).toBe('reviewer');
  });
});
