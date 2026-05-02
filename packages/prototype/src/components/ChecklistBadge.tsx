import { useChecklistField } from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';

const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  in_progress: '#facc15',
  finalized: '#4ade80',
};

export function ChecklistBadge({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const status = useChecklistField(studyId, checklistId, 'status');
  const type = useChecklistField(studyId, checklistId, 'type');

  return (
    <RenderTracker label={`ChecklistBadge [${checklistId}]`}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: STATUS_COLORS[status ?? ''] ?? '#ccc',
          }}
        />
        <span>{type ?? '?'}</span>
        <span style={{ color: '#888' }}>{status}</span>
      </div>
    </RenderTracker>
  );
}
