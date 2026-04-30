import { useRef } from 'react';

/**
 * Freezes a live value while `isEditing` is true, so remote updates
 * don't clobber an in-progress form or modal. When `isEditing` flips
 * back to false, the snapshot catches up to the latest live value.
 */
export function useSnapshotValue<T>(liveValue: T, isEditing: boolean): T {
  const snapshotRef = useRef(liveValue);
  if (!isEditing) snapshotRef.current = liveValue;
  return isEditing ? snapshotRef.current : liveValue;
}
