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
    <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
      <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
        <h3 class='text-base font-semibold text-gray-900'>{SECTION_D.title}</h3>
        <p class='mt-1 text-xs text-gray-500'>{SECTION_D.description}</p>
      </div>

      <div class='space-y-3 px-6 py-4'>
        {/* Checkbox list for information sources */}
        <div class='grid grid-cols-1 gap-2 md:grid-cols-2'>
          <For each={INFORMATION_SOURCES}>
            {source => (
              <label
                class={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 ${isSourceChecked(source) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'} ${props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} `}
              >
                <input
                  type='checkbox'
                  checked={isSourceChecked(source)}
                  disabled={props.disabled}
                  onChange={() => !props.disabled && handleSourceToggle(source)}
                  class='mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <span class='text-sm text-gray-700'>{source}</span>
              </label>
            )}
          </For>
        </div>

        {/* Other/additional sources textarea */}
        <div class='border-t border-gray-200 pt-3'>
          <label class='block'>
            <span class='text-sm font-medium text-gray-700'>{SECTION_D.otherField.label}</span>
            <textarea
              value={props.sectionDState?.otherSpecify || ''}
              disabled={props.disabled}
              placeholder={SECTION_D.otherField.placeholder}
              onInput={e => handleOtherChange(e.currentTarget.value)}
              rows={2}
              class={`mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none ${props.disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : 'bg-white'} `}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default SectionD;
