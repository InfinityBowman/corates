import { useChecklistIds, useStudyComputed } from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';
import { StudyName } from './StudyName';
import { StudyReviewer } from './StudyReviewer';
import { ChecklistBadge } from './ChecklistBadge';

function UnassignedBadge({ studyId }: { studyId: string }) {
  const isUnassigned = useStudyComputed(studyId, 'unassigned', (fields) => {
    return !fields.field<string | null>('reviewer1').get()
      && !fields.field<string | null>('reviewer2').get();
  });

  if (!isUnassigned) return null;

  return (
    <RenderTracker label="UnassignedBadge (computed)">
      <span
        style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 9999,
          background: '#fef3c7',
          color: '#92400e',
        }}
      >
        Unassigned
      </span>
    </RenderTracker>
  );
}

export function StudyCard({
  studyId,
  selected,
  onSelect,
}: {
  studyId: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const checklistIds = useChecklistIds(studyId);

  return (
    <RenderTracker label={`StudyCard [${studyId}]`}>
      <div
        onClick={onSelect}
        style={{
          border: selected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <StudyName studyId={studyId} />
          <UnassignedBadge studyId={studyId} />
        </div>
        <StudyReviewer studyId={studyId} />
        {checklistIds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {checklistIds.map((clId) => (
              <ChecklistBadge key={clId} studyId={studyId} checklistId={clId} />
            ))}
          </div>
        )}
      </div>
    </RenderTracker>
  );
}
