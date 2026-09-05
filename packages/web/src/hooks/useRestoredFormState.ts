/**
 * Restores form state saved before an OAuth redirect (see formStatePersistence)
 * when the URL carries matching restore params for this project.
 */

import { useState, useEffect } from 'react';
import {
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
  type FormType,
} from '@/lib/formStatePersistence';

export function useRestoredFormState<T>(type: FormType, projectId: string): T | null {
  const [restoredState, setRestoredState] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type !== type || restoreParams.projectId !== projectId) return;

    (async () => {
      try {
        const savedState = await getFormState(type, projectId);
        if (!cancelled && savedState) {
          setRestoredState(savedState as T);
          await clearFormState(type, projectId);
        }
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Could not restore your unsaved imports' });
      }
      if (!cancelled) clearRestoreParamsFromUrl();
    })();

    return () => {
      cancelled = true;
    };
  }, [type, projectId]);

  return restoredState;
}
