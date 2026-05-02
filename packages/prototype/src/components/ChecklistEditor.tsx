import { useMemo } from 'react';
import { useChecklistField, useProjectReactor } from '../reactor/hooks';
import { useYText, resolveYText } from '../reactor/useYText';
import { RenderTracker } from './RenderTracker';

function ChecklistMeta({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const status = useChecklistField(studyId, checklistId, 'status');
  const type = useChecklistField(studyId, checklistId, 'type');
  const assignedTo = useChecklistField(studyId, checklistId, 'assignedTo');

  return (
    <RenderTracker label="ChecklistMeta (reactor)">
      <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
        <span>Type: <strong>{type}</strong></span>
        <span>Status: <strong>{status}</strong></span>
        <span>Assigned: <strong>{assignedTo ?? '(none)'}</strong></span>
      </div>
    </RenderTracker>
  );
}

function AnswerRow({
  studyId,
  checklistId,
  questionKey,
}: {
  studyId: string;
  checklistId: string;
  questionKey: string;
}) {
  const { ydoc } = useProjectReactor();

  const yText = useMemo(
    () => resolveYText(ydoc, studyId, checklistId, `${questionKey}.note`),
    [ydoc, studyId, checklistId, questionKey],
  );
  const [note, setNote] = useYText(yText);

  return (
    <RenderTracker label={`AnswerRow ${questionKey} (Y.Text)`}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
        <span style={{ fontSize: 13, fontWeight: 500, minWidth: 24 }}>
          {questionKey}:
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          style={{
            flex: 1,
            fontSize: 13,
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
          placeholder="Add a note..."
        />
      </div>
    </RenderTracker>
  );
}

export function ChecklistEditor({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const questionKeys = ['q1', 'q2', 'q3'];

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        Checklist Editor: {checklistId}
      </div>

      <ChecklistMeta studyId={studyId} checklistId={checklistId} />

      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
        Notes below use Y.Text (direct subscription). Typing here does NOT
        trigger reactor-driven components.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {questionKeys.map((qk) => (
          <AnswerRow
            key={qk}
            studyId={studyId}
            checklistId={checklistId}
            questionKey={qk}
          />
        ))}
      </div>
    </div>
  );
}
