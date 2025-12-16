import { PLANNING_SECTION } from '@/ROBINS-I/checklist-map.js';

/**
 * Planning Section: List confounding factors at planning stage
 * @param {Object} props
 * @param {Object} props.planningState - Current planning state { confoundingFactors }
 * @param {Function} props.onUpdate - Callback when planning state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function PlanningSection(props) {
  const p1Field = PLANNING_SECTION.p1;

  function handleFieldChange(value) {
    props.onUpdate({
      ...props.planningState,
      [p1Field.stateKey]: value,
    });
  }

  const value = () => props.planningState?.[p1Field.stateKey] || '';

  return (
    <div class='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
      <div class='px-6 py-4 bg-amber-50 border-b border-amber-200'>
        <h2 class='font-bold text-gray-900 text-lg'>{PLANNING_SECTION.title}</h2>
        <p class='text-sm text-amber-800 mt-1 font-medium'>{PLANNING_SECTION.subtitle}</p>
      </div>

      <div class='px-6 py-4'>
        <div class='space-y-2'>
          <label class='block'>
            <span class='text-sm text-gray-700'>
              <span class='font-medium'>{p1Field.label}.</span>
              <span class='ml-1'>{p1Field.text}</span>
            </span>
            <textarea
              value={value()}
              disabled={props.disabled}
              placeholder={p1Field.placeholder}
              onInput={e => handleFieldChange(e.currentTarget.value)}
              rows={4}
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

export default PlanningSection;
