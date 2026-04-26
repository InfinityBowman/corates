/**
 * AMSTAR2Checklist - Full AMSTAR2 appraisal form with 16 questions
 *
 * Each question has a unique column structure with checkboxes (evidence criteria)
 * and a final radio column (verdict: Yes/Partial Yes/No). Checking criteria in
 * earlier columns automatically derives the verdict in the last column.
 *
 * Supports both controlled mode (externalChecklist + onExternalUpdate from Yjs)
 * and uncontrolled mode (standalone with local state).
 */

import { useState, useCallback, useMemo } from 'react';
import type * as Y from 'yjs';
import { InfoIcon } from 'lucide-react';
import { AMSTAR_CHECKLIST } from './checklist-map';
import { createChecklist as createAMSTAR2Checklist } from './checklist.js';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import type { TextRef } from '@/primitives/useProject/checklists';
import type {
  AMSTAR2Checklist as AMSTAR2ChecklistType,
  AMSTAR2QuestionAnswer,
} from '@corates/shared/checklists';
import type { AMSTAR2QuestionSchema, AMSTAR2Column } from '@corates/shared/checklists/amstar2';

// -- Shared internal components --

function QuestionInfo({ question }: { question: AMSTAR2QuestionSchema }) {
  return (
    <div className='absolute top-1.5 right-1.5'>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            className='focus:ring-primary inline-flex items-center justify-center rounded-full p-1.5 opacity-70 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:outline-none'
          >
            <InfoIcon className='size-3' />
          </button>
        </TooltipTrigger>
        <TooltipContent className='max-w-xs'>{question.info}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function CriticalButton({
  state,
  onUpdate,
}: {
  state: AMSTAR2QuestionAnswer;
  onUpdate: (_newState: AMSTAR2QuestionAnswer) => void;
}) {
  return (
    <div className='ml-auto'>
      <button
        type='button'
        className={`ml-2 h-6 rounded-full px-3 text-xs font-medium text-nowrap transition-colors ${
          state.critical ?
            'border border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
          : 'border-border bg-secondary text-secondary-foreground hover:bg-muted border'
        }`}
        onClick={() => onUpdate({ ...state, critical: !state.critical })}
        aria-pressed={state.critical}
      >
        {state.critical ? 'Critical' : 'Not Critical'}
      </button>
    </div>
  );
}

function StandardQuestionInternal({
  state,
  question,
  columns,
  handleChange,
  width,
}: {
  state: AMSTAR2QuestionAnswer;
  question: { text: string };
  columns?: AMSTAR2Column[];
  handleChange: (_colIdx: number, _optIdx: number) => void;
  width?: string;
}) {
  return (
    <div className='flex flex-col gap-4 sm:flex-row sm:gap-6'>
      {(columns || []).map((col, colIdx) => {
        const isLastCol = colIdx === (columns || []).length - 1;
        return (
          <div
            key={colIdx}
            className={
              isLastCol ?
                `${width ?? 'w-32'} flex min-w-0 flex-col`
              : 'flex min-w-0 flex-1 flex-col'
            }
          >
            <div className='wrap-break-words text-foreground flex min-h-8 w-full min-w-0 items-center text-xs font-semibold whitespace-normal'>
              {col.label}
            </div>
            {col.description && (
              <div className='wrap-break-words text-foreground -mt-1 mb-2 flex items-center text-xs'>
                {col.description}
              </div>
            )}
            {isLastCol ?
              <div className='mt-1 flex flex-col gap-2'>
                {col.options.map((option: string, optIdx: number) => (
                  <label key={optIdx} className='flex items-center gap-2 text-xs'>
                    <input
                      type='radio'
                      name={`col-${colIdx}-${question?.text ?? ''}`}
                      checked={state.answers[colIdx]?.[optIdx] ?? false}
                      onChange={() => handleChange(colIdx, optIdx)}
                      className='border-border focus:ring-primary size-3.5 cursor-pointer text-blue-600'
                    />
                    <span className='wrap-break-words text-secondary-foreground'>{option}</span>
                  </label>
                ))}
              </div>
            : <div className='flex flex-col gap-2'>
                {col.options.map((option: string, optIdx: number) => (
                  <label key={optIdx} className='flex items-center gap-2 text-xs'>
                    <input
                      type='checkbox'
                      checked={state.answers[colIdx]?.[optIdx] ?? false}
                      onChange={() => handleChange(colIdx, optIdx)}
                      className='border-border focus:ring-primary size-3 shrink-0 text-blue-600'
                    />
                    <span className='wrap-break-words text-secondary-foreground'>{option}</span>
                  </label>
                ))}
              </div>
            }
          </div>
        );
      })}
    </div>
  );
}

function StandardQuestion({
  state,
  question,
  handleChange,
  onUpdate,
  getTextRef,
  readOnly,
  width,
}: {
  state: AMSTAR2QuestionAnswer;
  question: AMSTAR2QuestionSchema;
  handleChange: (_colIdx: number, _optIdx: number) => void;
  onUpdate: (_newState: AMSTAR2QuestionAnswer) => void;
  getTextRef: (_ref: TextRef) => Y.Text | null;
  readOnly?: boolean;
  width?: string;
}) {
  const questionKey = useMemo(() => {
    const match = question.text.match(/^(\d+[a-z]?)\./);
    return `q${match?.[1] ?? ''}`;
  }, [question]);

  const noteYText = useMemo(
    () => getTextRef({ type: 'AMSTAR2', questionKey }),
    [questionKey, getTextRef],
  );

  return (
    <div className='bg-card relative rounded-lg p-7 pb-3 shadow-md'>
      <QuestionInfo question={question} />
      <div className='flex'>
        <h3 className='text-foreground mb-1 text-sm font-semibold'>{question.text}</h3>
        <CriticalButton state={state} onUpdate={onUpdate} />
      </div>
      <StandardQuestionInternal
        state={state}
        question={question}
        columns={question.columns}
        handleChange={handleChange}
        width={width}
      />
      <NoteEditor yText={noteYText} readOnly={readOnly} collapsed={true} />
    </div>
  );
}

// -- Question components --
// Each question has unique column/verdict logic.
// Patterns:
//   - 2-col (checkboxes + Yes/No radio): Q1, Q3, Q5, Q6, Q10, Q13, Q14, Q16
//   - 3-col (2 checkbox cols + Yes/Partial Yes/No radio): Q2, Q4, Q7, Q8
//   - 2-col with 3 radios (Yes/No/No meta-analysis): Q12, Q15
//   - Split (Q9a+Q9b, Q11a+Q11b): Q9, Q11

/** Helper: two-option radio mutual exclusivity (Yes/No) */
function handleTwoColChange(
  checklist: AMSTAR2ChecklistType,
  qKey: string,
  colIdx: number,
  optIdx: number,
  deriveFn: 'any' | 'all',
) {
  const state = checklist[qKey] as AMSTAR2QuestionAnswer;
  const newAnswers = state.answers.map((arr: boolean[]) => [...arr]);
  newAnswers[colIdx][optIdx] = !state.answers[colIdx][optIdx];

  if (colIdx === 0) {
    const check = deriveFn === 'all' ? newAnswers[0].every(Boolean) : newAnswers[0].some(Boolean);
    newAnswers[1][0] = check;
    newAnswers[1][1] = !check;
  }
  if (colIdx === 1) {
    if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
    if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
  }

  return { ...state, answers: newAnswers };
}

/** Helper: three-column with Yes/Partial Yes/No radio */
function handleThreeColChange(checklist: AMSTAR2ChecklistType, qKey: string, colIdx: number, optIdx: number) {
  const state = checklist[qKey] as AMSTAR2QuestionAnswer;
  const newAnswers = state.answers.map((arr: boolean[]) => [...arr]);
  newAnswers[colIdx][optIdx] = !state.answers[colIdx][optIdx];

  if (colIdx === 0 || colIdx === 1) {
    const allPartialYes = newAnswers[0].every(Boolean);
    const allYes = allPartialYes && newAnswers[1].every(Boolean);
    newAnswers[2][0] = allYes;
    newAnswers[2][1] = !allYes && allPartialYes;
    newAnswers[2][2] = !allYes && !allPartialYes;
  }
  if (colIdx === 2) {
    newAnswers[2] = newAnswers[2].map((_v: boolean, i: number) =>
      i === optIdx ? !state.answers[2][optIdx] : false,
    );
  }

  return { ...state, answers: newAnswers };
}

/** Helper: two-col with 3 radios (Yes/No/No meta-analysis) */
function handleTwoColThreeRadioChange(
  checklist: AMSTAR2ChecklistType,
  qKey: string,
  colIdx: number,
  optIdx: number,
  deriveFn: 'any' | 'all',
) {
  const state = checklist[qKey] as AMSTAR2QuestionAnswer;
  const newAnswers = state.answers.map((arr: boolean[]) => [...arr]);
  newAnswers[colIdx][optIdx] = !state.answers[colIdx][optIdx];

  if (colIdx === 0) {
    const check = deriveFn === 'all' ? newAnswers[0].every(Boolean) : newAnswers[0].some(Boolean);
    newAnswers[1][0] = check;
    newAnswers[1][1] = !check;
    newAnswers[1][2] = false;
  }
  if (colIdx === 1) {
    newAnswers[1] = newAnswers[1].map((_v: boolean, i: number) =>
      i === optIdx ? !state.answers[1][optIdx] : false,
    );
  }

  return { ...state, answers: newAnswers };
}

// -- Individual question configs --
// Maps each question key to its schema entry, handler pattern, and any extra props

interface QuestionConfig {
  qKey: string;
  schema: AMSTAR2QuestionSchema;
  handler: (_checklist: AMSTAR2ChecklistType, _colIdx: number, _optIdx: number) => AMSTAR2QuestionAnswer;
  width?: string;
}

// Q1 is a special case: 3 columns where col0 -> col2 (skipping col1), so it uses an
// inline handler instead of the generic helpers. Q9 and Q11 are split questions with
// dedicated components. All other questions use these configs.
const QUESTION_CONFIGS: QuestionConfig[] = [
  // Q2-Q8 (indices 0-6)
  {
    qKey: 'q2',
    schema: AMSTAR_CHECKLIST.q2,
    handler: (cl, c, o) => handleThreeColChange(cl, 'q2', c, o),
  },
  {
    qKey: 'q3',
    schema: AMSTAR_CHECKLIST.q3,
    handler: (cl, c, o) => handleTwoColChange(cl, 'q3', c, o, 'any'),
  },
  {
    qKey: 'q4',
    schema: AMSTAR_CHECKLIST.q4,
    handler: (cl, c, o) => handleThreeColChange(cl, 'q4', c, o),
  },
  {
    qKey: 'q5',
    schema: AMSTAR_CHECKLIST.q5,
    handler: (cl, c, o) => handleTwoColChange(cl, 'q5', c, o, 'any'),
  },
  {
    qKey: 'q6',
    schema: AMSTAR_CHECKLIST.q6,
    handler: (cl, c, o) => handleTwoColChange(cl, 'q6', c, o, 'any'),
  },
  {
    qKey: 'q7',
    schema: AMSTAR_CHECKLIST.q7,
    handler: (cl, c, o) => handleThreeColChange(cl, 'q7', c, o),
  },
  {
    qKey: 'q8',
    schema: AMSTAR_CHECKLIST.q8,
    handler: (cl, c, o) => handleThreeColChange(cl, 'q8', c, o),
  },
  // Q10 (index 7)
  {
    qKey: 'q10',
    schema: AMSTAR_CHECKLIST.q10,
    handler: (cl, c, o) => handleTwoColChange(cl, 'q10', c, o, 'any'),
  },
  // Q12-Q16 (indices 8-12)
  {
    qKey: 'q12',
    schema: AMSTAR_CHECKLIST.q12,
    handler: (cl, c, o) => handleTwoColThreeRadioChange(cl, 'q12', c, o, 'any'),
    width: 'w-48',
  },
  {
    qKey: 'q13',
    schema: AMSTAR_CHECKLIST.q13,
    handler: (cl, c, o) => handleTwoColChange(cl, 'q13', c, o, 'any'),
  },
  {
    qKey: 'q14',
    schema: AMSTAR_CHECKLIST.q14,
    handler: (cl, c, o) => handleTwoColChange(cl, 'q14', c, o, 'any'),
  },
  {
    qKey: 'q15',
    schema: AMSTAR_CHECKLIST.q15,
    handler: (cl, c, o) => handleTwoColThreeRadioChange(cl, 'q15', c, o, 'any'),
    width: 'w-48',
  },
  {
    qKey: 'q16',
    schema: AMSTAR_CHECKLIST.q16,
    handler: (cl, c, o) => handleTwoColChange(cl, 'q16', c, o, 'any'),
  },
];

/** Q9 split question - custom rendering */
function Question9({
  checklist,
  onUpdate,
  getTextRef,
  readOnly,
}: {
  checklist: AMSTAR2ChecklistType;
  onUpdate: (_patch: Record<string, AMSTAR2QuestionAnswer>) => void;
  getTextRef: (_ref: TextRef) => Y.Text | null;
  readOnly?: boolean;
}) {
  const stateA = checklist.q9a;
  const stateB = checklist.q9b;
  const question = AMSTAR_CHECKLIST.q9;

  const handleChangeA = useCallback(
    (colIdx: number, optIdx: number) => {
      const newAnswers = stateA.answers.map((arr: boolean[]) => [...arr]);
      newAnswers[colIdx][optIdx] = !stateA.answers[colIdx][optIdx];

      if (colIdx === 0 || colIdx === 1) {
        const allPartialYes = newAnswers[0].every(Boolean);
        const allYes = allPartialYes && newAnswers[1].every(Boolean);
        newAnswers[2][0] = allYes;
        newAnswers[2][1] = !allYes && allPartialYes;
        newAnswers[2][2] = !allYes && !allPartialYes;
        newAnswers[2][3] = false;
      }
      if (colIdx === 2) {
        newAnswers[2] = newAnswers[2].map((_v: boolean, i: number) =>
          i === optIdx ? !stateA.answers[2][optIdx] : false,
        );
      }

      onUpdate({ q9a: { ...stateA, answers: newAnswers } });
    },
    [stateA, onUpdate],
  );

  const handleChangeB = useCallback(
    (colIdx: number, optIdx: number) => {
      const newAnswers = stateB.answers.map((arr: boolean[]) => [...arr]);
      newAnswers[colIdx][optIdx] = !stateB.answers[colIdx][optIdx];

      if (colIdx === 0 || colIdx === 1) {
        const allPartialYes = newAnswers[0].every(Boolean);
        const allYes = allPartialYes && newAnswers[1].every(Boolean);
        newAnswers[2][0] = allYes;
        newAnswers[2][1] = !allYes && allPartialYes;
        newAnswers[2][2] = !allYes && !allPartialYes;
        newAnswers[2][3] = false;
      }
      if (colIdx === 2) {
        newAnswers[2] = newAnswers[2].map((_v: boolean, i: number) =>
          i === optIdx ? !stateB.answers[2][optIdx] : false,
        );
      }

      onUpdate({ q9b: { ...stateB, answers: newAnswers } });
    },
    [stateB, onUpdate],
  );

  const handleCriticalUpdate = useCallback(
    (newQ: AMSTAR2QuestionAnswer) => {
      const newCritical = newQ.critical;
      onUpdate({ q9a: { ...stateA, critical: newCritical } });
      // Delay second write to avoid Yjs conflict on rapid dual writes
      setTimeout(() => {
        onUpdate({ q9b: { ...stateB, critical: newCritical } });
      }, 10);
    },
    [stateA, stateB, onUpdate],
  );

  const noteYText = useMemo(() => getTextRef({ type: 'AMSTAR2', questionKey: 'q9' }), [getTextRef]);

  return (
    <div className='bg-card relative rounded-lg p-7 pb-3 text-sm shadow-md'>
      <QuestionInfo question={question} />
      <div className='flex'>
        <h3 className='text-foreground font-semibold'>{question.text}</h3>
        <CriticalButton state={stateA} onUpdate={handleCriticalUpdate} />
      </div>
      <div className='text-foreground mt-2 mb-1 h-4 font-semibold'>{question.subtitle}</div>
      <StandardQuestionInternal
        state={stateA}
        question={{ text: 'q9a' }}
        columns={question.columns}
        handleChange={handleChangeA}
      />
      <div className='text-foreground mt-2 h-4 font-semibold'>{question.subtitle2}</div>
      <StandardQuestionInternal
        state={stateB}
        question={{ text: 'q9b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
      />
      <NoteEditor yText={noteYText} readOnly={readOnly} collapsed={true} />
    </div>
  );
}

/** Q11 split question - custom rendering */
function Question11({
  checklist,
  onUpdate,
  getTextRef,
  readOnly,
}: {
  checklist: AMSTAR2ChecklistType;
  onUpdate: (_patch: Record<string, AMSTAR2QuestionAnswer>) => void;
  getTextRef: (_ref: TextRef) => Y.Text | null;
  readOnly?: boolean;
}) {
  const stateA = checklist.q11a;
  const stateB = checklist.q11b;
  const question = AMSTAR_CHECKLIST.q11;

  const handleChangeA = useCallback(
    (colIdx: number, optIdx: number) => {
      const newAnswers = stateA.answers.map((arr: boolean[]) => [...arr]);
      newAnswers[colIdx][optIdx] = !stateA.answers[colIdx][optIdx];

      if (colIdx === 0) {
        const allChecked = newAnswers[0].every(Boolean);
        newAnswers[1][0] = allChecked;
        newAnswers[1][1] = !allChecked;
        newAnswers[1][2] = false;
      }
      if (colIdx === 1) {
        newAnswers[1] = newAnswers[1].map((_v: boolean, i: number) =>
          i === optIdx ? !stateA.answers[1][optIdx] : false,
        );
      }

      onUpdate({ q11a: { ...stateA, answers: newAnswers } });
    },
    [stateA, onUpdate],
  );

  const handleChangeB = useCallback(
    (colIdx: number, optIdx: number) => {
      const newAnswers = stateB.answers.map((arr: boolean[]) => [...arr]);
      newAnswers[colIdx][optIdx] = !stateB.answers[colIdx][optIdx];

      if (colIdx === 0) {
        const allChecked = newAnswers[0].every(Boolean);
        newAnswers[1][0] = allChecked;
        newAnswers[1][1] = false;
        newAnswers[1][2] = false;
      }
      if (colIdx === 1) {
        newAnswers[1] = newAnswers[1].map((_v: boolean, i: number) =>
          i === optIdx ? !stateB.answers[1][optIdx] : false,
        );
      }

      onUpdate({ q11b: { ...stateB, answers: newAnswers } });
    },
    [stateB, onUpdate],
  );

  const handleCriticalUpdate = useCallback(
    (newQ: AMSTAR2QuestionAnswer) => {
      const newCritical = newQ.critical;
      onUpdate({ q11a: { ...stateA, critical: newCritical } });
      setTimeout(() => {
        onUpdate({ q11b: { ...stateB, critical: newCritical } });
      }, 10);
    },
    [stateA, stateB, onUpdate],
  );

  const noteYText = useMemo(
    () => getTextRef({ type: 'AMSTAR2', questionKey: 'q11' }),
    [getTextRef],
  );

  return (
    <div className='bg-card relative rounded-lg p-7 pb-3 text-sm shadow-md'>
      <QuestionInfo question={question} />
      <div className='flex'>
        <h3 className='text-foreground font-semibold'>{question.text}</h3>
        <CriticalButton state={stateA} onUpdate={handleCriticalUpdate} />
      </div>
      <div className='text-foreground mt-2 h-4 font-semibold'>{question.subtitle}</div>
      <StandardQuestionInternal
        state={stateA}
        question={{ text: 'q11a' }}
        columns={question.columns}
        handleChange={handleChangeA}
        width='w-48'
      />
      <div className='text-foreground mt-4 h-4 font-semibold'>{question.subtitle2}</div>
      <StandardQuestionInternal
        state={stateB}
        question={{ text: 'q11b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
        width='w-48'
      />
      <NoteEditor yText={noteYText} readOnly={readOnly} collapsed={true} />
    </div>
  );
}

// -- Main component --

interface AMSTAR2ChecklistProps {
  externalChecklist?: AMSTAR2ChecklistType;
  onExternalUpdate?: (_patch: Record<string, unknown>) => void;
  readOnly?: boolean;
  getTextRef: (_ref: TextRef) => Y.Text | null;
}

export function AMSTAR2Checklist({
  externalChecklist,
  onExternalUpdate,
  readOnly,
  getTextRef,
}: AMSTAR2ChecklistProps) {
  // Local fallback state for standalone mode (no Yjs)
  const [localChecklist, setLocalChecklist] = useState<AMSTAR2ChecklistType | null>(() => {
    if (externalChecklist) return null;
    return createAMSTAR2Checklist({
      name: 'New Checklist',
      id: 'local-1234',
      createdAt: Date.now(),
      reviewerName: '',
    });
  });

  const checklist = externalChecklist || localChecklist;

  const handleChecklistChange = useCallback(
    (patch: Record<string, AMSTAR2QuestionAnswer>) => {
      if (readOnly) return;
      if (onExternalUpdate) {
        onExternalUpdate(patch);
        return;
      }
      setLocalChecklist(prev => (prev ? { ...prev, ...patch } : prev));
    },
    [readOnly, onExternalUpdate],
  );

  if (!checklist) return <div>Loading...</div>;

  return (
    <div className='bg-blue-50'>
      <div className='container mx-auto max-w-5xl px-4 py-6'>
        <div className='text-foreground mb-6 text-left text-lg font-semibold sm:text-center'>
          {checklist.name || 'AMSTAR 2 Checklist'}
        </div>
        <fieldset disabled={!!readOnly} className={readOnly ? 'opacity-90' : ''}>
          <div className='flex flex-col gap-6'>
            {/* Q1: special 3-col handler (col0 all -> col2) */}
            <StandardQuestion
              state={checklist.q1}
              question={AMSTAR_CHECKLIST.q1}
              handleChange={(colIdx, optIdx) => {
                const state = checklist.q1;
                const newAnswers = state.answers.map((arr: boolean[]) => [...arr]);
                newAnswers[colIdx][optIdx] = !state.answers[colIdx][optIdx];
                if (colIdx === 0) {
                  const allChecked = newAnswers[0].every(Boolean);
                  newAnswers[2][0] = allChecked;
                  newAnswers[2][1] = !allChecked;
                }
                if (colIdx === 2) {
                  if (optIdx === 0 && newAnswers[2][0]) newAnswers[2][1] = false;
                  if (optIdx === 1 && newAnswers[2][1]) newAnswers[2][0] = false;
                }
                handleChecklistChange({ q1: { ...state, answers: newAnswers } });
              }}
              onUpdate={newQ => handleChecklistChange({ q1: newQ })}
              getTextRef={getTextRef}
              readOnly={readOnly}
            />

            {/* Q2-Q8 (standard patterns) */}
            {QUESTION_CONFIGS.slice(0, 7).map(cfg => (
              <StandardQuestion
                key={cfg.qKey}
                state={checklist[cfg.qKey] as AMSTAR2QuestionAnswer}
                question={cfg.schema}
                handleChange={(colIdx, optIdx) => {
                  const newQ = cfg.handler(checklist, colIdx, optIdx);
                  handleChecklistChange({ [cfg.qKey]: newQ });
                }}
                onUpdate={newQ => handleChecklistChange({ [cfg.qKey]: newQ })}
                getTextRef={getTextRef}
                readOnly={readOnly}
                width={cfg.width}
              />
            ))}

            {/* Q9: split question */}
            <Question9
              checklist={checklist}
              onUpdate={handleChecklistChange}
              getTextRef={getTextRef}
              readOnly={readOnly}
            />

            {/* Q10 */}
            <StandardQuestion
              state={checklist.q10}
              question={AMSTAR_CHECKLIST.q10}
              handleChange={(colIdx, optIdx) => {
                const newQ = QUESTION_CONFIGS[7].handler(checklist, colIdx, optIdx);
                handleChecklistChange({ q10: newQ });
              }}
              onUpdate={newQ => handleChecklistChange({ q10: newQ })}
              getTextRef={getTextRef}
              readOnly={readOnly}
            />

            {/* Q11: split question */}
            <Question11
              checklist={checklist}
              onUpdate={handleChecklistChange}
              getTextRef={getTextRef}
              readOnly={readOnly}
            />

            {/* Q12-Q16 */}
            {QUESTION_CONFIGS.slice(8).map(cfg => (
              <StandardQuestion
                key={cfg.qKey}
                state={checklist[cfg.qKey] as AMSTAR2QuestionAnswer}
                question={cfg.schema}
                handleChange={(colIdx, optIdx) => {
                  const newQ = cfg.handler(checklist, colIdx, optIdx);
                  handleChecklistChange({ [cfg.qKey]: newQ });
                }}
                onUpdate={newQ => handleChecklistChange({ [cfg.qKey]: newQ })}
                getTextRef={getTextRef}
                readOnly={readOnly}
                width={cfg.width}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
