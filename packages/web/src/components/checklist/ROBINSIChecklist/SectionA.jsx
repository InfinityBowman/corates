import { For, Show } from 'solid-js';
import { SECTION_A } from './checklist-map.js';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * Section A: Specify the result being assessed for risk of bias
 * @param {Object} props
 * @param {Object} props.sectionAState - Current section A state { numericalResult, furtherDetails, outcome }
 * @param {Function} props.onUpdate - Callback when section A state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
 */
export function SectionA(props) {
  return (
    <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
      <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
        <h3 class='text-base font-semibold text-gray-900'>
          Part A: Specify the Result Being Assessed
        </h3>
        <p class='mt-1 text-xs text-gray-500'>
          Provide details about the specific result being assessed for risk of bias.
        </p>
      </div>

      <div class='space-y-4 px-6 py-4'>
        <For each={Object.entries(SECTION_A)}>
          {([_key, field]) => {
            const yText = () => {
              if (!props.getRobinsText) return null;
              return props.getRobinsText('sectionA', field.stateKey);
            };

            return (
              <div class='space-y-2'>
                <label class='block'>
                  <span class='text-sm text-gray-700'>
                    <span class='font-medium'>{field.label}.</span>
                    <span class='ml-1'>{field.text}</span>
                    <Show when={field.optional}>
                      <span class='ml-1 text-gray-400'>[optional]</span>
                    </Show>
                  </span>
                  <div class='mt-2'>
                    <NoteEditor
                      yText={yText()}
                      placeholder={field.placeholder}
                      readOnly={props.disabled}
                      inline={true}
                    />
                  </div>
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
