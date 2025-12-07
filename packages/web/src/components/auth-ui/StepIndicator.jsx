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
    <div class='flex items-center justify-center mb-5'>
      <div class='flex items-center space-x-2'>
        <For each={steps()}>
          {(step, index) => (
            <>
              <div
                class={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors ${
                  props.currentStep >= step ?
                    'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step}
              </div>
              <Show when={index() < props.totalSteps - 1}>
                <div
                  class={`w-8 sm:w-10 h-0.5 transition-colors ${
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
