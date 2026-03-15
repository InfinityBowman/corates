/**
 * ReviewerAssignment - Stub for bulk reviewer assignment
 * TODO(agent): Migrate the full 634-line ReviewerAssignment component
 */

/* eslint-disable no-unused-vars */
interface ReviewerAssignmentProps {
  studies: any[];
  members: any[];
  onAssignReviewers: (studyId: string, updates: any) => void;
}

export function ReviewerAssignment({ studies }: ReviewerAssignmentProps) {
  const unassigned = studies.filter((s: any) => !s.reviewer1 && !s.reviewer2);
  if (unassigned.length === 0) return null;

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="text-foreground text-sm font-medium">
        {unassigned.length} {unassigned.length === 1 ? 'study needs' : 'studies need'} reviewer
        assignment
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        Bulk reviewer assignment will be available after full migration.
      </p>
    </div>
  );
}
