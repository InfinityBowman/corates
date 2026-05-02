import { useSortedStudyIds } from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';
import { StudyCard } from './StudyCard';

export function StudyList({
  selectedStudyId,
  onSelectStudy,
}: {
  selectedStudyId: string | null;
  onSelectStudy: (id: string) => void;
}) {
  const studyIds = useSortedStudyIds();

  return (
    <RenderTracker label="StudyList (sorted)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {studyIds.map((id) => (
          <StudyCard
            key={id}
            studyId={id}
            selected={id === selectedStudyId}
            onSelect={() => onSelectStudy(id)}
          />
        ))}
        {studyIds.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>
            No studies.
          </div>
        )}
      </div>
    </RenderTracker>
  );
}
