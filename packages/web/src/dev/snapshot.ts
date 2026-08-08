/**
 * Helpers over the engine's workspace snapshot ({formatVersion, schemaVersion,
 * rows: [{tbl, id, data}]}) for the dev "From JSON" import: surface the user
 * ids a snapshot references and rewrite them to real project members. The
 * snapshot is otherwise treated as opaque — only known user-id fields of known
 * collections are touched, everything else round-trips verbatim.
 */

const USER_ID_FIELDS: Record<string, string[]> = {
  studies: ['reviewer1', 'reviewer2'],
  checklists: ['assignedTo'],
  annotations: ['createdBy'],
  outcomes: ['createdBy'],
  pdfs: ['uploadedBy'],
};

interface SnapshotRow {
  tbl: string;
  data: Record<string, unknown>;
}

function snapshotRows(snapshot: Record<string, unknown>): SnapshotRow[] {
  const rows = snapshot.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is SnapshotRow =>
      !!row &&
      typeof row === 'object' &&
      typeof (row as SnapshotRow).tbl === 'string' &&
      !!(row as SnapshotRow).data &&
      typeof (row as SnapshotRow).data === 'object',
  );
}

/** Distinct user ids referenced by a snapshot's rows, in appearance order. */
export function collectSnapshotUserIds(snapshot: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  for (const row of snapshotRows(snapshot)) {
    for (const field of USER_ID_FIELDS[row.tbl] ?? []) {
      const value = row.data[field];
      if (typeof value === 'string' && value) ids.add(value);
    }
  }
  return [...ids];
}

/**
 * Copy of the snapshot with user-id fields rewritten through `mapping`.
 * Unmapped ids pass through, matching the template path's `userMapping`.
 */
export function remapSnapshotUserIds(
  snapshot: Record<string, unknown>,
  mapping: Record<string, string>,
): Record<string, unknown> {
  if (Object.keys(mapping).length === 0) return snapshot;
  const rows = snapshot.rows;
  if (!Array.isArray(rows)) return snapshot;
  return {
    ...snapshot,
    rows: rows.map(row => {
      const fields =
        (
          row &&
          typeof row === 'object' &&
          typeof (row as SnapshotRow).tbl === 'string' &&
          (row as SnapshotRow).data &&
          typeof (row as SnapshotRow).data === 'object'
        ) ?
          USER_ID_FIELDS[(row as SnapshotRow).tbl]
        : undefined;
      if (!fields || fields.length === 0) return row as unknown;
      const data = { ...(row as SnapshotRow).data };
      let changed = false;
      for (const field of fields) {
        const value = data[field];
        if (typeof value === 'string' && mapping[value]) {
          data[field] = mapping[value];
          changed = true;
        }
      }
      return changed ? { ...(row as SnapshotRow), data } : (row as unknown);
    }),
  };
}
