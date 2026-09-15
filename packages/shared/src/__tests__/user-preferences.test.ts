import { describe, it, expect } from 'vitest';
import { parseUserPreferences } from '../user-preferences';

describe('parseUserPreferences', () => {
  it('returns an empty list when the column is unset', () => {
    expect(parseUserPreferences(null)).toEqual({ dismissedHints: [] });
    expect(parseUserPreferences(undefined)).toEqual({ dismissedHints: [] });
    expect(parseUserPreferences('')).toEqual({ dismissedHints: [] });
  });

  it('returns an empty list for malformed JSON or a wrong shape', () => {
    expect(parseUserPreferences('{not json')).toEqual({ dismissedHints: [] });
    expect(parseUserPreferences('{"dismissedHints":"nope"}')).toEqual({ dismissedHints: [] });
  });

  it('defaults dismissedHints and keeps keys it does not know about', () => {
    expect(parseUserPreferences('{"theme":"dark"}')).toEqual({ theme: 'dark', dismissedHints: [] });
    expect(parseUserPreferences('{"theme":"dark","dismissedHints":["studiesExplainer"]}')).toEqual({
      theme: 'dark',
      dismissedHints: ['studiesExplainer'],
    });
  });
});
