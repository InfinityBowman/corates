/**
 * Step indicator for multi-step forms
 * @param {Object} props
 * @param {number} props.currentStep - Current step (1-indexed)
 * @param {number} props.totalSteps - Total number of steps
 */
import { For, Show } from 'solid-js';

export default function StepIndicator(props) {
  const steps = () => Array.from({ length: props.totalSteps }, (_, i) => i + 1);

  return (
    <div class='mb-5 flex items-center justify-center'>
      <div class='flex items-center space-x-2'>
        <For each={steps()}>
          {(step, index) => (
            <>
              <div
                class={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-8 sm:w-8 sm:text-sm ${
                  props.currentStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step}
              </div>
              <Show when={index() < props.totalSteps - 1}>
                <div
                  class={`h-0.5 w-8 transition-colors sm:w-10 ${
                    props.currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              </Show>
            </>
          )}
        </For>
      </div>
    </div>
  );
}
