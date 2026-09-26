import { describe, expect, it, vi } from 'vitest';
import { serializeAnswerRows, syncApp } from '@corates/shared/sync';
import { createLocalCollections, localTx } from '../localCollections';

const collections = createLocalCollections('reader');

vi.mock('@/project/ConnectionPool', () => ({
  connectionPool: {
    getActiveProjectId: () => 'reader',
    getCollections: () => collections,
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
  selectUser: (state: any) => state.user,
}));

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: { getState: () => ({ projects: {} }) },
}));

// The sibling action modules pull in server functions this test never calls.
vi.mock('../actions/studies', () => ({ studyActions: {} }));
vi.mock('../actions/pdfs', () => ({ pdfActions: {} }));
vi.mock('../actions/project', () => ({ projectActions: {} }));
vi.mock('../actions/members', () => ({ memberActions: {} }));
vi.mock('../actions/appraisals', () => ({ appraisalActions: {} }));

const { project } = await import('../actions');

const NOW = 1_753_500_000_000;

function run(name: string, args: unknown) {
  const def = (syncApp.mutators as Record<string, { args: any; apply: any }>)[name]!;
  const parsed = def.args['~standard'].validate(args) as { value?: unknown };
  def.apply(localTx(collections), parsed.value, {
    clientId: 'local',
    authoritative: false,
    seed: 'seed',
    nextId: () => crypto.randomUUID(),
  });
}

describe('project.checklist.dataReader', () => {
  it("serializes each checklist's own answers and nothing else", async () => {
    run('study.create', { id: 's1', name: 's1', description: '', now: NOW });
    for (const id of ['a', 'b']) {
      run('checklist.create', {
        id,
        studyId: 's1',
        type: 'AMSTAR2',
        assignedTo: `reviewer-${id}`,
        outcomeId: null,
        now: NOW,
      });
    }
    run('checklist.setText', { checklistId: 'a', key: 'q1.note', text: 'from a' });
    run('checklist.setText', { checklistId: 'b', key: 'q1.note', text: 'from b' });
    await new Promise(resolve => setTimeout(resolve, 50));

    const read = project.checklist.dataReader();
    for (const id of ['a', 'b']) {
      const flat: Record<string, unknown> = {};
      for (const row of collections.answers.values()) {
        if (row.checklistId === id) flat[row.key] = row.value;
      }
      expect(flat['q1.note']).toBe(`from ${id}`);
      expect(read('s1', id)?.answers).toEqual(serializeAnswerRows('AMSTAR2', flat));
    }
    expect(read('s1', 'missing')).toBeNull();
  });
});
