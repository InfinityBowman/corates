/**
 * AllStudiesTab - Stub for Phase B migration
 * TODO(agent): Migrate study cards, add-studies flow, reviewer assignment
 */

import { useProjectContext } from '../ProjectContext';
import { useProjectStore } from '@/stores/projectStore';

export function AllStudiesTab() {
  const { projectId } = useProjectContext();
  const studies = useProjectStore(s => s.projects[projectId]?.studies || []);

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <h3 className="text-foreground mb-2 font-medium">All Studies ({studies.length})</h3>
      <p className="text-muted-foreground text-sm">
        Study management will be available after full migration.
      </p>
      {studies.length > 0 && (
        <div className="mt-4 space-y-2">
          {studies.map((study: any) => (
            <div key={study.id} className="border-border rounded-lg border p-3">
              <p className="text-foreground text-sm font-medium">{study.name || 'Untitled Study'}</p>
              <p className="text-muted-foreground text-xs">
                {(study.checklists || []).length} checklists
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
