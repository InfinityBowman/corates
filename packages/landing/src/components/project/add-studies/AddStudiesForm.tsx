/**
 * AddStudiesForm - Stub for the multi-section add studies form
 * TODO(agent): Migrate PDF upload, DOI lookup, reference import, Google Drive sections
 */

/* eslint-disable no-unused-vars */
interface AddStudiesFormProps {
  projectId: string;
  formType?: string;
  initialState?: any;
  onSaveState?: (state: any) => Promise<void>;
  onAddStudies?: (studies: any[]) => Promise<void>;
}

export function AddStudiesForm({ projectId: _projectId }: AddStudiesFormProps) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">
        Add studies form will be available after full migration.
      </p>
    </div>
  );
}
