import { PLANNING_SECTION } from './checklist-map.js';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * Planning Section: List confounding factors at planning stage
 * @param {Object} props
 * @param {Object} props.planningState - Current planning state { confoundingFactors }
 * @param {Function} props.onUpdate - Callback when planning state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
 */
export function PlanningSection(props) {
  const p1Field = PLANNING_SECTION.p1;

  const yText = () => {
    if (!props.getRobinsText) return null;
    return props.getRobinsText('planning', 'confoundingFactors');
  };

  return (
    <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
      <div class='border-b border-amber-200 bg-amber-50 px-6 py-4'>
        <h2 class='text-lg font-bold text-gray-900'>{PLANNING_SECTION.title}</h2>
        <p class='mt-1 text-sm font-medium text-amber-800'>{PLANNING_SECTION.subtitle}</p>
      </div>

      <div class='px-6 py-4'>
        <div class='space-y-2'>
          <label class='block'>
            <span class='text-sm text-gray-700'>
              <span class='font-medium'>{p1Field.label}.</span>
              <span class='ml-1'>{p1Field.text}</span>
            </span>
            <div class='mt-2'>
              <NoteEditor
                yText={yText()}
                placeholder={p1Field.placeholder}
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

export default PlanningSection;
