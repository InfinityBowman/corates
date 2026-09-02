import { describe, expect, it } from 'vitest';
import { NOINDEX_META, appLayoutMeta } from '../app';

describe('appLayoutMeta', () => {
  it('marks signed-in and per-user app routes noindex', () => {
    for (const p of ['/dashboard', '/settings', '/settings/billing', '/admin', '/projects/p1']) {
      expect(appLayoutMeta(p)).toEqual([NOINDEX_META]);
    }
  });

  it('leaves the local checklist entry point indexable', () => {
    expect(appLayoutMeta('/checklist')).toEqual([]);
    expect(appLayoutMeta('/checklist/rob2')).toEqual([]);
  });

  it('does not treat a lookalike prefix as the checklist route', () => {
    expect(appLayoutMeta('/checklists')).toEqual([NOINDEX_META]);
  });
});
