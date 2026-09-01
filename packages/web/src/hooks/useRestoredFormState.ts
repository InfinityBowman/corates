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
} from '@/lib/formStatePersistence.js';

export function useRestoredFormState<T>(
  type: FormType,
  projectId: string,
  onRestored?: () => void,
): [T | null, (state: T | null) => void] {
  const [restoredState, setRestoredState] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type === type && restoreParams.projectId === projectId) {
      (async () => {
        try {
          const savedState = await getFormState(type, projectId);
          if (!cancelled && savedState) {
            setRestoredState(savedState as T);
            onRestored?.();
            await clearFormState(type, projectId);
          }
        } catch (err) {
          const { handleError } = await import('@/lib/error-utils');
          await handleError(err, { toastTitle: 'Restore Failed' });
        }
        if (!cancelled) clearRestoreParamsFromUrl();
      })();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, projectId]);

  return [restoredState, setRestoredState];
}
