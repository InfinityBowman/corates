/**
 * useSlugAvailability - live check of a workspace URL as the user types:
 * format and reserved words locally, then "taken" against the server.
 */

import { useQuery } from '@tanstack/react-query';
import { workspaceSlugSchema } from '@corates/shared';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { checkSlug } from '@/server/functions/workspaces.functions';

export type SlugStatus =
  | { state: 'unchanged' | 'checking' | 'available' }
  | { state: 'invalid' | 'taken' | 'error'; message: string };

export function useSlugAvailability(slug: string, opts: { orgId?: string; current?: string } = {}) {
  const debounced = useDebouncedValue(slug, 300);
  const parsed = workspaceSlugSchema.safeParse(slug);
  const unchanged = parsed.success && parsed.data === opts.current;

  const query = useQuery({
    queryKey: ['workspaces', 'slug-check', debounced, opts.orgId ?? null],
    queryFn: () => checkSlug({ data: { slug: debounced, orgId: opts.orgId } }),
    enabled: parsed.success && !unchanged && debounced === slug,
    staleTime: 30_000,
  });

  let status: SlugStatus;
  if (!parsed.success) {
    status = { state: 'invalid', message: parsed.error.issues[0]?.message ?? 'Invalid URL.' };
  } else if (unchanged) {
    status = { state: 'unchanged' };
  } else if (query.isError && !query.isFetching && debounced === slug) {
    status = { state: 'error', message: 'Could not check this URL. Edit it to try again.' };
  } else if (debounced !== slug || query.isFetching || !query.data) {
    status = { state: 'checking' };
  } else if (!query.data.available) {
    status = { state: 'taken', message: query.data.message ?? 'That URL is already taken.' };
  } else {
    status = { state: 'available' };
  }

  return { slug: parsed.success ? parsed.data : slug, status };
}
