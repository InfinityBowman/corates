import { For } from 'solid-js';
import { isMultiPartQuestion, getDataKeysForQuestion } from '@/AMSTAR2/checklist-compare.js';

export default function Navbar(props) {
  // Props:
  // - questionKeys: array of question keys
  // - viewMode: 'questions' or 'summary'
  // - setViewMode: function to change view mode
  // - currentPage: current question page index
  // - goToQuestion: function to go to a specific question
  // - comparisonByQuestion: object mapping question keys to comparison data
  // - finalAnswers: object mapping question keys to final answers
  return (
    <div class='flex flex-wrap gap-1 py-1 pl-1'>
      <For each={props.questionKeys}>
        {(key, index) => {
          const isCurrentPage = () =>
            props.viewMode === 'questions' && props.currentPage === index();
          const comp = () => props.comparisonByQuestion[key];
          const isAgreement = () => comp()?.isAgreement ?? true;
          const hasAnswer = () => {
            const final = props.finalAnswers[key];
            if (!final) return false;

            // Handle multi-part questions (q9, q11)
            if (isMultiPartQuestion(key)) {
              const dataKeys = getDataKeysForQuestion(key);
              for (const dk of dataKeys) {
                if (!final[dk]) return false;
                const lastCol = final[dk].answers?.[final[dk].answers.length - 1];
                if (!lastCol || !lastCol.some(v => v === true)) return false;
              }
              return true;
            }

            const lastCol = final.answers?.[final.answers.length - 1];
            return lastCol && lastCol.some(v => v === true);
          };

          // Determine pill styling based on state
          const getPillStyle = () => {
            if (isCurrentPage()) {
              return 'bg-blue-600 text-white ring-2 ring-blue-300';
            }
            if (hasAnswer()) {
              // Answered - show solid color
              return isAgreement() ?
                  'bg-green-500 text-white hover:bg-green-600'
                : 'bg-amber-500 text-white hover:bg-amber-600';
            }
            // Not answered yet - show lighter color to indicate agreement/disagreement status
            return isAgreement() ?
                'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200';
          };

          return (
            <button
              onClick={() => props.goToQuestion(index())}
              class={`w-8 h-8 rounded-full text-xs font-medium transition-all ${getPillStyle()}`}
              title={`Question ${index() + 1}${!isAgreement() ? ' (reviewers differ)' : ' (reviewers agree)'}`}
            >
              {index() + 1}
            </button>
          );
        }}
      </For>
      <button
        onClick={() => props.setViewMode('summary')}
        class={`
                  px-3 h-8 rounded-full text-xs font-medium transition-all
                  ${
                    props.viewMode === 'summary' ?
                      'bg-blue-600 text-white ring-2 ring-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
      >
        Summary
      </button>
    </div>
  );
}
