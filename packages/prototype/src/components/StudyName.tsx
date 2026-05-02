import { useStudyField } from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';

export function StudyName({ studyId }: { studyId: string }) {
  const name = useStudyField(studyId, 'name');
  return (
    <RenderTracker label="StudyName">
      <div style={{ fontSize: 15, fontWeight: 500 }}>{name ?? '(unnamed)'}</div>
    </RenderTracker>
  );
}
