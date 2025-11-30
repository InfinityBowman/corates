/**
 * ChecklistReconciliation - Main view for comparing and reconciling two checklists
 * Allows reviewers to compare their assessments and create a finalized consensus checklist
 */

import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { AiOutlineCheck, AiOutlineArrowLeft } from 'solid-icons/ai';
import { BsFileDiff } from 'solid-icons/bs';
import {
  compareChecklists,
  getReconciliationSummary,
  createReconciledChecklist,
  getQuestionKeys,
} from '../../AMSTAR2/checklist-compare.js';
import ReconciliationQuestion from './ReconciliationQuestion.jsx';

export default function ChecklistReconciliation(props) {
  // props.checklist1 - First reviewer's checklist data
  // props.checklist2 - Second reviewer's checklist data
  // props.onSaveReconciled - Callback when reconciled checklist is saved
  // props.onCancel - Callback to cancel and go back
  // props.reviewer1Name - Display name for first reviewer
  // props.reviewer2Name - Display name for second reviewer
  
  const navigate = useNavigate();
  const params = useParams();

  // State for selections (which reviewer's answer to use for each question)
  const [selections, setSelections] = createSignal({});
  const [reconciledName, setReconciledName] = createSignal('Reconciled Checklist');
  const [saving, setSaving] = createSignal(false);
  const [showOnlyDisagreements, setShowOnlyDisagreements] = createSignal(true);

  // Compare the two checklists
  const comparison = createMemo(() => {
    if (!props.checklist1 || !props.checklist2) return null;
    return compareChecklists(props.checklist1, props.checklist2);
  });

  // Get reconciliation summary
  const summary = createMemo(() => {
    const comp = comparison();
    if (!comp) return null;
    return getReconciliationSummary(comp);
  });

  // Build a map of question key to comparison data
  const comparisonByQuestion = createMemo(() => {
    const comp = comparison();
    if (!comp) return {};
    
    const map = {};
    for (const item of [...comp.agreements, ...comp.disagreements]) {
      map[item.key] = item;
    }
    return map;
  });

  // Auto-select agreed questions to reviewer1
  createEffect(() => {
    const comp = comparison();
    if (!comp) return;
    
    const initialSelections = {};
    for (const agreement of comp.agreements) {
      initialSelections[agreement.key] = 'reviewer1';
    }
    setSelections(prev => ({ ...initialSelections, ...prev }));
  });

  // Check if all disagreements have been resolved
  const allResolved = createMemo(() => {
    const comp = comparison();
    if (!comp) return false;
    
    const sels = selections();
    for (const disagreement of comp.disagreements) {
      if (!sels[disagreement.key]) return false;
    }
    return true;
  });

  // Get questions to display based on filter
  const questionsToDisplay = createMemo(() => {
    const comp = comparison();
    if (!comp) return [];
    
    if (showOnlyDisagreements()) {
      return comp.disagreements.map(d => d.key);
    }
    return getQuestionKeys();
  });

  // Handle selection change
  function handleSelect(questionKey, selection) {
    setSelections(prev => ({
      ...prev,
      [questionKey]: selection,
    }));
  }

  // Handle save
  async function handleSave() {
    if (!allResolved()) {
      alert('Please resolve all disagreements before saving.');
      return;
    }

    setSaving(true);
    try {
      const reconciled = createReconciledChecklist(
        props.checklist1,
        props.checklist2,
        selections(),
        {
          name: reconciledName(),
          reviewerName: 'Consensus',
          id: `reconciled-${Date.now()}`,
        }
      );
      
      await props.onSaveReconciled?.(reconciled);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      alert('Failed to save reconciled checklist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class='min-h-screen bg-blue-50'>
      <div class='container mx-auto px-4 py-6 max-w-6xl'>
        {/* Header */}
        <div class='bg-white rounded-lg shadow-lg p-6 mb-6'>
          <div class='flex items-center gap-4 mb-4'>
            <button
              onClick={() => props.onCancel?.()}
              class='p-2 hover:bg-gray-100 rounded-lg transition-colors'
              title='Go back'
            >
              <AiOutlineArrowLeft class='w-5 h-5 text-gray-600' />
            </button>
            <div>
              <h1 class='text-2xl font-bold text-gray-900'>Checklist Reconciliation</h1>
              <p class='text-gray-500 text-sm mt-1'>
                Compare reviewer assessments and create a consensus checklist
              </p>
            </div>
          </div>

          {/* Reviewer Info */}
          <div class='grid grid-cols-2 gap-4 mb-6'>
            <div class='p-4 bg-gray-50 rounded-lg border border-gray-200'>
              <div class='text-sm font-medium text-gray-700'>Reviewer 1</div>
              <div class='text-lg font-semibold text-gray-900'>
                {props.reviewer1Name || props.checklist1?.reviewerName || 'Unknown'}
              </div>
              <div class='text-xs text-gray-500 mt-1'>
                {props.checklist1?.name}
              </div>
            </div>
            <div class='p-4 bg-gray-50 rounded-lg border border-gray-200'>
              <div class='text-sm font-medium text-gray-700'>Reviewer 2</div>
              <div class='text-lg font-semibold text-gray-900'>
                {props.reviewer2Name || props.checklist2?.reviewerName || 'Unknown'}
              </div>
              <div class='text-xs text-gray-500 mt-1'>
                {props.checklist2?.name}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <Show when={summary()}>
            <div class='grid grid-cols-4 gap-4 mb-6'>
              <div class='p-4 bg-blue-50 rounded-lg border border-blue-200 text-center'>
                <div class='text-2xl font-bold text-blue-700'>{summary().totalQuestions}</div>
                <div class='text-sm text-blue-600'>Total Questions</div>
              </div>
              <div class='p-4 bg-green-50 rounded-lg border border-green-200 text-center'>
                <div class='text-2xl font-bold text-green-700'>{summary().agreementCount}</div>
                <div class='text-sm text-green-600'>Agreements</div>
              </div>
              <div class='p-4 bg-amber-50 rounded-lg border border-amber-200 text-center'>
                <div class='text-2xl font-bold text-amber-700'>{summary().disagreementCount}</div>
                <div class='text-sm text-amber-600'>Disagreements</div>
              </div>
              <div class='p-4 bg-purple-50 rounded-lg border border-purple-200 text-center'>
                <div class='text-2xl font-bold text-purple-700'>{summary().agreementPercentage}%</div>
                <div class='text-sm text-purple-600'>Agreement Rate</div>
              </div>
            </div>

            {/* Critical disagreements warning */}
            {/* <Show when={summary().criticalDisagreements > 0}>
              <div class='p-4 bg-red-50 border border-red-200 rounded-lg mb-6'>
                <div class='flex items-center gap-2'>
                  <BsFileDiff class='w-5 h-5 text-red-600' />
                  <span class='text-red-800 font-medium'>
                    {summary().criticalDisagreements} critical question{summary().criticalDisagreements > 1 ? 's' : ''} require reconciliation
                  </span>
                </div>
                <p class='text-red-700 text-sm mt-1'>
                  Critical questions significantly impact the overall quality assessment.
                </p>
              </div>
            </Show> */}
          </Show>

          {/* Reconciled Checklist Name */}
          <div class='mb-4'>
            <label class='block text-sm font-medium text-gray-700 mb-2'>
              Reconciled Checklist Name
            </label>
            <input
              type='text'
              value={reconciledName()}
              onInput={e => setReconciledName(e.target.value)}
              class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter name for the reconciled checklist'
            />
          </div>

          {/* Filter Toggle */}
          <div class='flex items-center justify-between'>
            <label class='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={showOnlyDisagreements()}
                onChange={e => setShowOnlyDisagreements(e.target.checked)}
                class='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
              />
              <span class='text-sm text-gray-700'>Show only questions needing reconciliation</span>
            </label>
            
            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={!allResolved() || saving()}
              class={`
                px-6 py-2 rounded-lg font-medium transition-colors
                ${allResolved() && !saving()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <Show when={!saving()} fallback='Saving...'>
                <Show when={allResolved()} fallback={`Resolve ${summary()?.disagreementCount || 0} remaining`}>
                  <span class='flex items-center gap-2'>
                    <AiOutlineCheck class='w-4 h-4' />
                    Save Reconciled Checklist
                  </span>
                </Show>
              </Show>
            </button>
          </div>
        </div>

        {/* Questions */}
        <Show when={comparison()} fallback={<div class='text-center py-12 text-gray-500'>Loading comparison...</div>}>
          <Show
            when={questionsToDisplay().length > 0}
            fallback={
              <div class='bg-white rounded-lg shadow-lg p-12 text-center'>
                <AiOutlineCheck class='w-16 h-16 text-green-500 mx-auto mb-4' />
                <h2 class='text-xl font-semibold text-gray-900 mb-2'>All Questions Agree!</h2>
                <p class='text-gray-600'>
                  Both reviewers have identical assessments for all questions.
                </p>
                <button
                  onClick={() => setShowOnlyDisagreements(false)}
                  class='mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
                >
                  View all questions
                </button>
              </div>
            }
          >
            <div class='space-y-4'>
              <For each={questionsToDisplay()}>
                {questionKey => (
                  <ReconciliationQuestion
                    questionKey={questionKey}
                    comparison={comparisonByQuestion()[questionKey]}
                    selection={selections()[questionKey]}
                    onSelect={sel => handleSelect(questionKey, sel)}
                    reviewer1Name={props.reviewer1Name || props.checklist1?.reviewerName || 'Reviewer 1'}
                    reviewer2Name={props.reviewer2Name || props.checklist2?.reviewerName || 'Reviewer 2'}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>

        {/* Bottom Save Bar (sticky) */}
        <Show when={summary()?.needsReconciliation}>
          <div class='fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4'>
            <div class='container mx-auto max-w-6xl flex items-center justify-between'>
              <div class='text-sm text-gray-600'>
                <Show when={allResolved()} fallback={
                  <span class='text-amber-600'>
                    {Object.keys(selections()).filter(k => comparison()?.disagreements.some(d => d.key === k) && selections()[k]).length} of {summary()?.disagreementCount} disagreements resolved
                  </span>
                }>
                  <span class='text-green-600 flex items-center gap-1'>
                    <AiOutlineCheck class='w-4 h-4' />
                    All disagreements resolved
                  </span>
                </Show>
              </div>
              <button
                onClick={handleSave}
                disabled={!allResolved() || saving()}
                class={`
                  px-6 py-2 rounded-lg font-medium transition-colors
                  ${allResolved() && !saving()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <Show when={!saving()} fallback='Saving...'>
                  Save Reconciled Checklist
                </Show>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
