/**
 * useWorkspaceDraft - name and URL for a workspace being named. The URL
 * follows the name until the user edits it themselves.
 */

import { useState } from 'react';
import { slugifyWorkspaceName } from '@corates/shared';
import { useSlugAvailability } from '@/hooks/useSlugAvailability';

export function useWorkspaceDraft(
  initial: {
    name?: string;
    /** The saved slug, when editing an existing workspace. */
    slug?: string;
    orgId?: string;
    /** Start the URL from the name instead of the saved slug. */
    slugFromName?: boolean;
  } = {},
) {
  const [name, setNameState] = useState(initial.name ?? '');
  const [slugInput, setSlugInput] = useState(
    initial.slug && !initial.slugFromName ? initial.slug : slugifyWorkspaceName(initial.name ?? ''),
  );
  const [slugEdited, setSlugEdited] = useState(false);
  const { slug, status } = useSlugAvailability(slugInput, {
    orgId: initial.orgId,
    current: initial.slug,
  });

  function setName(value: string) {
    setNameState(value);
    if (!slugEdited) setSlugInput(slugifyWorkspaceName(value));
  }

  function setSlug(value: string) {
    setSlugEdited(true);
    setSlugInput(value);
  }

  const ready =
    name.trim().length > 0 && (status.state === 'available' || status.state === 'unchanged');

  return { name, setName, slugInput, setSlug, slug, status, ready };
}
