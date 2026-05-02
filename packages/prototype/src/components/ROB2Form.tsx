import { useCallback, useMemo } from 'react';
import {
  ROB2_DOMAINS,
  ROB2_RESPONSES,
  RESPONSE_LABELS,
  AIM_OPTIONS,
  getActiveDomainKeys,
  getROB2ScoreColor,
  domainDirectionKey,
} from '../rob2';
import type { ROB2Question } from '../rob2';
import {
  useChecklistField,
  useAnswer,
  useAnswersYMap,
  useROB2Score,
  useROB2DomainScore,
  useProjectReactor,
} from '../reactor/hooks';
import { useYText, resolveYText } from '../reactor/useYText';
import { RenderTracker } from './RenderTracker';

const BIAS_DIRECTIONS = [
  'NA',
  'Favours experimental',
  'Favours comparator',
  'Towards null',
  'Away from null',
] as const;

const STUDY_DESIGNS = [
  'Individually-randomized parallel-group trial',
  'Cluster-randomized parallel-group trial',
  'Individually randomized cross-over (or other matched) trial',
] as const;

function ROB2ScoreBadge({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const score = useROB2Score(studyId, checklistId);
  const color = getROB2ScoreColor(score);

  return (
    <RenderTracker label="ROB2 Score (computed)">
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
        Overall: {score}
      </div>
    </RenderTracker>
  );
}

function AimSelector({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const aim = useAnswer<string>(studyId, checklistId, 'preliminary.aim');
  const answersYMap = useAnswersYMap(studyId, checklistId);

  const handleSelect = useCallback((value: string) => {
    answersYMap?.set('preliminary.aim', value);
  }, [answersYMap]);

  return (
    <RenderTracker label="Aim (reactor)">
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
          Assessment aim:
        </div>
        {Object.entries(AIM_OPTIONS).map(([key, label]) => (
          <label
            key={key}
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'baseline',
              cursor: 'pointer',
              padding: '2px 0',
              color: '#334155',
            }}
          >
            <input
              type="radio"
              name="aim"
              checked={aim === key}
              onChange={() => handleSelect(key)}
            />
            <span style={{ lineHeight: 1.3 }}>{label}</span>
          </label>
        ))}
      </div>
    </RenderTracker>
  );
}

function StudyDesignSelector({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const design = useAnswer<string>(studyId, checklistId, 'preliminary.studyDesign');
  const answersYMap = useAnswersYMap(studyId, checklistId);

  return (
    <RenderTracker label="Study Design (reactor)">
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
          Study design:
        </div>
        <select
          value={design ?? ''}
          onChange={(e) => answersYMap?.set('preliminary.studyDesign', e.target.value || null)}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            width: '100%',
          }}
        >
          <option value="">Select...</option>
          {STUDY_DESIGNS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    </RenderTracker>
  );
}

function QuestionComment({
  studyId,
  checklistId,
  questionId,
}: {
  studyId: string;
  checklistId: string;
  questionId: string;
}) {
  const { ydoc } = useProjectReactor();
  const yText = useMemo(
    () => resolveYText(ydoc, studyId, checklistId, `${questionId}.comment`),
    [ydoc, studyId, checklistId, questionId],
  );
  const [comment, setComment] = useYText(yText);

  return (
    <RenderTracker label={`Comment ${questionId} (Y.Text)`}>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={1}
        placeholder="Add comment..."
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

function DirectionSelector({
  studyId,
  checklistId,
  domainKey,
  options,
}: {
  studyId: string;
  checklistId: string;
  domainKey: string;
  options: readonly string[];
}) {
  const dirKey = domainDirectionKey(domainKey);
  const direction = useAnswer<string>(studyId, checklistId, dirKey);
  const answersYMap = useAnswersYMap(studyId, checklistId);

  return (
    <RenderTracker label={`${domainKey} direction (reactor)`}>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        <span style={{ fontWeight: 600, color: '#475569', marginRight: 8 }}>
          Direction:
        </span>
        <select
          value={direction ?? ''}
          onChange={(e) => answersYMap?.set(dirKey, e.target.value || null)}
          style={{
            fontSize: 11,
            padding: '2px 6px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
          }}
        >
          <option value="">Select...</option>
          {options.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    </RenderTracker>
  );
}

function QuestionRow({
  studyId,
  checklistId,
  question,
}: {
  studyId: string;
  checklistId: string;
  question: ROB2Question;
}) {
  const answer = useAnswer<string>(studyId, checklistId, question.id);
  const answersYMap = useAnswersYMap(studyId, checklistId);
  const responses = question.hasNA ? ['NA', ...ROB2_RESPONSES] : ROB2_RESPONSES;

  const handleSelect = useCallback((value: string) => {
    if (!answersYMap) return;
    answersYMap.set(question.id, answersYMap.get(question.id) === value ? null : value);
  }, [answersYMap, question.id]);

  return (
    <RenderTracker label={`${question.id} (reactor)`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
        <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600, color: '#64748b', marginRight: 6 }}>
            {question.number}
          </span>
          {question.text}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {responses.map((opt) => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 500,
                border: '1px solid',
                borderRadius: 4,
                cursor: 'pointer',
                borderColor: answer === opt ? '#3b82f6' : '#d1d5db',
                backgroundColor: answer === opt ? '#eff6ff' : '#fff',
                color: answer === opt ? '#1d4ed8' : '#64748b',
              }}
              title={RESPONSE_LABELS[opt]}
            >
              {opt}
            </button>
          ))}
        </div>
        <QuestionComment
          studyId={studyId}
          checklistId={checklistId}
          questionId={question.id}
        />
      </div>
    </RenderTracker>
  );
}

