import { describe, expect, it } from 'vitest';
import { checkSchemaEvolution, createTestEngine } from '@cf-sync/server/testing';
import { syncApp } from '../app.js';

const NOW = 1_753_500_000_000;

describe('write gate', () => {
  it('rejects every mutation as ReadOnly when writeAllowed is false, still advancing the mutation id', () => {
    const engine = createTestEngine(syncApp, {
      principal: 'user-1',
      auth: { role: 'member', writeAllowed: false },
    });
    const result = engine.mutate('study.create', {
      id: 's1',
      name: 'Trial',
      description: '',
      now: NOW,
    });
    expect(result.error?.code).toBe('ReadOnly');
    expect(engine.get('studies', 's1')).toBeNull();
    // Invariant 2: permanent rejections advance last_mutation_id.
    expect(engine.lastMutationId()).toBe(1);
  });

  it('rejects an auth context that fails the schema at construction', () => {
    expect(() =>
      createTestEngine(syncApp, { auth: { role: 'superadmin', writeAllowed: true } }),
    ).toThrow();
  });
});

describe('direct writes', () => {
  it('sync.put and sync.del exist for collections but reject every call', () => {
    const engine = createTestEngine(syncApp, {
      principal: 'user-1',
      auth: { role: 'owner', writeAllowed: true },
    });
    const put = engine.mutate('sync.put', {
      tbl: 'studies',
      id: 's1',
      data: { id: 's1', name: 'Trial', createdAt: NOW, updatedAt: NOW },
    });
    expect(put.error?.code).toBe('DirectWriteDisabled');
    expect(engine.get('studies', 's1')).toBeNull();

    const del = engine.mutate('sync.del', { tbl: 'studies', id: 's1' });
    expect(del.error?.code).toBe('DirectWriteDisabled');
  });
});

describe('schema evolution', () => {
  it('every schema change ships with a version bump', async () => {
    await checkSchemaEvolution(syncApp, new URL('./schema-snapshot.json', import.meta.url));
  });
});
