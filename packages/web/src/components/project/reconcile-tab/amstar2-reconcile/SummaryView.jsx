import Footer from './Footer.jsx';
import { AiOutlineArrowRight } from 'solid-icons/ai';
import { For, Show } from 'solid-js';
import {
  isMultiPartQuestion,
  getDataKeysForQuestion,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';

/**
 * Summary view showing all questions and their final answers
 * @param {Object} props
 * @param {Object} props.summary
 * @param {number} props.summary.totalQuestions
 * @param {number} props.summary.agreementCount
 * @param {number} props.summary.disagreementCount
 * @param {number} props.summary.agreementPercentage
 * @param {Array} props.questionKeys
 * @param {Object} props.comparisonByQuestion
 * @param {Object} props.finalAnswers
 * @param {Function} props.onGoToQuestion
 * @param {Function} props.onBack
 * @param {Function} props.onSave
 * @param {boolean} props.allAnswered
 * @param {boolean} props.saving
 * @returns {JSX.Element}
 */
export default function SummaryView(props) {
  return (
    <div class='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Summary Header */}
      <div class='border-border bg-muted border-b p-6'>
        <h2 class='text-foreground mb-4 text-xl font-bold'>Review Summary</h2>

        {/* Stats */}
        <Show when={props.summary}>
          <div class='mb-6 grid grid-cols-4 gap-4'>
            <div class='border-border bg-card rounded-lg border p-3 text-center'>
              <div class='text-secondary-foreground text-2xl font-bold'>
                {props.summary.totalQuestions}
              </div>
              <div class='text-muted-foreground text-xs'>Total Questions</div>
            </div>
            <div class='rounded-lg border border-green-200 bg-green-50 p-3 text-center'>
              <div class='text-2xl font-bold text-green-700'>{props.summary.agreementCount}</div>
              <div class='text-xs text-green-600'>Agreements</div>
            </div>
            <div class='rounded-lg border border-amber-200 bg-amber-50 p-3 text-center'>
              <div class='text-2xl font-bold text-amber-700'>{props.summary.disagreementCount}</div>
              <div class='text-xs text-amber-600'>Disagreements</div>
            </div>
            <div class='rounded-lg border border-sky-200 bg-sky-50 p-3 text-center'>
              <div class='text-2xl font-bold text-sky-700'>
                {props.summary.agreementPercentage}%
              </div>
              <div class='text-xs text-sky-600'>Agreement Rate</div>
            </div>
          </div>
        </Show>
      </div>

      {/* Questions List */}
      <div class='divide-border divide-y'>
        <For each={props.questionKeys}>
          {(key, index) => {
            const comp = () => props.comparisonByQuestion[key];
            const isAgreement = () => comp()?.isAgreement ?? true;
            const final = () => props.finalAnswers[key];
            const isCritical = () => {
              if (!final()) return false;
              // Handle multi-part questions (q9, q11)
              if (isMultiPartQuestion(key)) {
                const dataKeys = getDataKeysForQuestion(key);
                // Check if any part is marked critical
                return dataKeys.some(dk => final()[dk]?.critical);
              }
              return final()?.critical;
            };
            const getFinalAnswer = () => {
              if (!final()) return 'Not set';

              // Handle multi-part questions (q9, q11)
              if (isMultiPartQuestion(key)) {
                const dataKeys = getDataKeysForQuestion(key);
                const partAnswers = [];
                for (const dk of dataKeys) {
                  if (!final()[dk]) return 'Not set';
                  const lastCol = final()[dk].answers?.[final()[dk].answers.length - 1];
                  if (!lastCol) return 'Not set';
                  const idx = lastCol.findIndex(v => v === true);
                  if (idx === -1) return 'Not set';
                  partAnswers.push(['Yes', 'PY', 'No', 'No MA'][idx] || '?');
                }
                return partAnswers.join(' / ');
              }

              const lastCol = final().answers?.[final().answers.length - 1];
              if (!lastCol) return 'Not set';
              const idx = lastCol.findIndex(v => v === true);
              if (idx === -1) return 'Not set';
              return ['Yes', 'Partial Yes', 'No', 'No MA'][idx] || 'Selected';
            };

            return (
              <div
                class='hover:bg-muted flex cursor-pointer items-center justify-between p-4'
                onClick={() => props.onGoToQuestion(index())}
              >
                <div class='flex items-center gap-3'>
                  <span
                    class={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${isAgreement() ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} `}
                  >
                    {index() + 1}
                  </span>
                  <div>
                    <div class='text-foreground text-sm font-medium'>Question {index() + 1}</div>
                    <div class='text-muted-foreground text-xs'>
                      {isAgreement() ? 'Reviewers agreed' : 'Reviewers differed'}
                    </div>
                  </div>
                </div>
                <div class='flex items-center gap-3'>
                  <span
                    class={`rounded-full px-3 py-1 text-sm font-medium ${
                      getFinalAnswer() === 'Yes' ? 'bg-green-100 text-green-700'
                      : getFinalAnswer() === 'Partial Yes' ? 'bg-yellow-100 text-yellow-700'
                      : getFinalAnswer() === 'No' ? 'bg-red-100 text-red-700'
                      : 'bg-secondary text-muted-foreground'
                    } `}
                  >
                    {getFinalAnswer()}
                  </span>
                  <Show when={isCritical()}>
                    <span class='rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'>
                      Critical
                    </span>
                  </Show>
                  <AiOutlineArrowRight class='text-muted-foreground/70 h-4 w-4' />
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Footer Actions */}
      <Footer
        onBack={props.onBack}
        onSave={props.onSave}
        allAnswered={props.allAnswered}
        saving={props.saving}
      />
    </div>
  );
}
