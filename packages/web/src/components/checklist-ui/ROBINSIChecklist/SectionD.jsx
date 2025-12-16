import { For } from 'solid-js';
import { INFORMATION_SOURCES, SECTION_D } from '@/ROBINS-I/checklist-map.js';

/**
 * Section D: Information sources
 * @param {Object} props
 * @param {Object} props.sectionDState - Current section D state { sources: { [sourceName]: boolean }, otherSpecify: string }
 * @param {Function} props.onUpdate - Callback when section D state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function SectionD(props) {
  function handleSourceToggle(sourceName) {
    const newSources = {
      ...props.sectionDState?.sources,
      [sourceName]: !props.sectionDState?.sources?.[sourceName],
    };
    props.onUpdate({
      ...props.sectionDState,
      sources: newSources,
    });
  }

  function handleOtherChange(value) {
    props.onUpdate({
      ...props.sectionDState,
      otherSpecify: value,
    });
  }

  const isSourceChecked = sourceName => props.sectionDState?.sources?.[sourceName] || false;

  return (
    <div class='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
      <div class='px-6 py-4 bg-gray-50 border-b border-gray-200'>
        <h3 class='font-semibold text-gray-900 text-base'>{SECTION_D.title}</h3>
        <p class='text-xs text-gray-500 mt-1'>{SECTION_D.description}</p>
      </div>

      <div class='px-6 py-4 space-y-3'>
        {/* Checkbox list for information sources */}
        <div class='grid grid-cols-1 md:grid-cols-2 gap-2'>
          <For each={INFORMATION_SOURCES}>
            {source => (
              <label
                class={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200
                  ${isSourceChecked(source) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}
                  ${props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                `}
              >
                <input
                  type='checkbox'
                  checked={isSourceChecked(source)}
                  disabled={props.disabled}
                  onChange={() => !props.disabled && handleSourceToggle(source)}
                  class='mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
                />
                <span class='text-sm text-gray-700'>{source}</span>
              </label>
            )}
          </For>
        </div>

        {/* Other/additional sources textarea */}
        <div class='pt-3 border-t border-gray-200'>
          <label class='block'>
            <span class='text-sm text-gray-700 font-medium'>{SECTION_D.otherField.label}</span>
            <textarea
              value={props.sectionDState?.otherSpecify || ''}
              disabled={props.disabled}
              placeholder={SECTION_D.otherField.placeholder}
              onInput={e => handleOtherChange(e.currentTarget.value)}
              rows={2}
              class={`
                mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                placeholder:text-gray-400
                focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none
                ${props.disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'}
              `}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default SectionD;
