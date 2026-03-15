/**
 * AMSTAR2ResultsTable - Stub for results table
 * TODO(agent): Migrate the full results table from SolidJS
 */

interface AMSTAR2ResultsTableProps {
  studies: any[];
}

export function AMSTAR2ResultsTable({ studies }: AMSTAR2ResultsTableProps) {
  const hasFinalizedChecklists = studies.some((s: any) =>
    (s.checklists || []).some((c: any) => c.status === 'finalized' && c.type === 'AMSTAR2'),
  );

  if (!hasFinalizedChecklists) {
    return (
      <div className="border-border bg-card rounded-lg border px-4 py-8 text-center">
        <p className="text-muted-foreground">
          Results tables will appear once appraisals are completed.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card rounded-lg border px-4 py-8 text-center">
      <p className="text-muted-foreground">
        Results table will be available after full migration.
      </p>
    </div>
  );
}
