import { For, Show } from 'solid-js';
import {
  PRELIMINARY_SECTION,
  STUDY_DESIGNS,
  AIM_OPTIONS,
  DEVIATION_OPTIONS,
  INFORMATION_SOURCES,
} from './checklist-map.js';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * Preliminary considerations section for ROB-2
 *
 * @param {Object} props
 * @param {Object} props.preliminaryState - Current preliminary state
 * @param {Function} props.onUpdate - Callback when state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 * @param {Function} [props.getRob2Text] - Function to get Y.Text for free-text fields
 */
export function PreliminarySection(props) {
  function handleStudyDesignChange(value) {
    props.onUpdate({
      ...props.preliminaryState,
      studyDesign: value,
    });
  }

  function handleAimChange(aim) {
    props.onUpdate({
      ...props.preliminaryState,
      aim: props.preliminaryState?.aim === aim ? null : aim,
    });
  }

  function handleDeviationToggle(deviation) {
    const current = props.preliminaryState?.deviationsToAddress || [];
    const updated =
      current.includes(deviation) ? current.filter(d => d !== deviation) : [...current, deviation];
    props.onUpdate({
      ...props.preliminaryState,
      deviationsToAddress: updated,
    });
  }

  function handleSourceToggle(source) {
    const current = props.preliminaryState?.sources || {};
    props.onUpdate({
      ...props.preliminaryState,
      sources: {
        ...current,
        [source]: !current[source],
      },
    });
  }

  const experimentalYText = () => props.getRob2Text?.('preliminary', 'experimental');
  const comparatorYText = () => props.getRob2Text?.('preliminary', 'comparator');
  const numericalResultYText = () => props.getRob2Text?.('preliminary', 'numericalResult');

  return (
    <div class='overflow-hidden rounded-lg bg-white shadow-md'>
      <div class='bg-blue-600 px-6 py-4 text-white'>
        <h2 class='text-lg font-semibold'>Preliminary Considerations</h2>
        <p class='mt-1 text-sm text-blue-100'>
          Complete these sections before assessing the domains
        </p>
      </div>

      <div class='space-y-6 px-6 py-5'>
        {/* Study Design */}
        <div>
          <label class='mb-2 block text-sm font-medium text-gray-700'>
            {PRELIMINARY_SECTION.studyDesign.label}
          </label>
          <div class='flex flex-wrap gap-2'>
            <For each={STUDY_DESIGNS}>
              {design => (
                <button
                  type='button'
                  onClick={() => !props.disabled && handleStudyDesignChange(design)}
                  disabled={props.disabled}
                  class={`rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                    props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    props.preliminaryState?.studyDesign === design ?
                      'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {design}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Interventions */}
        <div class='grid gap-4 md:grid-cols-2'>
          <div>
            <label class='mb-2 block text-sm font-medium text-gray-700'>
              {PRELIMINARY_SECTION.experimental.label}
            </label>
            <NoteEditor
              yText={experimentalYText()}
              placeholder={PRELIMINARY_SECTION.experimental.placeholder}
              readOnly={props.disabled}
              inline={true}
            />
          </div>
          <div>
            <label class='mb-2 block text-sm font-medium text-gray-700'>
              {PRELIMINARY_SECTION.comparator.label}
            </label>
            <NoteEditor
              yText={comparatorYText()}
              placeholder={PRELIMINARY_SECTION.comparator.placeholder}
              readOnly={props.disabled}
              inline={true}
            />
          </div>
        </div>

        {/* Numerical Result */}
        <div>
          <label class='mb-2 block text-sm font-medium text-gray-700'>
            {PRELIMINARY_SECTION.numericalResult.label}
          </label>
          <NoteEditor
            yText={numericalResultYText()}
            placeholder={PRELIMINARY_SECTION.numericalResult.placeholder}
            readOnly={props.disabled}
            inline={true}
          />
        </div>

        {/* Aim Selection */}
        <div>
          <label class='mb-2 block text-sm font-medium text-gray-700'>
            {PRELIMINARY_SECTION.aim.label}
          </label>
          <div class='space-y-2'>
            <button
              type='button'
              onClick={() => !props.disabled && handleAimChange('ASSIGNMENT')}
              disabled={props.disabled}
              class={`flex w-full items-start rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              } ${
                props.preliminaryState?.aim === 'ASSIGNMENT' ?
                  'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div class='mt-0.5 mr-3'>
                <div
                  class={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    props.preliminaryState?.aim === 'ASSIGNMENT' ?
                      'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                  }`}
                >
                  <Show when={props.preliminaryState?.aim === 'ASSIGNMENT'}>
                    <div class='h-2 w-2 rounded-full bg-white' />
                  </Show>
                </div>
              </div>
              <span class='text-gray-700'>{AIM_OPTIONS.ASSIGNMENT}</span>
            </button>

            <button
              type='button'
              onClick={() => !props.disabled && handleAimChange('ADHERING')}
              disabled={props.disabled}
              class={`flex w-full items-start rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              } ${
                props.preliminaryState?.aim === 'ADHERING' ?
                  'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div class='mt-0.5 mr-3'>
                <div
                  class={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    props.preliminaryState?.aim === 'ADHERING' ?
                      'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                  }`}
                >
                  <Show when={props.preliminaryState?.aim === 'ADHERING'}>
                    <div class='h-2 w-2 rounded-full bg-white' />
                  </Show>
                </div>
              </div>
              <span class='text-gray-700'>{AIM_OPTIONS.ADHERING}</span>
            </button>
          </div>
        </div>

        {/* Deviations to Address (only for ADHERING) */}
        <Show when={props.preliminaryState?.aim === 'ADHERING'}>
          <div>
            <label class='mb-2 block text-sm font-medium text-gray-700'>
              {PRELIMINARY_SECTION.deviationsToAddress.label}
            </label>
            <p class='mb-3 text-xs text-gray-500'>{PRELIMINARY_SECTION.deviationsToAddress.info}</p>
            <div class='space-y-2'>
              <For each={DEVIATION_OPTIONS}>
                {deviation => {
                  const isChecked = () =>
                    (props.preliminaryState?.deviationsToAddress || []).includes(deviation);
                  return (
                    <button
                      type='button'
                      onClick={() => !props.disabled && handleDeviationToggle(deviation)}
                      disabled={props.disabled}
                      class={`flex w-full items-center rounded-lg border p-3 text-left text-sm transition-colors ${
                        props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${
                        isChecked() ?
                          'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div
                        class={`mr-3 flex h-4 w-4 items-center justify-center rounded border ${
                          isChecked() ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        }`}
                      >
                        <Show when={isChecked()}>
                          <svg class='h-3 w-3 text-white' fill='currentColor' viewBox='0 0 20 20'>
                            <path
                              fill-rule='evenodd'
                              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                              clip-rule='evenodd'
                            />
                          </svg>
                        </Show>
                      </div>
                      <span class='text-gray-700'>{deviation}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Information Sources */}
        <div>
          <label class='mb-2 block text-sm font-medium text-gray-700'>
            {PRELIMINARY_SECTION.sources.label}
          </label>
          <div class='grid gap-2 sm:grid-cols-2'>
            <For each={INFORMATION_SOURCES}>
              {source => {
                const isChecked = () => props.preliminaryState?.sources?.[source] || false;
                return (
                  <button
                    type='button'
                    onClick={() => !props.disabled && handleSourceToggle(source)}
                    disabled={props.disabled}
                    class={`flex items-center rounded border p-2 text-left text-xs transition-colors ${
                      props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${
                      isChecked() ?
                        'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div
                      class={`mr-2 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        isChecked() ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}
                    >
                      <Show when={isChecked()}>
                        <svg class='h-2.5 w-2.5 text-white' fill='currentColor' viewBox='0 0 20 20'>
                          <path
                            fill-rule='evenodd'
                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                            clip-rule='evenodd'
                          />
                        </svg>
                      </Show>
                    </div>
                    <span class='text-gray-600'>{source}</span>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PreliminarySection;
