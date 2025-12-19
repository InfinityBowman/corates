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
            <textarea
              value={value()}
              disabled={props.disabled}
              placeholder={p1Field.placeholder}
              onInput={e => handleFieldChange(e.currentTarget.value)}
              rows={4}
              class={`mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${props.disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : 'bg-white'} `}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default PlanningSection;
