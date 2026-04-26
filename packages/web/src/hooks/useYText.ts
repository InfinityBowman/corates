import { useState, useEffect } from 'react';
import type * as Y from 'yjs';

/**
 * Subscribe to a Y.Text instance and return its current string value.
 * Handles null/undefined input (returns empty string) and cleans up observers on unmount.
 */
export function useYText(yText: Y.Text | null): string {
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

/**
 * Apply the minimal diff between `oldValue` and `newValue` to a Y.Text
 * instance. Only the characters that actually changed are deleted/inserted,
 * giving Yjs the positional information it needs to merge concurrent edits
 * in non-overlapping regions.
 */
export function applyYTextDiff(yText: Y.Text, oldValue: string, newValue: string): void {
  if (oldValue === newValue) return;

  let prefixLen = 0;
  const minLen = Math.min(oldValue.length, newValue.length);
  while (prefixLen < minLen && oldValue[prefixLen] === newValue[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldValue[oldValue.length - 1 - suffixLen] === newValue[newValue.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deleteCount = oldValue.length - prefixLen - suffixLen;
  const insertText = newValue.slice(prefixLen, newValue.length - suffixLen || undefined);

  yText.doc!.transact(() => {
    if (deleteCount > 0) yText.delete(prefixLen, deleteCount);
    if (insertText.length > 0) yText.insert(prefixLen, insertText);
  });
}
