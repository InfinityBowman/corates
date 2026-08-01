import { InfoIcon } from 'lucide-react';
import { AMSTAR_CHECKLIST } from './checklist-map';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import {
  useWorkspaceProjectId,
  useAnswerValue,
  useAnswerWriters,
  getAnswerValue,
  useStudy,
} from '@/project/workspace-data';
import type { ChecklistAnswerInput } from '@corates/shared/sync';
import type { AMSTAR2QuestionSchema, AMSTAR2Column } from '@corates/shared/checklists/amstar2';

function QuestionInfo({ question }: { question: AMSTAR2QuestionSchema }) {
  return (
    <div className='absolute top-1.5 right-1.5'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon-xs'
            className='rounded-full opacity-70 hover:opacity-100 focus-visible:opacity-100'
            aria-label='Question information'
          >
            <InfoIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent className='max-w-xs'>{question.info}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function CriticalButton({
  studyId,
  checklistId,
  qKey,
  currentAnswers,
}: {
  studyId: string;
  checklistId: string;
  qKey: string;
  currentAnswers: boolean[][];
}) {
  const projectId = useWorkspaceProjectId();
  const critical = useAnswerValue<boolean>(projectId, checklistId, `${qKey}.critical`) ?? false;
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  const handleToggle = () => {
    writers.updateAnswer({
      type: 'AMSTAR2',
      key: qKey,
      data: { answers: currentAnswers, critical: !critical },
    } as ChecklistAnswerInput);
  };

  return (
    <div className='ml-auto'>
      <button
        type='button'
        className={`ml-2 h-6 rounded-full px-3 text-xs font-medium text-nowrap transition-colors ${
          critical ?
            'border border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
          : 'border-border bg-secondary text-secondary-foreground hover:bg-muted border'
        }`}
        onClick={handleToggle}
        aria-pressed={critical}
      >
        {critical ? 'Critical' : 'Not Critical'}
      </button>
    </div>
  );
}

function ColumnsGrid({
  answers,
  question,
  columns,
  handleChange,
  width,
}: {
  answers: boolean[][];
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
                      checked={answers[colIdx]?.[optIdx] ?? false}
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
                      checked={answers[colIdx]?.[optIdx] ?? false}
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

// -- Answer derivation helpers --

function deriveTwoCol(
  currentAnswers: boolean[][],
  colIdx: number,
  optIdx: number,
  deriveFn: 'any' | 'all',
): boolean[][] {
  const newAnswers = currentAnswers.map((arr: boolean[]) => [...arr]);
  newAnswers[colIdx][optIdx] = !currentAnswers[colIdx][optIdx];

  if (colIdx === 0) {
    const check = deriveFn === 'all' ? newAnswers[0].every(Boolean) : newAnswers[0].some(Boolean);
    newAnswers[1][0] = check;
    newAnswers[1][1] = !check;
  }
  if (colIdx === 1) {
    if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
    if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
  }

  return newAnswers;
}

function deriveThreeCol(currentAnswers: boolean[][], colIdx: number, optIdx: number): boolean[][] {
  const newAnswers = currentAnswers.map((arr: boolean[]) => [...arr]);
  newAnswers[colIdx][optIdx] = !currentAnswers[colIdx][optIdx];

  if (colIdx === 0 || colIdx === 1) {
    const allPartialYes = newAnswers[0].every(Boolean);
    const allYes = allPartialYes && newAnswers[1].every(Boolean);
    newAnswers[2][0] = allYes;
    newAnswers[2][1] = !allYes && allPartialYes;
    newAnswers[2][2] = !allYes && !allPartialYes;
  }
  if (colIdx === 2) {
    newAnswers[2] = newAnswers[2].map((_v: boolean, i: number) =>
      i === optIdx ? !currentAnswers[2][optIdx] : false,
    );
  }

  return newAnswers;
}

function deriveTwoColThreeRadio(
  currentAnswers: boolean[][],
  colIdx: number,
  optIdx: number,
  deriveFn: 'any' | 'all',
): boolean[][] {
  const newAnswers = currentAnswers.map((arr: boolean[]) => [...arr]);
  newAnswers[colIdx][optIdx] = !currentAnswers[colIdx][optIdx];

  if (colIdx === 0) {
    const check = deriveFn === 'all' ? newAnswers[0].every(Boolean) : newAnswers[0].some(Boolean);
    newAnswers[1][0] = check;
    newAnswers[1][1] = !check;
    newAnswers[1][2] = false;
  }
  if (colIdx === 1) {
    newAnswers[1] = newAnswers[1].map((_v: boolean, i: number) =>
      i === optIdx ? !currentAnswers[1][optIdx] : false,
    );
  }

  return newAnswers;
}

// -- StandardQuestion: self-contained question with row hooks --

interface QuestionConfig {
  qKey: string;
  schema: AMSTAR2QuestionSchema;
  derive: (_answers: boolean[][], _colIdx: number, _optIdx: number) => boolean[][];
  width?: string;
}

function StandardQuestion({
  studyId,
  checklistId,
  config,
  readOnly,
}: {
  studyId: string;
  checklistId: string;
  config: QuestionConfig;
  readOnly?: boolean;
}) {
  const { qKey, schema, derive, width } = config;
  const projectId = useWorkspaceProjectId();
  const answers = useAnswerValue<boolean[][]>(projectId, checklistId, `${qKey}.answers`);
  const noteValue = useAnswerValue<string>(projectId, checklistId, `${qKey}.note`) ?? '';
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  const currentAnswers = answers || schema.columns.map(c => c.options.map(() => false));

  const handleChange = (colIdx: number, optIdx: number) => {
    const newAnswers = derive(currentAnswers, colIdx, optIdx);
    const critical = (getAnswerValue(projectId, checklistId, `${qKey}.critical`) as boolean) ?? false;
    writers.updateAnswer({
      type: 'AMSTAR2',
      key: qKey,
      data: { answers: newAnswers, critical },
    } as ChecklistAnswerInput);
  };

  return (
    <div className='bg-card relative rounded-lg p-7 pb-3 shadow-md'>
      <QuestionInfo question={schema} />
      <div className='flex'>
        <h3 className='text-foreground mb-1 text-sm font-semibold'>{schema.text}</h3>
        <CriticalButton
          studyId={studyId}
          checklistId={checklistId}
          qKey={qKey}
          currentAnswers={currentAnswers}
        />
      </div>
      <ColumnsGrid
        answers={currentAnswers}
        question={{ text: qKey }}
        columns={schema.columns}
        handleChange={handleChange}
        width={width}
      />
      <NoteEditor
        value={noteValue}
        onChange={text => writers.setText(`${qKey}.note`, text)}
        readOnly={readOnly}
        collapsed={true}
      />
    </div>
  );
}

// -- Q1: special 3-col handler (col0 all -> col2, skipping col1) --

function Question1({
  studyId,
  checklistId,
  readOnly,
}: {
  studyId: string;
  checklistId: string;
  readOnly?: boolean;
}) {
  const question = AMSTAR_CHECKLIST.q1;
  const projectId = useWorkspaceProjectId();
  const answers = useAnswerValue<boolean[][]>(projectId, checklistId, 'q1.answers');
  const noteValue = useAnswerValue<string>(projectId, checklistId, 'q1.note') ?? '';
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  const currentAnswers = answers || question.columns.map(c => c.options.map(() => false));

  const handleChange = (colIdx: number, optIdx: number) => {
    const newAnswers = currentAnswers.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx][optIdx] = !currentAnswers[colIdx][optIdx];
    if (colIdx === 0) {
      const allChecked = newAnswers[0].every(Boolean);
      newAnswers[2][0] = allChecked;
      newAnswers[2][1] = !allChecked;
    }
    if (colIdx === 2) {
      if (optIdx === 0 && newAnswers[2][0]) newAnswers[2][1] = false;
      if (optIdx === 1 && newAnswers[2][1]) newAnswers[2][0] = false;
    }
    const critical = (getAnswerValue(projectId, checklistId, 'q1.critical') as boolean) ?? false;
    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q1',
      data: { answers: newAnswers, critical },
    });
  };

  return (
    <div className='bg-card relative rounded-lg p-7 pb-3 shadow-md'>
      <QuestionInfo question={question} />
      <div className='flex'>
        <h3 className='text-foreground mb-1 text-sm font-semibold'>{question.text}</h3>
        <CriticalButton
          studyId={studyId}
          checklistId={checklistId}
          qKey='q1'
          currentAnswers={currentAnswers}
        />
      </div>
      <ColumnsGrid
        answers={currentAnswers}
        question={{ text: 'q1' }}
        columns={question.columns}
        handleChange={handleChange}
      />
      <NoteEditor
        value={noteValue}
        onChange={text => writers.setText('q1.note', text)}
        readOnly={readOnly}
        collapsed={true}
      />
    </div>
  );
}

// -- Q9: split question --

function Question9({
  studyId,
  checklistId,
  readOnly,
}: {
  studyId: string;
  checklistId: string;
  readOnly?: boolean;
}) {
  const question = AMSTAR_CHECKLIST.q9;
  const projectId = useWorkspaceProjectId();
  const answersA = useAnswerValue<boolean[][]>(projectId, checklistId, 'q9a.answers');
  const answersB = useAnswerValue<boolean[][]>(projectId, checklistId, 'q9b.answers');
  const noteValue = useAnswerValue<string>(projectId, checklistId, 'q9.note') ?? '';
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  const currentA = answersA || question.columns.map(c => c.options.map(() => false));
  const currentB = answersB || (question.columns2 || []).map(c => c.options.map(() => false));

  const currentCritical = (qKey: string) =>
    (getAnswerValue(projectId, checklistId, `${qKey}.critical`) as boolean) ?? false;

  const handleChangeA = (colIdx: number, optIdx: number) => {
    const newAnswers = currentA.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx][optIdx] = !currentA[colIdx][optIdx];

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
        i === optIdx ? !currentA[2][optIdx] : false,
      );
    }

    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q9a',
      data: { answers: newAnswers, critical: currentCritical('q9a') },
    });
  };

  const handleChangeB = (colIdx: number, optIdx: number) => {
    const newAnswers = currentB.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx][optIdx] = !currentB[colIdx][optIdx];

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
        i === optIdx ? !currentB[2][optIdx] : false,
      );
    }

    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q9b',
      data: { answers: newAnswers, critical: currentCritical('q9b') },
    });
  };

  const critical = useAnswerValue<boolean>(projectId, checklistId, 'q9a.critical') ?? false;

  const handleCriticalToggle = () => {
    const newCritical = !critical;
    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q9a',
      data: { answers: currentA, critical: newCritical },
    });
    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q9b',
      data: { answers: currentB, critical: newCritical },
    });
  };

  return (
    <div className='bg-card relative rounded-lg p-7 pb-3 text-sm shadow-md'>
      <QuestionInfo question={question} />
      <div className='flex'>
        <h3 className='text-foreground font-semibold'>{question.text}</h3>
        <div className='ml-auto'>
          <button
            type='button'
            className={`ml-2 h-6 rounded-full px-3 text-xs font-medium text-nowrap transition-colors ${
              critical ?
                'border border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
              : 'border-border bg-secondary text-secondary-foreground hover:bg-muted border'
            }`}
            onClick={handleCriticalToggle}
            aria-pressed={critical}
          >
            {critical ? 'Critical' : 'Not Critical'}
          </button>
        </div>
      </div>
      <div className='text-foreground mt-2 mb-1 h-4 font-semibold'>{question.subtitle}</div>
      <ColumnsGrid
        answers={currentA}
        question={{ text: 'q9a' }}
        columns={question.columns}
        handleChange={handleChangeA}
      />
      <div className='text-foreground mt-2 h-4 font-semibold'>{question.subtitle2}</div>
      <ColumnsGrid
        answers={currentB}
        question={{ text: 'q9b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
      />
      <NoteEditor
        value={noteValue}
        onChange={text => writers.setText('q9.note', text)}
        readOnly={readOnly}
        collapsed={true}
      />
    </div>
  );
}

// -- Q11: split question --

function Question11({
  studyId,
  checklistId,
  readOnly,
}: {
  studyId: string;
  checklistId: string;
  readOnly?: boolean;
}) {
  const question = AMSTAR_CHECKLIST.q11;
  const projectId = useWorkspaceProjectId();
  const answersA = useAnswerValue<boolean[][]>(projectId, checklistId, 'q11a.answers');
  const answersB = useAnswerValue<boolean[][]>(projectId, checklistId, 'q11b.answers');
  const noteValue = useAnswerValue<string>(projectId, checklistId, 'q11.note') ?? '';
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  const currentA = answersA || question.columns.map(c => c.options.map(() => false));
  const currentB = answersB || (question.columns2 || []).map(c => c.options.map(() => false));

  const currentCritical = (qKey: string) =>
    (getAnswerValue(projectId, checklistId, `${qKey}.critical`) as boolean) ?? false;

  const handleChangeA = (colIdx: number, optIdx: number) => {
    const newAnswers = currentA.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx][optIdx] = !currentA[colIdx][optIdx];

    if (colIdx === 0) {
      const allChecked = newAnswers[0].every(Boolean);
      newAnswers[1][0] = allChecked;
      newAnswers[1][1] = !allChecked;
      newAnswers[1][2] = false;
    }
    if (colIdx === 1) {
      newAnswers[1] = newAnswers[1].map((_v: boolean, i: number) =>
        i === optIdx ? !currentA[1][optIdx] : false,
      );
    }

    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q11a',
      data: { answers: newAnswers, critical: currentCritical('q11a') },
    });
  };

  const handleChangeB = (colIdx: number, optIdx: number) => {
    const newAnswers = currentB.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx][optIdx] = !currentB[colIdx][optIdx];

    if (colIdx === 0) {
      const allChecked = newAnswers[0].every(Boolean);
      newAnswers[1][0] = allChecked;
      newAnswers[1][1] = false;
      newAnswers[1][2] = false;
    }
    if (colIdx === 1) {
      newAnswers[1] = newAnswers[1].map((_v: boolean, i: number) =>
        i === optIdx ? !currentB[1][optIdx] : false,
      );
    }

    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q11b',
      data: { answers: newAnswers, critical: currentCritical('q11b') },
    });
  };

  const critical = useAnswerValue<boolean>(projectId, checklistId, 'q11a.critical') ?? false;

  const handleCriticalToggle = () => {
    const newCritical = !critical;
    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q11a',
      data: { answers: currentA, critical: newCritical },
    });
    writers.updateAnswer({
      type: 'AMSTAR2',
      key: 'q11b',
      data: { answers: currentB, critical: newCritical },
    });
  };

  return (
    <div className='bg-card relative rounded-lg p-7 pb-3 text-sm shadow-md'>
      <QuestionInfo question={question} />
      <div className='flex'>
        <h3 className='text-foreground font-semibold'>{question.text}</h3>
        <div className='ml-auto'>
          <button
            type='button'
            className={`ml-2 h-6 rounded-full px-3 text-xs font-medium text-nowrap transition-colors ${
              critical ?
                'border border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
              : 'border-border bg-secondary text-secondary-foreground hover:bg-muted border'
            }`}
            onClick={handleCriticalToggle}
            aria-pressed={critical}
          >
            {critical ? 'Critical' : 'Not Critical'}
          </button>
        </div>
      </div>
      <div className='text-foreground mt-2 h-4 font-semibold'>{question.subtitle}</div>
      <ColumnsGrid
        answers={currentA}
        question={{ text: 'q11a' }}
        columns={question.columns}
        handleChange={handleChangeA}
        width='w-48'
      />
      <div className='text-foreground mt-4 h-4 font-semibold'>{question.subtitle2}</div>
      <ColumnsGrid
        answers={currentB}
        question={{ text: 'q11b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
        width='w-48'
      />
      <NoteEditor
        value={noteValue}
        onChange={text => writers.setText('q11.note', text)}
        readOnly={readOnly}
        collapsed={true}
      />
    </div>
  );
}

// -- Question configs --

const QUESTION_CONFIGS: QuestionConfig[] = [
  { qKey: 'q2', schema: AMSTAR_CHECKLIST.q2, derive: (a, c, o) => deriveThreeCol(a, c, o) },
  { qKey: 'q3', schema: AMSTAR_CHECKLIST.q3, derive: (a, c, o) => deriveTwoCol(a, c, o, 'any') },
  { qKey: 'q4', schema: AMSTAR_CHECKLIST.q4, derive: (a, c, o) => deriveThreeCol(a, c, o) },
  { qKey: 'q5', schema: AMSTAR_CHECKLIST.q5, derive: (a, c, o) => deriveTwoCol(a, c, o, 'any') },
  { qKey: 'q6', schema: AMSTAR_CHECKLIST.q6, derive: (a, c, o) => deriveTwoCol(a, c, o, 'any') },
  { qKey: 'q7', schema: AMSTAR_CHECKLIST.q7, derive: (a, c, o) => deriveThreeCol(a, c, o) },
  { qKey: 'q8', schema: AMSTAR_CHECKLIST.q8, derive: (a, c, o) => deriveThreeCol(a, c, o) },
  { qKey: 'q10', schema: AMSTAR_CHECKLIST.q10, derive: (a, c, o) => deriveTwoCol(a, c, o, 'any') },
  {
    qKey: 'q12',
    schema: AMSTAR_CHECKLIST.q12,
    derive: (a, c, o) => deriveTwoColThreeRadio(a, c, o, 'any'),
    width: 'w-48',
  },
  { qKey: 'q13', schema: AMSTAR_CHECKLIST.q13, derive: (a, c, o) => deriveTwoCol(a, c, o, 'any') },
  { qKey: 'q14', schema: AMSTAR_CHECKLIST.q14, derive: (a, c, o) => deriveTwoCol(a, c, o, 'any') },
  {
    qKey: 'q15',
    schema: AMSTAR_CHECKLIST.q15,
    derive: (a, c, o) => deriveTwoColThreeRadio(a, c, o, 'any'),
    width: 'w-48',
  },
  { qKey: 'q16', schema: AMSTAR_CHECKLIST.q16, derive: (a, c, o) => deriveTwoCol(a, c, o, 'any') },
];

// -- Main component --

interface AMSTAR2ChecklistProps {
  studyId: string;
  checklistId: string;
  readOnly?: boolean;
}

export function AMSTAR2Checklist({ studyId, checklistId, readOnly }: AMSTAR2ChecklistProps) {
  const projectId = useWorkspaceProjectId();
  const study = useStudy(projectId, studyId);
  const checklistName = study?.checklists.find(c => c.id === checklistId)?.title ?? null;

  return (
    <div className='bg-blue-50'>
      <div className='container mx-auto max-w-5xl px-4 py-6'>
        <div className='text-foreground mb-6 text-left text-lg font-semibold sm:text-center'>
          {checklistName || 'AMSTAR 2 Checklist'}
        </div>
        <fieldset disabled={!!readOnly} className={readOnly ? 'opacity-90' : ''}>
          <div className='flex flex-col gap-6'>
            <Question1 studyId={studyId} checklistId={checklistId} readOnly={readOnly} />

            {QUESTION_CONFIGS.slice(0, 7).map(cfg => (
              <StandardQuestion
                key={cfg.qKey}
                studyId={studyId}
                checklistId={checklistId}
                config={cfg}
                readOnly={readOnly}
              />
            ))}

            <Question9 studyId={studyId} checklistId={checklistId} readOnly={readOnly} />

            <StandardQuestion
              studyId={studyId}
              checklistId={checklistId}
              config={QUESTION_CONFIGS[7]}
              readOnly={readOnly}
            />

            <Question11 studyId={studyId} checklistId={checklistId} readOnly={readOnly} />

            {QUESTION_CONFIGS.slice(8).map(cfg => (
              <StandardQuestion
                key={cfg.qKey}
                studyId={studyId}
                checklistId={checklistId}
                config={cfg}
                readOnly={readOnly}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
