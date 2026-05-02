import { useCallback } from 'react';
import {
  ROBINSI_DOMAINS,
  RESPONSE_LABELS,
  getActiveDomainKeys,
  getDomainQuestions,
  getROBINSIScoreColor,
} from '../robins-i';
import type { ROBINSIQuestion, ROBINSIDomain } from '../robins-i';
import {
  useChecklistField,
  useAnswer,
  useAnswersYMap,
  useROBINSIScore,
  useROBINSIDomainScore,
} from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';

function ROBINSIScoreBadge({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const score = useROBINSIScore(studyId, checklistId);
  const color = getROBINSIScoreColor(score);

  return (
    <RenderTracker label="ROBINS-I Score (computed)">
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

function ProtocolSelector({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const isPerProtocol = useAnswer<boolean>(studyId, checklistId, 'preliminary.isPerProtocol');
  const answersYMap = useAnswersYMap(studyId, checklistId);

  const handleSelect = useCallback((value: boolean) => {
    answersYMap?.set('preliminary.isPerProtocol', value);
  }, [answersYMap]);

  return (
    <RenderTracker label="Protocol (reactor)">
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
          C4: Effect being estimated:
        </div>
        <label
          style={{
            display: 'flex', gap: 6, alignItems: 'baseline',
            cursor: 'pointer', padding: '2px 0', color: '#334155',
          }}
        >
          <input
            type="radio"
            name="protocol"
            checked={isPerProtocol === false || isPerProtocol === null}
            onChange={() => handleSelect(false)}
          />
          <span style={{ lineHeight: 1.3 }}>No (intention-to-treat effect)</span>
        </label>
        <label
          style={{
            display: 'flex', gap: 6, alignItems: 'baseline',
            cursor: 'pointer', padding: '2px 0', color: '#334155',
          }}
        >
          <input
            type="radio"
            name="protocol"
            checked={isPerProtocol === true}
            onChange={() => handleSelect(true)}
          />
          <span style={{ lineHeight: 1.3 }}>Yes (per-protocol effect)</span>
        </label>
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
  question: ROBINSIQuestion;
}) {
  const answer = useAnswer<string>(studyId, checklistId, question.id);
  const answersYMap = useAnswersYMap(studyId, checklistId);

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
          {question.responses.map((opt) => (
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

function SubsectionBlock({
  studyId,
  checklistId,
  name,
  questions,
}: {
  studyId: string;
  checklistId: string;
  name: string;
  questions: ROBINSIQuestion[];
}) {
  return (
    <div style={{ paddingLeft: 10, borderLeft: '2px solid #e2e8f0', marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
        {name}
      </div>
      {questions.map((q) => (
        <QuestionRow
          key={q.id}
          studyId={studyId}
          checklistId={checklistId}
          question={q}
        />
      ))}
    </div>
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
  const domain = ROBINSI_DOMAINS[domainKey];
  const { judgement, isComplete } = useROBINSIDomainScore(studyId, checklistId, domainKey);

  const judgementColor =
    judgement === 'Low' || judgement?.startsWith('Low (') ? '#16a34a'
    : judgement === 'Moderate' ? '#ca8a04'
    : judgement === 'Serious' ? '#dc2626'
    : judgement === 'Critical' ? '#7f1d1d'
    : '#94a3b8';

  const displayJudgement = !isComplete ? 'Incomplete'
    : judgement?.startsWith('Low (') ? 'Low*' : judgement;

  return (
    <RenderTracker label={`${domainKey} (reactor)`}>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', flex: 1 }}>
            {domain.name}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: judgementColor }}>
            {displayJudgement}
          </span>
        </div>
        {domain.subtitle && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            {domain.subtitle}
          </div>
        )}

        {renderDomainBody(domain, studyId, checklistId)}
      </div>
    </RenderTracker>
  );
}

function renderDomainBody(domain: ROBINSIDomain, studyId: string, checklistId: string) {
  if (domain.subsections) {
    return Object.entries(domain.subsections).map(([key, sub]) => (
      <SubsectionBlock
        key={key}
        studyId={studyId}
        checklistId={checklistId}
        name={sub.name}
        questions={sub.questions}
      />
    ));
  }

  return getDomainQuestions(domain).map((q) => (
    <QuestionRow
      key={q.id}
      studyId={studyId}
      checklistId={checklistId}
      question={q}
    />
  ));
}

export function ROBINSIForm({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  const isPerProtocol = useAnswer<boolean>(studyId, checklistId, 'preliminary.isPerProtocol');
  const status = useChecklistField(studyId, checklistId, 'status');
  const assignedTo = useChecklistField(studyId, checklistId, 'assignedTo');
  const activeDomains = getActiveDomainKeys(isPerProtocol === true);

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
        ROBINS-I -- {checklistId}
      </div>

      <RenderTracker label="ROBINS-I Meta (reactor)">
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
          <span>Status: <strong>{status}</strong></span>
          <span>Assigned: <strong>{assignedTo ?? '(none)'}</strong></span>
        </div>
      </RenderTracker>

      <ROBINSIScoreBadge studyId={studyId} checklistId={checklistId} />

      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
        Same flat-key reactor pattern as ROB2. C4 selector determines Domain 1 variant.
        Domain 3 has subsections -- all questions still flat keys on the same Y.Map.
      </div>

      <ProtocolSelector studyId={studyId} checklistId={checklistId} />

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
