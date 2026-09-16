// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '@/lib/export/exportOptions';
import { checklist, meta, members, study } from '@/lib/export/__tests__/fixtures';
import { useExportPreview } from '../useExportPreview';

const enrich = vi.hoisted(() => vi.fn((_projectId: string, studies: unknown[]) => studies));
vi.mock('@/lib/enrich-studies-for-export', () => ({ enrichStudiesForExport: enrich }));

const pdf = vi.hoisted(() => ({ fail: false }));
vi.mock('@/lib/export-pdf', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/export-pdf')>();
  return {
    ...actual,
    buildProjectPdf: (...args: Parameters<typeof actual.buildProjectPdf>) => {
      if (pdf.fail) throw new Error('boom');
      return actual.buildProjectPdf(...args);
    },
  };
});

function input(options: Partial<ExportOptions> = {}) {
  return {
    members,
    meta,
    projectName: 'Trial',
    options: { ...DEFAULT_EXPORT_OPTIONS, status: 'any' as const, ...options },
  };
}

const studies = [study('s1', [checklist()]), study('s2', [checklist()])];

describe('useExportPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pdf.fail = false;
    enrich.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('builds a PDF from hydrated studies after the debounce and stamps a new version per build', () => {
    const { result, rerender } = renderHook(
      props => useExportPreview('p1', props.studies, props.input),
      {
        initialProps: { studies, input: input() },
      },
    );
    expect(result.current.updating).toBe(true);
    expect(result.current.preview).toBeNull();

    act(() => vi.advanceTimersByTime(200));
    const first = result.current.preview;
    expect(first?.kind).toBe('pdf');
    if (first?.kind !== 'pdf') throw new Error('expected pdf');
    expect(first.pages).toBeGreaterThan(0);
    expect(first.version).toBe(1);
    expect(enrich).toHaveBeenCalledWith('p1', studies);
    expect(result.current.updating).toBe(false);

    rerender({ studies, input: input({ orientation: 'landscape' }) });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.preview).toMatchObject({ kind: 'pdf', version: 2 });
  });

  it('collapses a burst of option changes into one build', () => {
    const { result, rerender } = renderHook(
      props => useExportPreview('p1', props.studies, props.input),
      {
        initialProps: { studies, input: input() },
      },
    );
    rerender({ studies, input: input({ includeNotes: false }) });
    act(() => vi.advanceTimersByTime(100));
    rerender({ studies, input: input({ includeNotes: false, pageSize: 'letter' }) });
    act(() => vi.advanceTimersByTime(199));
    expect(result.current.preview).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.preview).toMatchObject({ kind: 'pdf', version: 1 });
  });

  it('clears the preview when nothing is selected', () => {
    const { result, rerender } = renderHook(
      props => useExportPreview('p1', props.studies, props.input),
      {
        initialProps: { studies, input: input() },
      },
    );
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.preview).not.toBeNull();
    rerender({ studies: [], input: input() });
    expect(result.current.preview).toBeNull();
  });

  it('drops the spinner when the selection empties before a pending build runs', () => {
    const { result, rerender } = renderHook(
      props => useExportPreview('p1', props.studies, props.input),
      {
        initialProps: { studies, input: input() },
      },
    );
    expect(result.current.updating).toBe(true);
    rerender({ studies: [], input: input() });
    expect(result.current.updating).toBe(false);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.preview).toBeNull();
  });

  it('reports a failed build instead of leaving the spinner up', () => {
    pdf.fail = true;
    const { result } = renderHook(() => useExportPreview('p1', studies, input()));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.preview).toEqual({ kind: 'error', message: 'boom' });
    expect(result.current.updating).toBe(false);
  });
});
