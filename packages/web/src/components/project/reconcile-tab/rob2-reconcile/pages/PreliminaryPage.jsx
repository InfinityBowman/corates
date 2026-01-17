import { Show, For, createMemo } from 'solid-js';
import { FiCheck, FiX, FiAlertTriangle } from 'solid-icons/fi';
import {
  PRELIMINARY_SECTION,
  STUDY_DESIGNS,
  AIM_OPTIONS,
  DEVIATION_OPTIONS,
  INFORMATION_SOURCES,
} from '@corates/shared/checklists/rob2';

/**
 * Get panel background based on type
 * @param {string} panelType - 'reviewer1', 'reviewer2', or 'final'
 * @returns {string} Tailwind CSS classes
 */
function getPanelBackground(panelType) {
  switch (panelType) {
    case 'reviewer1':
      return 'bg-blue-50/30';
    case 'reviewer2':
      return 'bg-purple-50/30';
    case 'final':
      return 'bg-green-50/30';
    default:
      return '';
  }
}

/**
 * Render a text field (display or edit)
 */
function TextField(props) {
  return (
    <Show
      when={!props.readOnly}
      fallback={
        <div class='rounded-lg border border-gray-200 bg-gray-50 p-3'>
          <p class='text-sm whitespace-pre-wrap text-gray-700'>
            {props.value || <span class='text-gray-400 italic'>Not specified</span>}
          </p>
        </div>
      }
    >
      <textarea
        value={props.value || ''}
        onInput={e => props.onChange?.(e.target.value)}
        placeholder={props.placeholder}
        rows={3}
        class='w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-green-400 focus:ring-1 focus:ring-green-400 focus:outline-none'
      />
    </Show>
  );
}

/**
 * Render a dropdown field
 */
function SelectField(props) {
  return (
    <Show
      when={!props.readOnly}
      fallback={
        <div class='rounded-lg border border-gray-200 bg-gray-50 p-3'>
          <p class='text-sm text-gray-700'>
            {props.value || <span class='text-gray-400 italic'>Not selected</span>}
          </p>
        </div>
      }
    >
      <select
        value={props.value || ''}
        onChange={e => props.onChange?.(e.target.value || null)}
        class='w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-green-400 focus:ring-1 focus:ring-green-400 focus:outline-none'
      >
        <option value=''>Select...</option>
        <For each={props.options}>{option => <option value={option}>{option}</option>}</For>
      </select>
    </Show>
  );
}

/**
 * Render aim selection (radio buttons)
 */
