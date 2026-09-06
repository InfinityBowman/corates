import type * as Y from 'yjs';

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
  // NOTE: end index can legitimately be 0 (when newValue is entirely a suffix
  // of oldValue, i.e. leading text was deleted).
  const insertText = newValue.slice(prefixLen, newValue.length - suffixLen);

  yText.doc!.transact(() => {
    if (deleteCount > 0) yText.delete(prefixLen, deleteCount);
    if (insertText.length > 0) yText.insert(prefixLen, insertText);
  });
}
