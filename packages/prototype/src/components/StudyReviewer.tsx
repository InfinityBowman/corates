import { useStudyField } from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';

export function StudyReviewer({ studyId }: { studyId: string }) {
  const reviewer1 = useStudyField(studyId, 'reviewer1');
  const reviewer2 = useStudyField(studyId, 'reviewer2');
  return (
    <RenderTracker label="StudyReviewer">
      <div style={{ fontSize: 13, color: '#666' }}>
        R1: {reviewer1 ?? '(none)'} | R2: {reviewer2 ?? '(none)'}
      </div>
    </RenderTracker>
  );
}
