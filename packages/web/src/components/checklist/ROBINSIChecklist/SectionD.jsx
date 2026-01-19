import { For } from 'solid-js';
import { INFORMATION_SOURCES, SECTION_D } from './checklist-map.js';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * Section D: Information sources
 * @param {Object} props
 * @param {Object} props.sectionDState - Current section D state { sources: { [sourceName]: boolean }, otherSpecify: string }
 * @param {Function} props.onUpdate - Callback when section D state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
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

  const isSourceChecked = sourceName => props.sectionDState?.sources?.[sourceName] || false;

  const otherSpecifyYText = () => {
    if (!props.getRobinsText) return null;
    return props.getRobinsText('sectionD', 'otherSpecify');
  };

  return (
    <div class='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div class='border-border bg-muted border-b px-6 py-4'>
        <h3 class='text-foreground text-base font-semibold'>{SECTION_D.title}</h3>
        <p class='text-muted-foreground mt-1 text-xs'>{SECTION_D.description}</p>
      </div>

      <div class='space-y-3 px-6 py-4'>
        {/* Checkbox list for information sources */}
        <div class='grid grid-cols-1 gap-2 md:grid-cols-2'>
          <For each={INFORMATION_SOURCES}>
            {source => (
              <label
                class={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 ${isSourceChecked(source) ? 'border-blue-500 bg-blue-50' : 'border-border bg-card hover:border-border'} ${props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} `}
              >
                <input
                  type='checkbox'
                  checked={isSourceChecked(source)}
                  disabled={props.disabled}
                  onChange={() => !props.disabled && handleSourceToggle(source)}
                  class='border-border focus:ring-primary mt-0.5 h-4 w-4 rounded text-blue-600'
                />
                <span class='text-secondary-foreground text-sm'>{source}</span>
              </label>
            )}
          </For>
        </div>

        {/* Other/additional sources textarea */}
        <div class='border-border border-t pt-3'>
          <label class='block'>
            <span class='text-secondary-foreground text-sm font-medium'>
              {SECTION_D.otherField.label}
            </span>
            <div class='mt-2'>
              <NoteEditor
                yText={otherSpecifyYText()}
                placeholder={SECTION_D.otherField.placeholder}
                readOnly={props.disabled}
                inline={true}
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

export default SectionD;
