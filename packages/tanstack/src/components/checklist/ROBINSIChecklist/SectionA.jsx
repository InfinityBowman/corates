import { For, Show } from 'solid-js'
import { SECTION_A } from '@/ROBINS-I/checklist-map.js'

/**
 * Section A: Specify the result being assessed for risk of bias
 * @param {Object} props
 * @param {Object} props.sectionAState - Current section A state { numericalResult, furtherDetails, outcome }
 * @param {Function} props.onUpdate - Callback when section A state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function SectionA(props) {
  function handleFieldChange(stateKey, value) {
    props.onUpdate({
      ...props.sectionAState,
      [stateKey]: value,
    })
  }

  return (
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <h3 class="text-base font-semibold text-gray-900">
          Part A: Specify the Result Being Assessed
        </h3>
        <p class="mt-1 text-xs text-gray-500">
          Provide details about the specific result being assessed for risk of
          bias.
        </p>
      </div>

      <div class="space-y-4 px-6 py-4">
        <For each={Object.entries(SECTION_A)}>
          {([_key, field]) => {
            const value = () => props.sectionAState?.[field.stateKey] || ''

            return (
              <div class="space-y-2">
                <label class="block">
                  <span class="text-sm text-gray-700">
                    <span class="font-medium">{field.label}.</span>
                    <span class="ml-1">{field.text}</span>
                    <Show when={field.optional}>
                      <span class="ml-1 text-gray-400">[optional]</span>
                    </Show>
                  </span>
                  <textarea
                    value={value()}
                    disabled={props.disabled}
                    placeholder={field.placeholder}
                    onInput={(e) =>
                      handleFieldChange(field.stateKey, e.currentTarget.value)
                    }
                    rows={3}
                    class={`mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none ${props.disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : 'bg-white'} `}
                  />
                </label>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

export default SectionA