function AimField(props) {
  return (
    <div class='flex flex-col gap-2'>
      <For each={Object.entries(AIM_OPTIONS)}>
        {([key, label]) => {
          const isSelected = () => props.value === key;

          return (
            <Show
              when={!props.readOnly}
              fallback={
                <div
                  class={`rounded-lg border-2 p-3 text-sm ${
                    isSelected()
                      ? 'border-blue-400 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}
                >
                  <div class='flex items-center gap-2'>
                    <Show when={isSelected()}>
                      <FiCheck class='h-4 w-4' />
                    </Show>
                    <span class={isSelected() ? 'font-medium' : ''}>{label}</span>
                  </div>
                </div>
              }
            >
              <label
                class={`cursor-pointer rounded-lg border-2 p-3 text-sm transition-all hover:border-green-300 ${
                  isSelected()
                    ? 'border-green-400 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <input
                  type='radio'
                  name={`${props.name}-aim`}
                  value={key}
                  checked={isSelected()}
                  onChange={() => props.onChange?.(key)}
                  class='hidden'
                />
                <div class='flex items-center gap-2'>
                  <Show when={isSelected()}>
                    <FiCheck class='h-4 w-4' />
                  </Show>
                  <span class={isSelected() ? 'font-medium' : ''}>{label}</span>
                </div>
              </label>
            </Show>
          );
        }}
      </For>
    </div>
  );
}

/**
 * Render multi-select checkboxes (deviations, sources)
 */
function MultiSelectField(props) {
  const selected = createMemo(() => {
    if (Array.isArray(props.value)) return props.value;
    if (typeof props.value === 'object') {
      return Object.entries(props.value || {})
        .filter(([, v]) => v)
        .map(([k]) => k);
    }
    return [];
  });

  const isSelected = option => selected().includes(option);

  const handleToggle = option => {
    if (props.readOnly) return;

    if (props.isObject) {
      // For sources (object with boolean values)
      const newValue = { ...(props.value || {}) };
      newValue[option] = !newValue[option];
      props.onChange?.(newValue);
    } else {
      // For deviations (array)
      const current = selected();
      const newValue = isSelected(option)
        ? current.filter(v => v !== option)
        : [...current, option];
      props.onChange?.(newValue);
    }
  };

  return (
    <div class='flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-2'>
      <For each={props.options}>
        {option => (
          <Show
            when={!props.readOnly}
            fallback={
              <div
                class={`rounded border px-2 py-1.5 text-xs ${
                  isSelected(option)
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                <div class='flex items-center gap-1.5'>
                  <Show when={isSelected(option)}>
                    <FiCheck class='h-3 w-3 shrink-0' />
                  </Show>
                  <span class='line-clamp-2'>{option}</span>
                </div>
              </div>
            }
          >
            <label
              class={`cursor-pointer rounded border px-2 py-1.5 text-xs transition-all hover:border-green-300 ${
                isSelected(option)
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <input
                type='checkbox'
                checked={isSelected(option)}
                onChange={() => handleToggle(option)}
                class='hidden'
              />
              <div class='flex items-center gap-1.5'>
                <Show when={isSelected(option)}>
                  <FiCheck class='h-3 w-3 shrink-0' />
                </Show>
                <span class='line-clamp-2'>{option}</span>
              </div>
            </label>
          </Show>
        )}
      </For>
    </div>
  );
}

/**
 * Page for reconciling a preliminary field
 *
 * @param {Object} props
 * @param {string} props.fieldKey - The field key (studyDesign, aim, etc.)
 * @param {*} props.reviewer1Value - Reviewer 1's value
 * @param {*} props.reviewer2Value - Reviewer 2's value
 * @param {*} props.finalValue - The final reconciled value
 * @param {string} props.reviewer1Name - Display name for reviewer 1
 * @param {string} props.reviewer2Name - Display name for reviewer 2
 * @param {boolean} props.isAgreement - Whether reviewers agree
 * @param {Function} props.onFinalChange - Callback when final value changes
 * @param {Function} props.onUseReviewer1 - Callback to use reviewer 1's value
 * @param {Function} props.onUseReviewer2 - Callback to use reviewer 2's value
 * @param {boolean} props.isAimMismatch - Special flag for aim mismatch blocking
 * @returns {JSX.Element}
 */
export default function PreliminaryPage(props) {
  const fieldDef = () => PRELIMINARY_SECTION[props.fieldKey];
  const fieldLabel = () => fieldDef()?.label || props.fieldKey;

  // Determine field type and options
  const getFieldType = () => {
    const key = props.fieldKey;
    if (key === 'studyDesign') return 'select';
    if (key === 'aim') return 'aim';
    if (key === 'deviationsToAddress') return 'multiselect';
    if (key === 'sources') return 'multiselect-object';
    return 'text';
  };

  const getOptions = () => {
    const key = props.fieldKey;
    if (key === 'studyDesign') return [...STUDY_DESIGNS];
    if (key === 'deviationsToAddress') return [...DEVIATION_OPTIONS];
    if (key === 'sources') return [...INFORMATION_SOURCES];
    return [];
  };

  const renderField = (value, readOnly, onChange, name) => {
    const type = getFieldType();
    const options = getOptions();

    switch (type) {
      case 'select':
        return <SelectField value={value} options={options} readOnly={readOnly} onChange={onChange} />;
      case 'aim':
        return <AimField value={value} readOnly={readOnly} onChange={onChange} name={name} />;
      case 'multiselect':
        return (
          <MultiSelectField
            value={value}
            options={options}
            readOnly={readOnly}
            onChange={onChange}
            isObject={false}
          />
        );
      case 'multiselect-object':
        return (
          <MultiSelectField
            value={value}
            options={options}
            readOnly={readOnly}
            onChange={onChange}
            isObject={true}
          />
        );
      default:
        return (
          <TextField
            value={value}
            readOnly={readOnly}
            onChange={onChange}
            placeholder={fieldDef()?.placeholder}
          />
        );
    }
  };

  return (
    <div class='rounded-xl bg-white shadow-lg'>
      {/* Header */}
      <div
        class={`rounded-t-xl border-b p-4 ${
          props.isAgreement
            ? 'border-green-200 bg-green-50'
            : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div class='flex items-center gap-2'>
          <Show
            when={props.isAgreement}
            fallback={
              <div class='flex h-6 w-6 items-center justify-center rounded-full bg-amber-500'>
                <FiX class='h-4 w-4 text-white' />
              </div>
            }
          >
            <div class='flex h-6 w-6 items-center justify-center rounded-full bg-green-500'>
              <FiCheck class='h-4 w-4 text-white' />
            </div>
          </Show>
          <div>
            <h2 class='font-semibold text-gray-900'>{fieldLabel()}</h2>
            <p class='text-sm text-gray-600'>Preliminary Considerations</p>
          </div>
        </div>
      </div>

      {/* Aim Mismatch Warning */}
      <Show when={props.fieldKey === 'aim' && props.isAimMismatch}>
        <div class='mx-4 mt-4 rounded-lg border-2 border-red-300 bg-red-50 p-4'>
          <div class='flex items-start gap-3'>
            <FiAlertTriangle class='h-5 w-5 shrink-0 text-red-600' />
            <div>
              <h3 class='font-semibold text-red-800'>Cannot Proceed - Aim Mismatch</h3>
              <p class='mt-1 text-sm text-red-700'>
                Reviewers selected different aims. This determines which Domain 2 questions are
                assessed (2a for assignment effect, 2b for adhering effect). You must agree on the
                aim before continuing to domain reconciliation.
              </p>
            </div>
          </div>
        </div>
      </Show>

      {/* Three-column comparison */}
      <div class='grid grid-cols-3 divide-x'>
        {/* Reviewer 1 */}
        <div class={`p-4 ${getPanelBackground('reviewer1')}`}>
          <div class='mb-4 flex items-center justify-between'>
            <h3 class='font-semibold text-gray-900'>{props.reviewer1Name || 'Reviewer 1'}</h3>
            <button
              onClick={() => props.onUseReviewer1?.()}
              class='rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-blue-100 hover:text-blue-700'
            >
              Use This
            </button>
          </div>
          {renderField(props.reviewer1Value, true, null, 'reviewer1')}
        </div>

        {/* Reviewer 2 */}
        <div class={`p-4 ${getPanelBackground('reviewer2')}`}>
          <div class='mb-4 flex items-center justify-between'>
            <h3 class='font-semibold text-gray-900'>{props.reviewer2Name || 'Reviewer 2'}</h3>
            <button
              onClick={() => props.onUseReviewer2?.()}
              class='rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-blue-100 hover:text-blue-700'
            >
              Use This
            </button>
          </div>
          {renderField(props.reviewer2Value, true, null, 'reviewer2')}
        </div>

        {/* Final */}
        <div class={`p-4 ${getPanelBackground('final')}`}>
          <div class='mb-4'>
            <h3 class='font-semibold text-gray-900'>Final Answer</h3>
          </div>
          {renderField(props.finalValue, false, props.onFinalChange, 'final')}
        </div>
      </div>
    </div>
  );
}
