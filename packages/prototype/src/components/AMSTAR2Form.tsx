import { useCallback, useMemo } from 'react';
import {
  AMSTAR2_QUESTION_KEYS,
  AMSTAR2_SCHEMA,
  getScoreColor,
  cbKey,
  verdictKey,
  deriveVerdict,
} from '../amstar2';
import type { AMSTAR2Column, AMSTAR2Section } from '../amstar2';
import {
  useChecklistField,
  useChecklistScore,
  useQuestionCheckboxes,
  useSectionVerdict,
  useQuestionYMap,
  useProjectReactor,
} from '../reactor/hooks';
import { useYText, resolveYText } from '../reactor/useYText';
import { RenderTracker } from './RenderTracker';

function ScoreBadge({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const score = useChecklistScore(studyId, checklistId);
  const color = getScoreColor(score);

  return (
    <RenderTracker label="ScoreBadge (computed)">
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 6,
          backgroundColor: color + '18',
          border: `1px solid ${color}40`,
          fontSize: 14,
          fontWeight: 600,
          color,
        }}
      >
        Overall Confidence: {score}
      </div>
    </RenderTracker>
  );
}

function QuestionNote({
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
    () => resolveYText(ydoc, studyId, checklistId, questionKey, 'note'),
    [ydoc, studyId, checklistId, questionKey],
  );
  const [note, setNote] = useYText(yText);

  return (
    <RenderTracker label={`Note ${questionKey} (Y.Text)`}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={1}
        placeholder="Add note..."
        style={{
          width: '100%',
          fontSize: 12,
          padding: '3px 6px',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          resize: 'vertical',
          fontFamily: 'inherit',
          color: '#475569',
        }}
      />
    </RenderTracker>
  );
}

