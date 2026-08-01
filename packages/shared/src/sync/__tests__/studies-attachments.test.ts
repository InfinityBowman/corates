import { describe, expect, it } from 'vitest';
import { createTestEngine } from '@cf-sync/server/testing';
import { syncApp } from '../app.js';
import { reconciliationRowId } from '../ids.js';

const NOW = 1_753_500_000_000;
const LATER = NOW + 60_000;

function newEngine() {
  return createTestEngine(syncApp, {
    principal: 'user-1',
    auth: { role: 'owner', writeAllowed: true },
  });
}

type Engine = ReturnType<typeof newEngine>;

describe('study mutators', () => {
  it('create stores only truthy metadata fields', () => {
    const engine = newEngine();
    const result = engine.mutate('study.create', {
      id: 'study-1',
      name: 'Trial A',
      description: 'desc',
      metadata: { doi: '10.1000/x', firstAuthor: '', pdfAccessible: false, journal: 'BMJ' },
      now: NOW,
    });
    expect(result.error).toBeUndefined();
    const study = engine.get('studies', 'study-1');
    expect(study).toMatchObject({ name: 'Trial A', description: 'desc', doi: '10.1000/x', journal: 'BMJ' });
    expect(study?.firstAuthor).toBeUndefined();
    expect(study?.pdfAccessible).toBeUndefined();
  });

  it('update writes any present field, including empty strings, and bumps updatedAt', () => {
    const engine = newEngine();
    engine.mutate('study.create', {
      id: 'study-1',
      name: 'Trial A',
      description: 'desc',
      metadata: { journal: 'BMJ' },
      now: NOW,
    });
    const result = engine.mutate('study.update', {
      id: 'study-1',
      updates: { description: '', reviewer1: 'user-2', journal: 'Lancet' },
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('studies', 'study-1')).toMatchObject({
      description: '',
      reviewer1: 'user-2',
      journal: 'Lancet',
      updatedAt: LATER,
    });

    expect(
      engine.mutate('study.update', { id: 'ghost', updates: {}, now: LATER }).error?.code,
    ).toBe('NotFound');
  });

  it('importBatch creates every study in one mutation', () => {
    const engine = newEngine();
    const result = engine.mutate('study.importBatch', {
      studies: [
        { id: 's1', name: 'One', description: '' },
        { id: 's2', name: 'Two', description: '', metadata: { doi: '10.1/2' } },
      ],
      now: NOW,
    });
    expect(result.error).toBeUndefined();
    expect(engine.list('studies').map(row => row.id).sort()).toEqual(['s1', 's2']);
    expect(engine.lastMutationId()).toBe(1);
  });

  it('delete cascades to checklists, answers, pdfs, annotations, and reconciliations', () => {
    const engine = newEngine();
    engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
    engine.mutate('outcome.create', { id: 'out-1', name: 'Mortality', createdBy: 'user-1', now: NOW });
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROBINS_I',
      assignedTo: null,
      outcomeId: 'out-1',
      now: NOW,
    });
    engine.mutate('pdf.attach', {
      studyId: 'study-1',
      pdf: { id: 'pdf-1', key: 'r2/abc', fileName: 'a.pdf', size: 100, uploadedBy: 'user-1' },
      tag: 'primary',
      now: NOW,
    });
    engine.mutate('annotation.add', {
      id: 'ann-1',
      studyId: 'study-1',
      checklistId: 'chk-1',
      pdfId: 'pdf-1',
      type: 'highlight',
      pageIndex: 0,
      embedPdfData: '{"id":"ann-1"}',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('reconciliation.saveProgress', {
      studyId: 'study-1',
      outcomeId: 'out-1',
      type: 'ROBINS_I',
      data: { checklist1Id: 'chk-1', checklist2Id: 'chk-x' },
      now: NOW,
    });

    const result = engine.mutate('study.delete', { id: 'study-1' });
    expect(result.error).toBeUndefined();
    expect(engine.get('studies', 'study-1')).toBeNull();
    for (const table of ['checklists', 'answers', 'annotations', 'pdfs', 'reconciliations'] as const) {
      expect(engine.list(table)).toEqual([]);
    }
    // The outcome is project-scoped, not study-scoped; it survives.
    expect(engine.get('outcomes', 'out-1')).not.toBeNull();
  });
});

describe('outcome mutators', () => {
  it('create trims the name and rejects blank names', () => {
    const engine = newEngine();
    engine.mutate('outcome.create', { id: 'out-1', name: '  Mortality  ', createdBy: 'user-1', now: NOW });
    expect(engine.get('outcomes', 'out-1')).toMatchObject({ name: 'Mortality', createdBy: 'user-1' });

    const blank = engine.mutate('outcome.create', { id: 'out-2', name: '   ', createdBy: 'user-1', now: NOW });
    expect(blank.error?.code).toBe('InvalidName');
  });

  it('delete refuses while any checklist references the outcome', () => {
    const engine = newEngine();
    engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
    engine.mutate('outcome.create', { id: 'out-1', name: 'Mortality', createdBy: 'user-1', now: NOW });
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: null,
      outcomeId: 'out-1',
      now: NOW,
    });

    expect(engine.mutate('outcome.delete', { id: 'out-1' }).error?.code).toBe('OutcomeInUse');

    engine.mutate('checklist.delete', { checklistId: 'chk-1', now: LATER });
    expect(engine.mutate('outcome.delete', { id: 'out-1' }).error).toBeUndefined();
    expect(engine.get('outcomes', 'out-1')).toBeNull();
  });
});

