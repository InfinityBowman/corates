import { describe, expect, it } from 'vitest';
import { syncApp } from '@corates/shared/sync';
import { createLocalCollections, localTx } from '../localCollections';

const NOW = 1_753_500_000_000;

function runner(collections: ReturnType<typeof createLocalCollections>) {
  const tx = localTx(collections);
  const ctx = {
    clientId: 'local',
    authoritative: false,
    seed: 'seed',
    nextId: () => crypto.randomUUID(),
  };
  return (name: string, args: unknown) => {
    const def = (syncApp.mutators as Record<string, { args: any; apply: any }>)[name]!;
    const parsed = def.args['~standard'].validate(args) as { value?: unknown; issues?: unknown };
    if (parsed.issues) throw new Error(JSON.stringify(parsed.issues));
    def.apply(tx, parsed.value, ctx);
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

describe('localTx', () => {
  it('keeps a row that one creation writes several times once the collection settles', async () => {
    const collections = createLocalCollections('p1');
    const run = runner(collections);
    run('study.create', { id: 's1', name: 'Practice', description: '', now: NOW });
    run('study.assignReviewers', { id: 's1', reviewer1: 'local', now: NOW });
    run('checklist.create', {
      id: 'c1',
      studyId: 's1',
      type: 'AMSTAR2',
      assignedTo: 'local',
      outcomeId: null,
      now: NOW,
    });
    await settle();
    expect(collections.studies.get('s1')).toMatchObject({ reviewer1: 'local' });
    expect(collections.checklists.get('c1')).toMatchObject({ assignedTo: 'local' });
  });

  it('put replaces the row: fields absent from the new row are removed', async () => {
    const collections = createLocalCollections('p2');
    const run = runner(collections);
    run('study.create', { id: 's1', name: 'Practice', description: '', now: NOW });
    run('study.assignReviewers', { id: 's1', reviewer1: 'a', reviewer2: 'b', now: NOW });
    run('study.assignReviewers', { id: 's1', reviewer2: null, now: NOW });
    await settle();
    const study = collections.studies.get('s1')!;
    expect(study.reviewer1).toBe('a');
    expect(study.reviewer2).toBeUndefined();
  });
});