function CheckboxColumn({
  column,
  colIdx,
  values,
  onToggle,
}: {
  column: AMSTAR2Column;
  colIdx: number;
  values: boolean[];
  onToggle: (colIdx: number, optIdx: number) => void;
}) {
  return (
    <div style={{ fontSize: 12, marginBottom: 4 }}>
      {column.label && (
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: 2 }}>
          {column.label}
        </div>
      )}
      {column.options.map((opt, optIdx) => (
        <label
          key={optIdx}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'baseline',
            cursor: 'pointer',
            padding: '1px 0',
            color: '#334155',
          }}
        >
          <input
            type="checkbox"
            checked={values[optIdx] ?? false}
            onChange={() => onToggle(colIdx, optIdx)}
            style={{ marginTop: 2 }}
          />
          <span style={{ lineHeight: 1.3 }}>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function VerdictButtons({
  options,
  verdict,
  onSelect,
}: {
  options: string[];
  verdict: string | null;
  onSelect: (opt: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 500,
            border: '1px solid',
            borderRadius: 4,
            cursor: 'pointer',
            borderColor: verdict === opt ? '#3b82f6' : '#d1d5db',
            backgroundColor: verdict === opt ? '#eff6ff' : '#fff',
            color: verdict === opt ? '#1d4ed8' : '#64748b',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionBlock({
  studyId,
  checklistId,
  questionKey,
  section,
}: {
  studyId: string;
  checklistId: string;
  questionKey: string;
  section: AMSTAR2Section;
}) {
  const checkboxes = useQuestionCheckboxes(studyId, checklistId, questionKey, section.key);
  const verdict = useSectionVerdict(studyId, checklistId, questionKey, section.key);
  const qYMap = useQuestionYMap(studyId, checklistId, questionKey);
  const { columns } = section;
  const verdictOptions = columns[columns.length - 1].options;

  const handleCheckboxToggle = useCallback((colIdx: number, optIdx: number) => {
    if (!qYMap) return;
    const key = cbKey(colIdx, optIdx, section.key);
    const cur = qYMap.get(key) as boolean | undefined;
    qYMap.set(key, !cur);

    const getCheckbox = (c: number, o: number) => {
      if (c === colIdx && o === optIdx) return !cur;
      return (qYMap.get(cbKey(c, o, section.key)) as boolean | undefined) ?? false;
    };
    const suggested = deriveVerdict(columns, getCheckbox);
    if (suggested !== null) {
      qYMap.set(verdictKey(section.key), suggested);
    }
  }, [qYMap, columns, section.key]);

  const handleVerdictSelect = useCallback((opt: string) => {
    if (!qYMap) return;
    qYMap.set(verdictKey(section.key), opt);
  }, [qYMap, section.key]);

  const verdictColor = verdict === 'Yes' || verdict === 'Partial Yes'
    ? '#16a34a'
    : verdict === 'No' ? '#dc2626' : '#94a3b8';

  return (
    <RenderTracker label={`${questionKey} ${section.label} (reactor)`}>
      <div style={{ paddingLeft: 12, borderLeft: '2px solid #e2e8f0', marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
            {section.label}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: verdictColor }}>
            {verdict ?? '--'}
          </span>
        </div>

        {columns.slice(0, -1).map((col, colIdx) => (
          <CheckboxColumn
            key={colIdx}
            column={col}
            colIdx={colIdx}
            values={checkboxes[colIdx] ?? []}
            onToggle={handleCheckboxToggle}
          />
        ))}

        <VerdictButtons
          options={verdictOptions}
          verdict={verdict}
          onSelect={handleVerdictSelect}
        />
      </div>
    </RenderTracker>
  );
}

function SimpleQuestionBody({
  studyId,
  checklistId,
  questionKey,
  columns,
}: {
  studyId: string;
  checklistId: string;
  questionKey: string;
  columns: AMSTAR2Column[];
}) {
  const checkboxes = useQuestionCheckboxes(studyId, checklistId, questionKey);
  const verdict = useSectionVerdict(studyId, checklistId, questionKey);
  const qYMap = useQuestionYMap(studyId, checklistId, questionKey);
  const verdictOptions = columns[columns.length - 1].options;

  const handleCheckboxToggle = useCallback((colIdx: number, optIdx: number) => {
    if (!qYMap) return;
    const key = cbKey(colIdx, optIdx);
    const cur = qYMap.get(key) as boolean | undefined;
    qYMap.set(key, !cur);

    const getCheckbox = (c: number, o: number) => {
      if (c === colIdx && o === optIdx) return !cur;
      return (qYMap.get(cbKey(c, o)) as boolean | undefined) ?? false;
    };
    const suggested = deriveVerdict(columns, getCheckbox);
    if (suggested !== null) {
      qYMap.set(verdictKey(), suggested);
    }
  }, [qYMap, columns]);

  const handleVerdictSelect = useCallback((opt: string) => {
    if (!qYMap) return;
    qYMap.set(verdictKey(), opt);
  }, [qYMap]);

  const verdictColor = verdict === 'Yes' || verdict === 'Partial Yes'
    ? '#16a34a'
    : verdict === 'No' ? '#dc2626' : '#94a3b8';

  return (
    <RenderTracker label={`${questionKey} (reactor)`}>
      <>
        <span style={{ fontSize: 11, fontWeight: 600, color: verdictColor, marginLeft: 'auto' }}>
          {verdict ?? '--'}
        </span>

        {columns.slice(0, -1).map((col, colIdx) => (
          <CheckboxColumn
            key={colIdx}
            column={col}
            colIdx={colIdx}
            values={checkboxes[colIdx] ?? []}
            onToggle={handleCheckboxToggle}
          />
        ))}

        <VerdictButtons
          options={verdictOptions}
          verdict={verdict}
          onSelect={handleVerdictSelect}
        />
      </>
    </RenderTracker>
  );
}

function QuestionRow({
  studyId,
  checklistId,
  questionKey,
}: {
  studyId: string;
  checklistId: string;
  questionKey: string;
}) {
  const schema = AMSTAR2_SCHEMA[questionKey];
  const hasSection = !!schema.sections;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        borderRadius: 6,
        border: schema.critical ? '1px solid #fbbf2440' : '1px solid #e2e8f0',
        backgroundColor: schema.critical ? '#fefce808' : undefined,
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', minWidth: 28 }}>
          {questionKey.toUpperCase()}
        </span>
        {schema.critical && (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#ca8a04', letterSpacing: 0.5 }}>
            CRITICAL
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
        {schema.text}
      </div>

      {hasSection ? (
        schema.sections!.map((sec) => (
          <SectionBlock
            key={sec.key}
            studyId={studyId}
            checklistId={checklistId}
            questionKey={questionKey}
            section={sec}
          />
        ))
      ) : (
        <SimpleQuestionBody
          studyId={studyId}
          checklistId={checklistId}
          questionKey={questionKey}
          columns={schema.columns!}
        />
      )}

      <QuestionNote
        studyId={studyId}
        checklistId={checklistId}
        questionKey={questionKey}
      />
    </div>
  );
}

function ChecklistMeta({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const status = useChecklistField(studyId, checklistId, 'status');
  const assignedTo = useChecklistField(studyId, checklistId, 'assignedTo');

  return (
    <RenderTracker label="ChecklistMeta (reactor)">
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
        <span>Status: <strong>{status}</strong></span>
        <span>Assigned: <strong>{assignedTo ?? '(none)'}</strong></span>
      </div>
    </RenderTracker>
  );
}

export function AMSTAR2Form({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        AMSTAR 2 -- {checklistId}
      </div>

      <ChecklistMeta studyId={studyId} checklistId={checklistId} />
      <ScoreBadge studyId={studyId} checklistId={checklistId} />

      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
        Each checkbox is an independent Y.Map key. Q9/Q11 have RCT + NRSI sub-sections
        with separate verdicts consolidated for scoring. Notes use Y.Text.
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 600,
          overflowY: 'auto',
        }}
      >
        {AMSTAR2_QUESTION_KEYS.map((key) => (
          <QuestionRow
            key={key}
            studyId={studyId}
            checklistId={checklistId}
            questionKey={key}
          />
        ))}
      </div>
    </div>
  );
}
