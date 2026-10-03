/**
 * Workspace URL slugs. The slug is the first path segment of every in-workspace
 * route (corates.org/<slug>/...), so it must never shadow a top-level route or a
 * static asset directory.
 */

import { z } from 'zod';

export const WORKSPACE_SLUG_MIN = 2;
export const WORKSPACE_SLUG_MAX = 40;

// Top-level app routes, static asset directories, and a few names kept back for
// routes we are likely to add. A web test fails when a new top-level route is
// missing from this list.
export const RESERVED_WORKSPACE_SLUGS: ReadonlySet<string> = new Set([
  'about',
  'account',
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'billing',
  'blog',
  'checklist',
  'complete-profile',
  'contact',
  'create-workspace',
  'dashboard',
  'dev-pdfs',
  'docs',
  'fonts',
  'health',
  'healthz',
  'help',
  'invite',
  'join',
  'login',
  'logos',
  'logout',
  'new',
  'orgs',
  'pricing',
  'privacy',
  'projects',
  'reset-password',
  'resources',
  'security',
  'settings',
  'signin',
  'signout',
  'signup',
  'static',
  'support',
  'terms',
  'verify-email',
  'workspace',
  'workspaces',
  'www',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(WORKSPACE_SLUG_MIN, `Use at least ${WORKSPACE_SLUG_MIN} characters.`)
  .max(WORKSPACE_SLUG_MAX, `Use at most ${WORKSPACE_SLUG_MAX} characters.`)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers, and single hyphens between them.')
  .refine(slug => !RESERVED_WORKSPACE_SLUGS.has(slug), 'That URL is reserved. Try another.');

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a workspace name.')
  .max(80, 'Use at most 80 characters.');

/**
 * Best-effort slug from free text. Returns '' when nothing usable survives (for
 * example a name written only in a non-Latin script), so callers pick their own
 * fallback.
 */
export function slugifyWorkspaceName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, WORKSPACE_SLUG_MAX)
    .replace(/-+$/, '');
}

/**
 * Candidate slugs in preference order: the base, then -2, -3, and so on. The
 * base is padded out of the reserved list and up to the minimum length first.
 */
export function workspaceSlugCandidates(base: string, count = 20): string[] {
  let root = base || 'my-workspace';
  if (root.length < WORKSPACE_SLUG_MIN || RESERVED_WORKSPACE_SLUGS.has(root)) {
    root = `${root}-workspace`.slice(0, WORKSPACE_SLUG_MAX);
  }
  const candidates = [root];
  for (let n = 2; candidates.length < count; n++) {
    const suffix = `-${n}`;
    candidates.push(root.slice(0, WORKSPACE_SLUG_MAX - suffix.length).replace(/-+$/, '') + suffix);
  }
  return candidates;
}
