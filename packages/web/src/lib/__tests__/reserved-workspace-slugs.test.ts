import { describe, it, expect } from 'vitest';
import { RESERVED_WORKSPACE_SLUGS, workspaceSlugSchema } from '@corates/shared';

// Static routes outrank /$workspace, so a workspace whose slug matched a
// top-level route would be unreachable.
const routeFiles = Object.keys(import.meta.glob('../../routes/**/*.{ts,tsx}'));

function firstUrlSegment(file: string): string | null {
  const parts = file
    .replace('../../routes/', '')
    .replace(/\.(ts|tsx)$/, '')
    .split(/[/.]/)
    // Pathless layouts (_app, _auth, _protected) add no URL segment.
    .filter(part => !part.startsWith('_'));
  const first = parts[0];
  if (!first || first === 'index' || first.startsWith('$')) return null;
  return first.replace(/_$/, '');
}

describe('RESERVED_WORKSPACE_SLUGS', () => {
  it('covers every top-level route a slug could otherwise take', () => {
    const segments = new Set(routeFiles.map(firstUrlSegment).filter((s): s is string => !!s));
    const slugShaped = [...segments].filter(s => /^[a-z0-9-]+$/.test(s));
    expect(slugShaped.length).toBeGreaterThan(10);
    expect(slugShaped.filter(s => !RESERVED_WORKSPACE_SLUGS.has(s))).toEqual([]);
  });

  it('keeps every reserved word out of the slug schema', () => {
    for (const slug of RESERVED_WORKSPACE_SLUGS) {
      expect(workspaceSlugSchema.safeParse(slug).success).toBe(false);
    }
  });
});
