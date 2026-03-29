import { useState, useEffect } from 'react';

/**
 * Subscribe to a Y.Text instance and return its current string value.
 * Handles null/undefined input (returns empty string) and cleans up observers on unmount.
 */
export function useYText(yText: any): string {
  const [value, setValue] = useState(() => yText?.toString() ?? '');

  useEffect(() => {
    if (!yText) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external Y.Text CRDT state
      setValue('');
      return;
    }

    setValue(yText.toString());
    const observer = () => setValue(yText.toString());
    yText.observe(observer);
    return () => yText.unobserve(observer);
  }, [yText]);

  return value;
}