describe('pdf mutators', () => {
  function attach(engine: Engine, id: string, tag: 'primary' | 'protocol' | 'secondary') {
    return engine.mutate('pdf.attach', {
      studyId: 'study-1',
      pdf: { id, key: `r2/${id}`, fileName: `${id}.pdf`, size: 10, uploadedBy: 'user-1' },
      tag,
      now: NOW,
    });
  }

  it('attach demotes the previous primary/protocol holder to secondary', () => {
    const engine = newEngine();
    engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
    attach(engine, 'pdf-1', 'primary');
    attach(engine, 'pdf-2', 'primary');
    attach(engine, 'pdf-3', 'secondary');

    expect(engine.get('pdfs', 'pdf-1')?.tag).toBe('secondary');
    expect(engine.get('pdfs', 'pdf-2')?.tag).toBe('primary');
    expect(engine.get('pdfs', 'pdf-3')?.tag).toBe('secondary');
  });

  it('updateTag enforces the same exclusivity', () => {
    const engine = newEngine();
    engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
    attach(engine, 'pdf-1', 'protocol');
    attach(engine, 'pdf-2', 'secondary');

    engine.mutate('pdf.updateTag', { pdfId: 'pdf-2', tag: 'protocol', now: LATER });
    expect(engine.get('pdfs', 'pdf-1')?.tag).toBe('secondary');
    expect(engine.get('pdfs', 'pdf-2')?.tag).toBe('protocol');
  });

  it('updateMetadata sets non-empty fields and deletes emptied ones', () => {
    const engine = newEngine();
    engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
    engine.mutate('pdf.attach', {
      studyId: 'study-1',
      pdf: {
        id: 'pdf-1',
        key: 'r2/a',
        fileName: 'a.pdf',
        size: 10,
        uploadedBy: 'user-1',
        title: 'Old title',
        doi: '10.1/old',
      },
      tag: 'secondary',
      now: NOW,
    });

    engine.mutate('pdf.updateMetadata', {
      pdfId: 'pdf-1',
      metadata: { title: 'New title', doi: '' },
      now: LATER,
    });
    const pdf = engine.get('pdfs', 'pdf-1');
    expect(pdf?.title).toBe('New title');
    expect(pdf?.doi).toBeUndefined();
  });
});

