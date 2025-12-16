import { For } from 'solid-js';
import { SECTION_C } from '@/ROBINS-I/checklist-map.js';

/**
 * Section C: Specify the (hypothetical) target randomized trial specific to the study
 * @param {Object} props
 * @param {Object} props.sectionCState - Current section C state { participants, interventionStrategy, comparatorStrategy, isPerProtocol }
 * @param {Function} props.onUpdate - Callback when section C state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function SectionC(props) {
  // Get textarea fields (C1, C2, C3) - exclude C4 which is handled separately
  const textFields = () =>
    Object.entries(SECTION_C).filter(([_key, field]) => field.type === 'textarea');

  const c4Field = () => SECTION_C.c4;

  function handleFieldChange(stateKey, value) {
    props.onUpdate({
      ...props.sectionCState,
      [stateKey]: value,
    });
  }

  function handleProtocolToggle(value) {
    props.onUpdate({
      ...props.sectionCState,
      isPerProtocol: value,
    });
  }

  return (
    <div class='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
      <div class='px-6 py-4 bg-gray-50 border-b border-gray-200'>
        <h3 class='font-semibold text-gray-900 text-base'>
          Part C: Specify the (Hypothetical) Target Randomized Trial
        </h3>
        <p class='text-xs text-gray-500 mt-1'>{SECTION_C.description}</p>
      </div>

      <div class='px-6 py-4 space-y-4'>
        {/* Text fields: C1, C2, C3 */}
        <For each={textFields()}>
          {([_key, field]) => {
            const value = () => props.sectionCState?.[field.stateKey] || '';

            return (
              <div class='space-y-2'>
                <label class='block'>
                  <span class='text-sm text-gray-700'>
                    <span class='font-medium'>{field.label}.</span>
                    <span class='ml-1'>{field.text}</span>
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

        {/* C4: Protocol type radio */}
        <div class='space-y-2 pt-2 border-t border-gray-200'>
          <div class='text-sm text-gray-700'>
            <span class='font-medium'>{c4Field().label}.</span>
            <span class='ml-1'>{c4Field().text}</span>
          </div>
          <div class='flex flex-col gap-2 mt-2'>
            <For each={c4Field().options}>
              {option => (
                <label
                  class={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200
                    ${props.sectionCState?.isPerProtocol === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}
                    ${props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                  `}
                >
                  <input
                    type='radio'
                    name='protocol-type-c4'
                    checked={props.sectionCState?.isPerProtocol === option.value}
                    disabled={props.disabled}
                    onChange={() => !props.disabled && handleProtocolToggle(option.value)}
                    class='text-blue-600 w-4 h-4'
                  />
                  <span class='text-sm text-gray-700'>{option.label}</span>
                </label>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SectionC;
