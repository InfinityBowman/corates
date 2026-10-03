import { inArray } from 'drizzle-orm';
import type { Database } from '@corates/db/client';
import { organization } from '@corates/db/schema';
import { slugifyWorkspaceName, workspaceSlugCandidates } from '@corates/shared';

/**
 * First free slug for a new or renamed workspace, preferring the slugified
 * name, then the email local part. Falls back to a random suffix when the
 * first twenty numbered candidates are all taken.
 */
export async function pickAvailableWorkspaceSlug(
  db: Database,
  name: string,
  email?: string | null,
): Promise<string> {
  const base = slugifyWorkspaceName(name) || slugifyWorkspaceName(email?.split('@')[0] ?? '');
  const candidates = workspaceSlugCandidates(base);
  const taken = new Set(
    (
      await db
        .select({ slug: organization.slug })
        .from(organization)
        .where(inArray(organization.slug, candidates))
        .all()
    ).map(row => row.slug),
  );
  return (
    candidates.find(slug => !taken.has(slug)) ??
    `${candidates[0].slice(0, 31)}-${crypto.randomUUID().slice(0, 8)}`
  );
}
