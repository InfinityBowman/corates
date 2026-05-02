import { useCallback, useMemo } from 'react';
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
  useProjectReactor,
} from '../reactor/hooks';
import { useYText, resolveYText } from '../reactor/useYText';
import { RenderTracker } from './RenderTracker';

const BIAS_DIRECTIONS = [
  'Upward bias (overestimate the effect)',
  'Downward bias (underestimate the effect)',
  'Favours intervention',
  'Favours comparator',
  'Towards null',
  'Away from null',
  'Unpredictable',
] as const;

const DOMAIN1_DIRECTIONS = [
  'Upward bias (overestimate the effect)',
  'Downward bias (underestimate the effect)',
  'Unpredictable',
] as const;

const SECTION_B_QUESTIONS: ROBINSIQuestion[] = [
  { id: 'sectionB.b1', number: 'B1', text: 'Did the authors make any attempt to control for confounding in the result being assessed?', responses: ['Y', 'PY', 'PN', 'N'] },
  { id: 'sectionB.b2', number: 'B2', text: 'If N/PN to B1: Is there sufficient potential for confounding that this result should not be considered further?', responses: ['Y', 'PY', 'PN', 'N'] },
  { id: 'sectionB.b3', number: 'B3', text: 'Was the method of measuring the outcome inappropriate?', responses: ['Y', 'PY', 'PN', 'N'] },
];

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

function SectionTextField({
  studyId,
  checklistId,
  flatKey,
  label,
  placeholder,
}: {
  studyId: string;
  checklistId: string;
  flatKey: string;
  label: string;
  placeholder?: string;
}) {
  const { ydoc } = useProjectReactor();
  const yText = useMemo(
    () => resolveYText(ydoc, studyId, checklistId, flatKey),
    [ydoc, studyId, checklistId, flatKey],
  );
  const [value, setValue] = useYText(yText);

  return (
    <RenderTracker label={`${flatKey} (Y.Text)`}>
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: 2 }}>{label}</div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          placeholder={placeholder}
          style={{
            width: '100%',
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
            resize: 'vertical',
            fontFamily: 'inherit',
            color: '#334155',
          }}
        />
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
        <label style={{ display: 'flex', gap: 6, alignItems: 'baseline', cursor: 'pointer', padding: '2px 0', color: '#334155' }}>
          <input type="radio" name="protocol" checked={isPerProtocol !== true} onChange={() => handleSelect(false)} />
          <span style={{ lineHeight: 1.3 }}>No (intention-to-treat effect)</span>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'baseline', cursor: 'pointer', padding: '2px 0', color: '#334155' }}>
          <input type="radio" name="protocol" checked={isPerProtocol === true} onChange={() => handleSelect(true)} />
          <span style={{ lineHeight: 1.3 }}>Yes (per-protocol effect)</span>
        </label>
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
  const dirKey = `${domainKey}.direction`;
  const direction = useAnswer<string>(studyId, checklistId, dirKey);
  const answersYMap = useAnswersYMap(studyId, checklistId);

  return (
    <RenderTracker label={`${domainKey} direction (reactor)`}>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        <span style={{ fontWeight: 600, color: '#475569', marginRight: 8 }}>Direction:</span>
        <select
          value={direction ?? ''}
          onChange={(e) => answersYMap?.set(dirKey, e.target.value || null)}
          style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
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
        <QuestionComment studyId={studyId} checklistId={checklistId} questionId={question.id} />
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
        <QuestionRow key={q.id} studyId={studyId} checklistId={checklistId} question={q} />
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

  const dirOptions = domainKey === 'domain1a' || domainKey === 'domain1b'
    ? DOMAIN1_DIRECTIONS : BIAS_DIRECTIONS;

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

        <DirectionSelector
          studyId={studyId}
          checklistId={checklistId}
          domainKey={domainKey}
          options={dirOptions}
        />
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
    <QuestionRow key={q.id} studyId={studyId} checklistId={checklistId} question={q} />
  ));
}

function SectionB({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  return (
    <div style={{ border: '1px solid #fbbf2440', borderRadius: 6, padding: '8px 10px', backgroundColor: '#fefce808' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
        Section B: Decide whether to proceed
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        If B2 or B3 = Y/PY, the result is at Critical risk of bias and no further assessment is needed.
      </div>
      {SECTION_B_QUESTIONS.map((q) => (
        <QuestionRow key={q.id} studyId={studyId} checklistId={checklistId} question={q} />
      ))}
    </div>
  );
}

function SectionA({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
        Section A: Specify the result being assessed
      </div>
      <SectionTextField studyId={studyId} checklistId={checklistId} flatKey="sectionA.numericalResult" label="A1: Numerical result" placeholder="e.g., OR = 1.5 (95% CI: 1.2-1.9)" />
      <SectionTextField studyId={studyId} checklistId={checklistId} flatKey="sectionA.furtherDetails" label="A2: Further details (optional)" placeholder="e.g., Table 3, primary outcome analysis" />
      <SectionTextField studyId={studyId} checklistId={checklistId} flatKey="sectionA.outcome" label="A3: Outcome" placeholder="e.g., All-cause mortality at 12 months" />
    </div>
  );
}

function SectionC({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
        Section C: Target randomized trial
      </div>
      <SectionTextField studyId={studyId} checklistId={checklistId} flatKey="sectionC.participants" label="C1: Participants" placeholder="e.g., Adults aged 18+ with type 2 diabetes" />
      <SectionTextField studyId={studyId} checklistId={checklistId} flatKey="sectionC.interventionStrategy" label="C2: Intervention strategy" placeholder="e.g., Initiation of metformin 500mg twice daily" />
      <SectionTextField studyId={studyId} checklistId={checklistId} flatKey="sectionC.comparatorStrategy" label="C3: Comparator strategy" placeholder="e.g., Initiation of sulfonylurea therapy" />
      <ProtocolSelector studyId={studyId} checklistId={checklistId} />
    </div>
  );
}

function PlanningSection({
  studyId,
  checklistId,
}: {
  studyId: string;
  checklistId: string;
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
        Planning: Confounding factors
      </div>
      <SectionTextField
        studyId={studyId}
        checklistId={checklistId}
        flatKey="planning.confoundingFactors"
        label="P1: Important confounding factors"
        placeholder="e.g., Age, baseline disease severity, comorbidities..."
      />
    </div>
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
          style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
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
        Same flat-key reactor pattern as ROB2. Section text fields use Y.Text.
        Comments use Y.Text. Direction is a stored flat key.
      </div>

      <PlanningSection studyId={studyId} checklistId={checklistId} />
      <SectionA studyId={studyId} checklistId={checklistId} />
      <SectionB studyId={studyId} checklistId={checklistId} />
      <SectionC studyId={studyId} checklistId={checklistId} />

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
