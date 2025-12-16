import { For, Show } from 'solid-js';
import { SECTION_A } from '@/ROBINS-I/checklist-map.js';

/**
 * Section A: Specify the result being assessed for risk of bias
 * @param {Object} props
 * @param {Object} props.sectionAState - Current section A state { numericalResult, furtherDetails, outcome }
 * @param {Function} props.onUpdate - Callback when section A state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function SectionA(props) {
  function handleFieldChange(stateKey, value) {
    props.onUpdate({
      ...props.sectionAState,
      [stateKey]: value,
    });
  }

  return (
    <div class='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
      <div class='px-6 py-4 bg-gray-50 border-b border-gray-200'>
        <h3 class='font-semibold text-gray-900 text-base'>
          Part A: Specify the Result Being Assessed
        </h3>
        <p class='text-xs text-gray-500 mt-1'>
          Provide details about the specific result being assessed for risk of bias.
        </p>
      </div>

      <div class='px-6 py-4 space-y-4'>
        <For each={Object.entries(SECTION_A)}>
          {([_key, field]) => {
            const value = () => props.sectionAState?.[field.stateKey] || '';

            return (
              <div class='space-y-2'>
                <label class='block'>
                  <span class='text-sm text-gray-700'>
                    <span class='font-medium'>{field.label}.</span>
                    <span class='ml-1'>{field.text}</span>
                    <Show when={field.optional}>
                      <span class='text-gray-400 ml-1'>[optional]</span>
                    </Show>
                  </span>
                  <textarea
                    value={value()}
                    disabled={props.disabled}
                    placeholder={field.placeholder}
                    onInput={e => handleFieldChange(field.stateKey, e.currentTarget.value)}
                    rows={3}
                    class={`
                      mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                      placeholder:text-gray-400
                      focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none
                      ${props.disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'}
                    `}
                  />
                </label>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

export default SectionA;
