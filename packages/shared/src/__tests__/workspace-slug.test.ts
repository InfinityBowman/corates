import { describe, it, expect } from 'vitest';
import {
  slugifyWorkspaceName,
  workspaceSlugCandidates,
  workspaceSlugSchema,
  WORKSPACE_SLUG_MAX,
} from '../workspace-slug.js';

describe('slugifyWorkspaceName', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugifyWorkspaceName('Dana Y.')).toBe('dana-y');
    expect(slugifyWorkspaceName('  Mary   Jo  ')).toBe('mary-jo');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(slugifyWorkspaceName('José Müller')).toBe('jose-muller');
  });

  it('returns empty for names with no Latin letters or digits', () => {
    expect(slugifyWorkspaceName('雅茹')).toBe('');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugifyWorkspaceName(`${'a'.repeat(WORKSPACE_SLUG_MAX - 1)} b`);
    expect(slug.length).toBeLessThanOrEqual(WORKSPACE_SLUG_MAX);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('workspaceSlugCandidates', () => {
  it('starts with the base and then numbers it', () => {
    expect(workspaceSlugCandidates('patricia', 3)).toEqual([
      'patricia',
      'patricia-2',
      'patricia-3',
    ]);
  });

  it('falls back when the base is empty, too short, or reserved', () => {
    expect(workspaceSlugCandidates('', 1)).toEqual(['my-workspace']);
    expect(workspaceSlugCandidates('a', 1)).toEqual(['a-workspace']);
    expect(workspaceSlugCandidates('pricing', 1)).toEqual(['pricing-workspace']);
  });

  it('keeps every candidate valid', () => {
    for (const slug of workspaceSlugCandidates('x'.repeat(WORKSPACE_SLUG_MAX), 12)) {
      expect(workspaceSlugSchema.safeParse(slug).success).toBe(true);
    }
  });
});

describe('workspaceSlugSchema', () => {
  it('accepts a normal slug and normalizes case', () => {
    expect(workspaceSlugSchema.parse('Acme-Lab')).toBe('acme-lab');
  });

  it.each(['a', '-acme', 'acme-', 'ac--me', 'acme_lab', 'dashboard', 'settings'])(
    'rejects %s',
    slug => {
      expect(workspaceSlugSchema.safeParse(slug).success).toBe(false);
    },
  );
});
