import { describe, expect, it } from 'vitest';
import { deriveFinalized, syncApp } from '@corates/shared/sync';
import { createLocalCollections, localTx } from '../localCollections';
import { studyModelStore } from '../studyModel';

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

function seedStudy(run: ReturnType<typeof runner>, studyId: string, checklistId: string) {
  run('study.create', { id: studyId, name: studyId, description: '', now: NOW });
  run('checklist.create', {
    id: checklistId,
    studyId,
    type: 'AMSTAR2',
    assignedTo: 'local',
    outcomeId: null,
    now: NOW,
  });
}

describe('studyModelStore', () => {
  it('derives score and consolidated answers for finalized checklists only', async () => {
    const collections = createLocalCollections('model-1');
    const run = runner(collections);
    seedStudy(run, 's1', 'done');
    seedStudy(run, 's2', 'open');
    run('checklist.setText', { checklistId: 'done', key: 'q1.note', text: 'finalized note' });
    run('checklist.setText', { checklistId: 'open', key: 'q1.note', text: 'draft note' });
    run('checklist.update', { checklistId: 'done', updates: { status: 'finalized' }, now: NOW });
    await settle();

    const studies = studyModelStore(collections).getSnapshot();
    const done = studies.find(s => s.id === 's1')!.checklists[0]!;
    const open = studies.find(s => s.id === 's2')!.checklists[0]!;
    const doneAnswers: Record<string, unknown> = {};
    for (const row of collections.answers.values()) {
      if (row.checklistId === 'done') doneAnswers[row.key] = row.value;
    }
    expect(doneAnswers['q1.note']).toBe('finalized note');
    const expected = deriveFinalized('AMSTAR2', doneAnswers);
    expect(done.score).toEqual(expected.score);
    expect(done.consolidatedAnswers).toEqual(expected.consolidatedAnswers);
    expect(open.score).toBeNull();
    expect(open.consolidatedAnswers).toBeNull();
  });

  it('gives every caller the same snapshot until a row changes', async () => {
    const collections = createLocalCollections('model-2');
    const run = runner(collections);
    seedStudy(run, 's1', 'c1');
    await settle();

    const store = studyModelStore(collections);
    expect(studyModelStore(collections)).toBe(store);
    const unsubscribe = store.subscribe(() => {});
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);

    run('study.create', { id: 's2', name: 's2', description: '', now: NOW + 1 });
    await settle();
    const second = store.getSnapshot();
    expect(second).not.toBe(first);
    expect(second.map(s => s.id)).toEqual(['s1', 's2']);
    unsubscribe();
  });

  it('notifies once for a mutation that writes several collections', async () => {
    const collections = createLocalCollections('model-3');
    const run = runner(collections);
    run('study.create', { id: 's1', name: 's1', description: '', now: NOW });
    await settle();

    const store = studyModelStore(collections);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    store.getSnapshot();

    // Writes appraisals, checklists and studies in one mutation.
    run('checklist.create', {
      id: 'c1',
      studyId: 's1',
      type: 'AMSTAR2',
      assignedTo: 'local',
      outcomeId: null,
      now: NOW,
    });
    await settle();

    expect(notifications).toBe(1);
    const study = store.getSnapshot()[0]!;
    expect(study.checklists.map(c => c.id)).toEqual(['c1']);
    expect(study.appraisals).toEqual([{ type: 'AMSTAR2', outcomeId: null }]);
    unsubscribe();
  });

  it('reflects rows written while nothing was listening', async () => {
    const collections = createLocalCollections('model-4');
    const run = runner(collections);
    seedStudy(run, 's1', 'c1');
    await settle();

    const store = studyModelStore(collections);
    store.subscribe(() => {})();
    expect(store.getSnapshot()).toHaveLength(1);

    run('study.create', { id: 's2', name: 's2', description: '', now: NOW + 1 });
    await settle();
    const unsubscribe = store.subscribe(() => {});
    expect(store.getSnapshot()).toHaveLength(2);
    unsubscribe();
  });
});
