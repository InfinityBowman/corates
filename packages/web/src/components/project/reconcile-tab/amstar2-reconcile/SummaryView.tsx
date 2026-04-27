/**
 * SummaryView - Shows all questions and their final answers before saving
 */

import { ArrowRightIcon } from 'lucide-react';
import type { AMSTAR2QuestionAnswer } from '@corates/shared/checklists';
import {
  isMultiPartQuestion,
  getDataKeysForQuestion,
  getReconciliationSummary,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';
import { Footer } from './Footer';

type ReconciliationSummary = ReturnType<typeof getReconciliationSummary>;

interface SummaryViewProps {
  questionKeys: string[];
  finalAnswers: Record<string, AMSTAR2QuestionAnswer | Record<string, AMSTAR2QuestionAnswer>>;
  comparisonByQuestion: Record<string, { key: string; isAgreement: boolean }>;
  reconciledName: string;
  onReconciledNameChange: (_name: string) => void;
  onGoToQuestion: (_index: number) => void;
  onSave: () => void;
  onBack: () => void;
  allAnswered: boolean;
  saving: boolean;
  summary: ReconciliationSummary | null;
}

export function SummaryView({
  questionKeys,
  finalAnswers,
  comparisonByQuestion,
  onGoToQuestion,
  onSave,
  onBack,
  allAnswered,
  saving,
  summary,
}: SummaryViewProps) {
  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Summary Header */}
      <div className='border-border bg-muted border-b p-6'>
        <h2 className='text-foreground mb-4 text-xl font-bold'>Review Summary</h2>

        {summary && (
          <div className='mb-6 grid grid-cols-4 gap-4'>
            <div className='border-border bg-card rounded-lg border p-3 text-center'>
              <div className='text-secondary-foreground text-2xl font-bold'>
                {summary.totalQuestions}
              </div>
              <div className='text-muted-foreground text-xs'>Total Questions</div>
            </div>
            <div className='rounded-lg border border-green-200 bg-green-50 p-3 text-center'>
              <div className='text-2xl font-bold text-green-700'>{summary.agreementCount}</div>
              <div className='text-xs text-green-600'>Agreements</div>
            </div>
            <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-center'>
              <div className='text-2xl font-bold text-amber-700'>{summary.disagreementCount}</div>
              <div className='text-xs text-amber-600'>Disagreements</div>
            </div>
            <div className='rounded-lg border border-sky-200 bg-sky-50 p-3 text-center'>
              <div className='text-2xl font-bold text-sky-700'>{summary.agreementPercentage}%</div>
              <div className='text-xs text-sky-600'>Agreement Rate</div>
            </div>
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className='divide-border divide-y'>
        {questionKeys.map((key, index) => {
          const comp = comparisonByQuestion[key];
          const isAgreement = comp?.isAgreement ?? true;
          const final = finalAnswers[key];

          const isCritical = (() => {
            if (!final) return false;
            if (isMultiPartQuestion(key)) {
              const parts = final as Record<string, AMSTAR2QuestionAnswer>;
              const dks = getDataKeysForQuestion(key);
              return dks.some((dk: string) => parts[dk]?.critical);
            }
            return (final as AMSTAR2QuestionAnswer)?.critical;
          })();

          const getFinalAnswerText = () => {
            if (!final) return 'Not set';
            if (isMultiPartQuestion(key)) {
              const parts = final as Record<string, AMSTAR2QuestionAnswer>;
              const dks = getDataKeysForQuestion(key);
              const partAnswers: string[] = [];
              for (const dk of dks) {
                if (!parts[dk]) return 'Not set';
                const lastCol = parts[dk].answers?.[parts[dk].answers.length - 1];
                if (!lastCol) return 'Not set';
                const idx = lastCol.findIndex((v: boolean) => v === true);
                if (idx === -1) return 'Not set';
                partAnswers.push(['Yes', 'PY', 'No', 'No MA'][idx] || '?');
              }
              return partAnswers.join(' / ');
            }
            const single = final as AMSTAR2QuestionAnswer;
            const lastCol = single.answers?.[single.answers.length - 1];
            if (!lastCol) return 'Not set';
            const idx = lastCol.findIndex((v: boolean) => v === true);
            if (idx === -1) return 'Not set';
            return ['Yes', 'Partial Yes', 'No', 'No MA'][idx] || 'Selected';
          };

          const answerText = getFinalAnswerText();

          return (
            <div
              key={key}
              className='hover:bg-muted flex cursor-pointer items-center justify-between p-4'
              onClick={() => onGoToQuestion(index)}
            >
              <div className='flex items-center gap-3'>
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${isAgreement ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                >
                  {index + 1}
                </span>
                <div>
                  <div className='text-foreground text-sm font-medium'>Question {index + 1}</div>
                  <div className='text-muted-foreground text-xs'>
                    {isAgreement ? 'Reviewers agreed' : 'Reviewers differed'}
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-3'>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    answerText === 'Yes' ? 'bg-green-100 text-green-700'
                    : answerText === 'Partial Yes' ? 'bg-yellow-100 text-yellow-700'
                    : answerText === 'No' ? 'bg-red-100 text-red-700'
                    : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {answerText}
                </span>
                {isCritical && (
                  <span className='rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'>
                    Critical
                  </span>
                )}
                <ArrowRightIcon className='text-muted-foreground/70 size-4' />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <Footer onBack={onBack} onSave={onSave} allAnswered={allAnswered} saving={saving} />
    </div>
  );
}
