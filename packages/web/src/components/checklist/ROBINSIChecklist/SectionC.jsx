import { For } from 'solid-js';
import { SECTION_C } from './checklist-map.js';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * Section C: Specify the (hypothetical) target randomized trial specific to the study
 * @param {Object} props
 * @param {Object} props.sectionCState - Current section C state { participants, interventionStrategy, comparatorStrategy, isPerProtocol }
 * @param {Function} props.onUpdate - Callback when section C state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
 */
export function SectionC(props) {
  // Get textarea fields (C1, C2, C3) - exclude C4 which is handled separately
  const textFields = () =>
    Object.entries(SECTION_C).filter(([_key, field]) => field.type === 'textarea');

  const c4Field = () => SECTION_C.c4;

  function handleProtocolToggle(value) {
    props.onUpdate({
      ...props.sectionCState,
      isPerProtocol: value,
    });
  }

  return (
    <div class='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div class='border-border bg-muted border-b px-6 py-4'>
        <h3 class='text-foreground text-base font-semibold'>
          Part C: Specify the (Hypothetical) Target Randomized Trial
        </h3>
        <p class='text-muted-foreground mt-1 text-xs'>{SECTION_C.description}</p>
      </div>

      <div class='space-y-4 px-6 py-4'>
        {/* Text fields: C1, C2, C3 */}
        <For each={textFields()}>
          {([_key, field]) => {
            const yText = () => {
              if (!props.getRobinsText) return null;
              return props.getRobinsText('sectionC', field.stateKey);
            };

            return (
              <div class='space-y-2'>
                <label class='block'>
                  <span class='text-secondary-foreground text-sm'>
                    <span class='font-medium'>{field.label}.</span>
                    <span class='ml-1'>{field.text}</span>
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

        {/* C4: Protocol type radio */}
        <div class='border-border space-y-2 border-t pt-2'>
          <div class='text-secondary-foreground text-sm'>
            <span class='font-medium'>{c4Field().label}.</span>
            <span class='ml-1'>{c4Field().text}</span>
          </div>
          <div class='mt-2 flex flex-col gap-2'>
            <For each={c4Field().options}>
              {option => (
                <label
                  class={`flex items-center gap-3 rounded-lg border-2 p-3 transition-all duration-200 ${props.sectionCState?.isPerProtocol === option.value ? 'border-blue-500 bg-blue-50' : 'border-border bg-card hover:border-border'} ${props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} `}
                >
                  <input
                    type='radio'
                    name='protocol-type-c4'
                    checked={props.sectionCState?.isPerProtocol === option.value}
                    disabled={props.disabled}
                    onChange={() => !props.disabled && handleProtocolToggle(option.value)}
                    class='h-4 w-4 text-blue-600'
                  />
                  <span class='text-secondary-foreground text-sm'>{option.label}</span>
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