describe('annotation mutators', () => {
  it('merge clones under new ids, rewrites the embedded id, and stamps mergedFrom', () => {
    const engine = newEngine();
    engine.mutate('annotation.add', {
      id: 'ann-1',
      studyId: 'study-1',
      checklistId: 'chk-source',
      pdfId: 'pdf-1',
      type: 'highlight',
      pageIndex: 3,
      embedPdfData: JSON.stringify({ id: 'ann-1', rects: [1, 2] }),
      createdBy: 'user-2',
      now: NOW,
    });

    const result = engine.mutate('annotation.merge', {
      targetChecklistId: 'chk-target',
      copies: [
        { sourceAnnotationId: 'ann-1', newId: 'ann-copy' },
        { sourceAnnotationId: 'ghost', newId: 'never-created' },
      ],
      now: LATER,
    });
    expect(result.error).toBeUndefined();

    const copy = engine.get('annotations', 'ann-copy');
    expect(copy).toMatchObject({
      checklistId: 'chk-target',
      mergedFrom: 'chk-source',
      createdBy: 'user-2',
      createdAt: NOW,
      updatedAt: LATER,
      pageIndex: 3,
    });
    expect(JSON.parse(copy!.embedPdfData)).toMatchObject({ id: 'ann-copy', rects: [1, 2] });
    // The original is untouched; missing sources are skipped, not errors.
    expect(engine.get('annotations', 'ann-1')?.checklistId).toBe('chk-source');
    expect(engine.get('annotations', 'never-created')).toBeNull();
  });

  it('clearForChecklist deletes only that checklist’s annotations', () => {
    const engine = newEngine();
    for (const [id, checklistId] of [
      ['a1', 'chk-1'],
      ['a2', 'chk-1'],
      ['a3', 'chk-2'],
    ] as const) {
      engine.mutate('annotation.add', {
        id,
        studyId: 'study-1',
        checklistId,
        pdfId: 'pdf-1',
        type: 'highlight',
        pageIndex: 0,
        embedPdfData: '{}',
        createdBy: 'user-1',
        now: NOW,
      });
    }
    engine.mutate('annotation.clearForChecklist', { checklistId: 'chk-1' });
    expect(engine.list('annotations').map(row => row.id)).toEqual(['a3']);
  });
});

describe('reconciliation mutators', () => {
  it('saveProgress merges over the existing row instead of dropping absent fields', () => {
    const engine = newEngine();
    engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
    engine.mutate('reconciliation.saveProgress', {
      studyId: 'study-1',
      outcomeId: null,
      type: 'AMSTAR2',
      data: { checklist1Id: 'c1', checklist2Id: 'c2', currentPage: 4, viewMode: 'side-by-side' },
      now: NOW,
    });
    engine.mutate('reconciliation.saveProgress', {
      studyId: 'study-1',
      outcomeId: null,
      type: 'AMSTAR2',
      data: { checklist1Id: 'c1', checklist2Id: 'c2', reconciledChecklistId: 'c3' },
      now: LATER,
    });

    // The null-outcome key is the type-scoped one.
    const row = engine.get('reconciliations', reconciliationRowId('study-1', 'type:AMSTAR2'));
    expect(row).toMatchObject({
      outcomeId: null,
      outcomeKey: 'type:AMSTAR2',
      reconciledChecklistId: 'c3',
      currentPage: 4,
      viewMode: 'side-by-side',
      updatedAt: LATER,
    });
  });

  it('clearProgress removes the row', () => {
    const engine = newEngine();
    engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
    engine.mutate('reconciliation.saveProgress', {
      studyId: 'study-1',
      outcomeId: null,
      type: 'AMSTAR2',
      data: { checklist1Id: 'c1', checklist2Id: 'c2' },
      now: NOW,
    });
    engine.mutate('reconciliation.clearProgress', {
      studyId: 'study-1',
      outcomeId: null,
      type: 'AMSTAR2',
      now: LATER,
    });
    expect(engine.get('reconciliations', reconciliationRowId('study-1', 'type:AMSTAR2'))).toBeNull();
  });
});