function DomainBlock({
  studyId,
  checklistId,
  domainKey,
}: {
  studyId: string;
  checklistId: string;
  domainKey: string;
}) {
  const domain = ROB2_DOMAINS[domainKey];
  const { judgement, isComplete } = useROB2DomainScore(studyId, checklistId, domainKey);

  const judgementColor =
    judgement === 'Low' ? '#16a34a'
    : judgement === 'Some concerns' ? '#ca8a04'
    : judgement === 'High' ? '#dc2626'
    : '#94a3b8';

  return (
    <RenderTracker label={`${domainKey} (reactor)`}>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '8px 10px',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', flex: 1 }}>
            {domain.name}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: judgementColor }}>
            {isComplete ? judgement : 'Incomplete'}
          </span>
        </div>
        {domain.subtitle && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            {domain.subtitle}
          </div>
        )}

        {domain.questions.map((q) => (
          <QuestionRow
            key={q.id}
            studyId={studyId}
            checklistId={checklistId}
            question={q}
          />
        ))}

        <DirectionSelector
          studyId={studyId}
          checklistId={checklistId}
          domainKey={domainKey}
          options={BIAS_DIRECTIONS}
        />
      </div>
    </RenderTracker>
  );
}

function OverallDirection({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const direction = useAnswer<string>(studyId, checklistId, 'overall.direction');
  const answersYMap = useAnswersYMap(studyId, checklistId);

  return (
    <RenderTracker label="Overall direction (reactor)">
      <div style={{ fontSize: 12 }}>
        <span style={{ fontWeight: 600, color: '#475569', marginRight: 8 }}>
          Overall direction of bias:
        </span>
        <select
          value={direction ?? ''}
          onChange={(e) => answersYMap?.set('overall.direction', e.target.value || null)}
          style={{
            fontSize: 11,
            padding: '2px 6px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
          }}
        >
          <option value="">Select...</option>
          {BIAS_DIRECTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    </RenderTracker>
  );
}

export function ROB2Form({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const aim = useAnswer<string>(studyId, checklistId, 'preliminary.aim');
  const status = useChecklistField(studyId, checklistId, 'status');
  const assignedTo = useChecklistField(studyId, checklistId, 'assignedTo');
  const activeDomains = getActiveDomainKeys(aim);

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
        RoB 2 -- {checklistId}
      </div>

      <RenderTracker label="ROB2 Meta (reactor)">
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
          <span>Status: <strong>{status}</strong></span>
          <span>Assigned: <strong>{assignedTo ?? '(none)'}</strong></span>
        </div>
      </RenderTracker>

      <ROB2ScoreBadge studyId={studyId} checklistId={checklistId} />

      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
        Each question answer is a flat key on the answers Y.Map. Comments use Y.Text.
        Domain judgements are computed atoms. Direction is a stored flat key.
      </div>

      <AimSelector studyId={studyId} checklistId={checklistId} />
      <StudyDesignSelector studyId={studyId} checklistId={checklistId} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 600,
          overflowY: 'auto',
        }}
      >
        {activeDomains.map((dk) => (
          <DomainBlock
            key={dk}
            studyId={studyId}
            checklistId={checklistId}
            domainKey={dk}
          />
        ))}
      </div>

      <OverallDirection studyId={studyId} checklistId={checklistId} />
    </div>
  );
}
