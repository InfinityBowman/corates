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
    <div class='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div class='border-border bg-muted border-b px-6 py-4'>
        <h3 class='text-foreground text-base font-semibold'>
          Part A: Specify the Result Being Assessed
        </h3>
        <p class='text-muted-foreground mt-1 text-xs'>
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
                  <span class='text-secondary-foreground text-sm'>
                    <span class='font-medium'>{field.label}.</span>
                    <span class='ml-1'>{field.text}</span>
                    <Show when={field.optional}>
                      <span class='text-muted-foreground/70 ml-1'>[optional]</span>
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
