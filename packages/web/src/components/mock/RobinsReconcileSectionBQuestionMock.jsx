import { createSignal, For } from 'solid-js';
import { A } from '@solidjs/router';
import {
  SECTION_B,
  RESPONSE_LABELS,
} from '@/components/checklist/ROBINSIChecklist/checklist-map.js';
import { AiOutlineArrowLeft, AiOutlineArrowRight } from 'solid-icons/ai';

/**
 * Mock component for ROBINS-I Section B question reconciliation
 * Visual-only wireframe with no data/logic - comments always visible
 */
export default function RobinsReconcileSectionBQuestionMock() {
  // Mock data - hardcoded for visual purposes
  const questionKey = 'b1';
  const question = SECTION_B[questionKey];
  const responseOptions = ['Y', 'PY', 'PN', 'N'];

  // Mock reviewer answers
  const reviewer1Answer = 'Y';
  const reviewer2Answer = 'PY';
  const reviewer1Comment =
    'Authors used propensity score matching to control for age, sex, and baseline severity.';
  const reviewer2Comment =
    'Propensity score matching was used, but some important confounders may have been omitted (e.g., socioeconomic status).';

  // Local state for final answer (visual only)
  const [finalAnswer, setFinalAnswer] = createSignal(reviewer1Answer);
  const [finalComment, setFinalComment] = createSignal('');

  const isAgreement = reviewer1Answer === reviewer2Answer;

  return (
    <div class='min-h-screen bg-blue-50'>
      <div class='mx-auto max-w-7xl px-4 py-4'>
        {/* Header */}
        <div class='mb-4 flex items-center gap-4'>
          <A
            href='/mock'
            class='shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100'
            title='Back to mock index'
          >
            <AiOutlineArrowLeft class='h-5 w-5 text-gray-600' />
          </A>
          <div>
            <h1 class='text-lg font-bold text-gray-900'>ROBINS-I Reconcile (Mock)</h1>
            <p class='text-xs text-gray-500'>Visual wireframe only - no data/logic</p>
          </div>
        </div>

        {/* Question Card */}
        <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
          {/* Question Header */}
          <div
            class={`p-4 ${isAgreement ? 'border-b border-green-200 bg-green-50' : 'border-b border-amber-200 bg-amber-50'}`}
          >
            <h2 class='text-md font-medium text-gray-900'>
              <span class='font-semibold'>{questionKey.toUpperCase()}.</span> {question.text}
            </h2>
            <div class='mt-2 flex items-center gap-3'>
              <span
                class={`text-xs font-medium ${isAgreement ? 'text-green-700' : 'text-amber-700'}`}
              >
                {isAgreement ? 'Reviewers Agree' : 'Requires Reconciliation'}
              </span>
            </div>
          </div>

          {/* Three Column Layout */}
          <div class='grid grid-cols-3 divide-x divide-gray-200'>
            {/* Reviewer 1 Panel */}
            <div class='p-4'>
              <div class='mb-4 flex items-center justify-between'>
                <h3 class='font-semibold text-gray-900'>Reviewer 1</h3>
              </div>

              {/* Response Options */}
              <div class='mb-4 flex flex-wrap gap-2'>
                <For each={responseOptions}>
                  {option => (
                    <div
                      class={`inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                        reviewer1Answer === option ?
                          'border-blue-400 bg-blue-50 text-blue-800'
                        : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span class='mr-1'>{option}</span>
                      <span class='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
                    </div>
                  )}
                </For>
              </div>

              {/* Comment - Always Visible */}
              <div class='mt-4'>
                <label class='mb-1 block text-xs font-medium text-gray-700'>Comment</label>
                <div class='rounded-lg border border-gray-200 bg-gray-50 p-3'>
                  <p class='text-sm whitespace-pre-wrap text-gray-700'>{reviewer1Comment}</p>
                </div>
              </div>
            </div>

            {/* Reviewer 2 Panel */}
            <div class='p-4'>
              <div class='mb-4 flex items-center justify-between'>
                <h3 class='font-semibold text-gray-900'>Reviewer 2</h3>
              </div>

              {/* Response Options */}
              <div class='mb-4 flex flex-wrap gap-2'>
                <For each={responseOptions}>
                  {option => (
                    <div
                      class={`inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                        reviewer2Answer === option ?
                          'border-purple-400 bg-purple-50 text-purple-800'
                        : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span class='mr-1'>{option}</span>
                      <span class='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
                    </div>
                  )}
                </For>
              </div>

              {/* Comment - Always Visible */}
              <div class='mt-4'>
                <label class='mb-1 block text-xs font-medium text-gray-700'>Comment</label>
                <div class='rounded-lg border border-gray-200 bg-gray-50 p-3'>
                  <p class='text-sm whitespace-pre-wrap text-gray-700'>{reviewer2Comment}</p>
                </div>
              </div>
            </div>

            {/* Final Panel */}
            <div class='bg-green-50/30 p-4'>
              <div class='mb-4 flex items-center justify-between'>
                <h3 class='font-semibold text-gray-900'>Final Answer</h3>
              </div>

              {/* Response Options - Interactive */}
              <div class='mb-4 flex flex-wrap gap-2'>
                <For each={responseOptions}>
                  {option => (
                    <label
                      class={`inline-flex cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all focus-within:ring-2 focus-within:ring-green-400 focus-within:ring-offset-1 focus-within:outline-none hover:border-green-300 ${
                        finalAnswer() === option ?
                          'border-green-400 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-green-50'
                      }`}
                    >
                      <input
                        type='radio'
                        name='final-answer'
                        value={option}
                        checked={finalAnswer() === option}
                        onChange={() => setFinalAnswer(option)}
                        class='hidden'
                      />
                      <span class='mr-1'>{option}</span>
                      <span class='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
                    </label>
                  )}
                </For>
              </div>

              {/* Comment - Always Visible, Editable */}
              <div class='mt-4'>
                <label class='mb-1 block text-xs font-medium text-gray-700'>Final Comment</label>
                <textarea
                  value={finalComment()}
                  onInput={e => setFinalComment(e.target.value)}
                  placeholder='Add the final reconciled comment...'
                  class='w-full rounded-lg border border-gray-200 bg-white p-3 text-sm focus:border-green-400 focus:ring-2 focus:ring-green-400 focus:ring-offset-1 focus:outline-none'
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div class='mt-4 flex items-center justify-between'>
          <button
            disabled
            class='flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-400 transition-colors'
          >
            <AiOutlineArrowLeft class='h-4 w-4' />
            Previous
          </button>

          <div class='text-sm text-gray-600'>Question 1 of 3</div>

          <button class='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700'>
            Next
            <AiOutlineArrowRight class='h-4 w-4' />
          </button>
        </div>

        {/* Action Buttons */}
        <div class='mt-6 flex items-center justify-end gap-3'>
          <button class='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'>
            Cancel
          </button>
          <button class='rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700'>
            Finalize Reconciliation
          </button>
        </div>
      </div>
    </div>
  );
}
