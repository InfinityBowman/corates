import { useCallback } from 'react';
import {
  ROB2_DOMAINS,
  ROB2_RESPONSES,
  RESPONSE_LABELS,
  AIM_OPTIONS,
  getActiveDomainKeys,
  getROB2ScoreColor,
} from '../rob2';
import type { ROB2Question } from '../rob2';
import {
  useChecklistField,
  useAnswer,
  useAnswersYMap,
  useROB2Score,
  useROB2DomainScore,
} from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';

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
        Each question answer is a flat key on the answers Y.Map.
        Domain judgements are computed atoms derived from question atoms.
        Same reactor, different schema.
      </div>

      <AimSelector studyId={studyId} checklistId={checklistId} />

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
    </div>
  );
}
