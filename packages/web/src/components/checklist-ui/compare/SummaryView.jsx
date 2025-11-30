import Footer from './Footer.jsx';
import { AiOutlineArrowRight } from 'solid-icons/ai';
import { For, Show } from 'solid-js';
import { isMultiPartQuestion, getDataKeysForQuestion } from '@/AMSTAR2/checklist-compare.js';

/**
 * Summary view showing all questions and their final answers
 */
export default function SummaryView(props) {
  return (
    <div class='bg-white rounded-lg shadow-lg overflow-hidden'>
      {/* Summary Header */}
      <div class='p-6 bg-gray-50 border-b border-gray-200'>
        <h2 class='text-xl font-bold text-gray-900 mb-4'>Review Summary</h2>

        {/* Stats */}
        <Show when={props.summary}>
          <div class='grid grid-cols-4 gap-4 mb-6'>
            <div class='p-3 bg-white rounded-lg border border-gray-200 text-center'>
              <div class='text-2xl font-bold text-gray-700'>{props.summary.totalQuestions}</div>
              <div class='text-xs text-gray-500'>Total Questions</div>
            </div>
            <div class='p-3 bg-green-50 rounded-lg border border-green-200 text-center'>
              <div class='text-2xl font-bold text-green-700'>{props.summary.agreementCount}</div>
              <div class='text-xs text-green-600'>Agreements</div>
            </div>
            <div class='p-3 bg-amber-50 rounded-lg border border-amber-200 text-center'>
              <div class='text-2xl font-bold text-amber-700'>{props.summary.disagreementCount}</div>
              <div class='text-xs text-amber-600'>Disagreements</div>
            </div>
            <div class='p-3 bg-purple-50 rounded-lg border border-purple-200 text-center'>
              <div class='text-2xl font-bold text-purple-700'>
                {props.summary.agreementPercentage}%
              </div>
              <div class='text-xs text-purple-600'>Agreement Rate</div>
            </div>
          </div>
        </Show>

        {/* Checklist Name */}
        <div>
          <label class='block text-sm font-medium text-gray-700 mb-2'>
            Reconciled Checklist Name
          </label>
          <input
            type='text'
            value={props.reconciledName}
            onInput={e => props.onReconciledNameChange(e.target.value)}
            class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter name for the reconciled checklist'
          />
        </div>
      </div>

      {/* Questions List */}
      <div class='divide-y divide-gray-200'>
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
                class='p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between'
                onClick={() => props.onGoToQuestion(index())}
              >
                <div class='flex items-center gap-3'>
                  <span
                    class={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${isAgreement() ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}
                  `}
                  >
                    {index() + 1}
                  </span>
                  <div>
                    <div class='text-sm font-medium text-gray-900'>Question {index() + 1}</div>
                    <div class='text-xs text-gray-500'>
                      {isAgreement() ? 'Reviewers agreed' : 'Reviewers differed'}
                    </div>
                  </div>
                </div>
                <div class='flex items-center gap-3'>
                  <span
                    class={`
                    px-3 py-1 rounded-full text-sm font-medium
                    ${
                      getFinalAnswer() === 'Yes' ? 'bg-green-100 text-green-700'
                      : getFinalAnswer() === 'Partial Yes' ? 'bg-yellow-100 text-yellow-700'
                      : getFinalAnswer() === 'No' ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                    }
                  `}
                  >
                    {getFinalAnswer()}
                  </span>
                  <Show when={isCritical()}>
                    <span class='px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700'>
                      Critical
                    </span>
                  </Show>
                  <AiOutlineArrowRight class='w-4 h-4 text-gray-400' />
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
