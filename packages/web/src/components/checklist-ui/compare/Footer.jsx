import { AiOutlineCheck, AiOutlineArrowLeft } from 'solid-icons/ai';
import { Show } from 'solid-js';

export default function Footer(props) {
  // Props:
  // - onBack: function to call when "Back to Questions" is clicked
  // - onSave: function to call when "Save Reconciled Checklist" is clicked
  // - allAnswered: boolean indicating if all questions have been answered
  // - saving: boolean indicating if save operation is in progress

  return (
    <div class='p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between'>
      <button
        onClick={props.onBack}
        class='flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 shadow transition-colors'
      >
        <AiOutlineArrowLeft class='w-4 h-4' />
        Back to Questions
      </button>

      <button
        onClick={props.onSave}
        disabled={!props.allAnswered || props.saving}
        class={`
            flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors
            ${
              props.allAnswered && !props.saving ?
                'bg-blue-600 text-white hover:bg-blue-700 shadow'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
      >
        <Show when={!props.saving} fallback='Saving...'>
          <AiOutlineCheck class='w-4 h-4' />
          Save Reconciled Checklist
        </Show>
      </button>
    </div>
  );
}
