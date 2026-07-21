/**
 * Bug hunt: useStudyAnnotations never upgrades its shallow fallback observer.
 *
 * When the hook mounts before study.annotations exists, subscribe() attaches a
 * SHALLOW observer to the study Y.Map ("observe the study to catch when it's
 * created"). That observer fires when the 'annotations' key is first set, but
 * the subscription is never re-established as a deep observer on the new
 * annotations map. All later annotation additions/updates/deletes are nested
 * changes that the shallow study observer does not see, so the component is
 * permanently stale until unmount/remount.
 *
 * Real scenario: a project lead (or the second reviewer, read-only) has the
 * checklist PDF view open for a study nobody has annotated yet. The assigned
 * reviewer starts annotating on another client. The watcher receives at most
 * the annotations bundled with the very first sync message that created the
 * container, and never sees any annotation after that.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/project/ConnectionPool', () => ({
  connectionPool: { getEntry: vi.fn() },
}));

import { connectionPool } from '@/project/ConnectionPool';
import { useStudyAnnotations } from '@/primitives/useProject/useStudyAnnotations';
import { createAnnotationOperations } from '@/primitives/useProject/annotations';

function addStudy(doc: Y.Doc, studyId: string) {
  const reviews = doc.getMap('reviews');
  const study = new Y.Map();
  study.set('name', 'Study 1');
  study.set('checklists', new Y.Map());
  reviews.set(studyId, study);
}

describe('useStudyAnnotations subscription upgrade', () => {
  beforeEach(() => {
    vi.mocked(connectionPool.getEntry).mockReset();
  });

  // .fails: documents a known unfixed bug without failing CI. When the bug is
  // fixed, vitest reports this test as failing -- then restore plain it().
  it.fails('keeps receiving annotations added after the annotations map is created', () => {
    const ydoc = new Y.Doc();
    addStudy(ydoc, 's1');
    vi.mocked(connectionPool.getEntry).mockReturnValue({ ydoc } as ReturnType<
      typeof connectionPool.getEntry
    >);

    const ops = createAnnotationOperations('p1', () => ydoc);

    // Component mounts while the study has no annotations yet.
    const { result } = renderHook(() => useStudyAnnotations('p1', 's1', 'cl-1', 'pdf-1'));
    expect(result.current).toEqual([]);

    // First annotation arrives (production code path: lazily creates
    // study.annotations, then the checklist map, then the annotation).
    act(() => {
      ops.addAnnotation('s1', 'pdf-1', 'cl-1', { type: 'highlight', pageIndex: 0 }, 'alice');
    });
    expect(result.current).toHaveLength(1);

    // Second annotation arrives. This is a nested change inside the existing
    // annotations map; the hook must still surface it.
    act(() => {
      ops.addAnnotation('s1', 'pdf-1', 'cl-1', { type: 'underline', pageIndex: 1 }, 'alice');
    });
    expect(result.current).toHaveLength(2);

    // Deleting an annotation must also be surfaced.
    const idToDelete = result.current[0]?.id;
    act(() => {
      ops.deleteAnnotation('s1', 'cl-1', idToDelete);
    });
    expect(result.current).toHaveLength(1);
  });
});
