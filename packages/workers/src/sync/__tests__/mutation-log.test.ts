import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MutationCommitted } from '@cf-sync/server';
import { createMutationLogger, type MutationLogLine } from '../mutation-log';

const WINDOW = 1000;

function committed(overrides: Partial<MutationCommitted> = {}): MutationCommitted {
  return {
    workspaceId: 'project-1',
    name: 'study.create',
    args: { id: 's1', name: 'Secret study title' },
    principal: 'user-1',
    clientId: 'client-1',
    version: 7,
    changes: [{ tbl: 'studies', id: 's1', before: null, after: { id: 's1', name: 'x' } }],
    ...overrides,
  };
}

function answerEdit(overrides: Partial<MutationCommitted> = {}): MutationCommitted {
  return committed({
    name: 'checklist.updateAnswer',
    args: { checklistId: 'cl-1', input: { key: 'q1', value: 'Yes' }, now: 1 },
    changes: [{ tbl: 'answers', id: 'cl-1:q1', before: null, after: { value: 'Yes' } }],
    ...overrides,
  });
}

describe('createMutationLogger', () => {
  let lines: MutationLogLine[];
  let log: (event: MutationCommitted) => void | Promise<void>;

  beforeEach(() => {
    vi.useFakeTimers();
    lines = [];
    log = createMutationLogger(line => lines.push(line), WINDOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs a structural mutation immediately with tables and counts, never args', () => {
    const result = log(
      committed({
        changes: [
          { tbl: 'studies', id: 's1', before: null, after: {} },
          { tbl: 'checklists', id: 'c1', before: null, after: {} },
          { tbl: 'checklists', id: 'c2', before: null, after: {} },
        ],
      }),
    );

    expect(result).toBeUndefined();
    expect(lines).toEqual([
      {
        projectId: 'project-1',
        name: 'study.create',
        userId: 'user-1',
        tables: ['studies', 'checklists'],
        rowCount: 3,
        version: 7,
        count: 1,
      },
    ]);
    expect(JSON.stringify(lines)).not.toContain('Secret study title');
  });

  it('coalesces answer edits on one checklist into a single line per window', async () => {
    const pending = log(answerEdit({ version: 10 }));
    log(answerEdit({ version: 11 }));
    log(
      answerEdit({
        name: 'checklist.setText',
        args: { checklistId: 'cl-1', key: 'notes', text: 'private notes' },
        version: 12,
      }),
    );
    log(answerEdit({ version: 13 }));

    expect(pending).toBeInstanceOf(Promise);
    expect(lines).toEqual([]);

    await vi.advanceTimersByTimeAsync(WINDOW);

    expect(lines).toHaveLength(2);
    expect(lines.find(l => l.name === 'checklist.updateAnswer')).toEqual({
      projectId: 'project-1',
      name: 'checklist.updateAnswer',
      userId: 'user-1',
      tables: ['answers'],
      rowCount: 3,
      version: 13,
      count: 3,
    });
    expect(lines.find(l => l.name === 'checklist.setText')?.count).toBe(1);
    expect(JSON.stringify(lines)).not.toContain('private notes');
  });

  it('keeps windows apart by user and checklist, and opens a new one after flush', async () => {
    log(answerEdit());
    log(answerEdit({ principal: 'user-2' }));
    log(answerEdit({ args: { checklistId: 'cl-2', input: {}, now: 1 } }));

    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(lines).toHaveLength(3);

    log(answerEdit());
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(lines).toHaveLength(4);
    expect(lines[3]?.count).toBe(1);
  });
});
