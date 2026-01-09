import { AiOutlineCheck } from 'solid-icons/ai';
import { FiArrowLeft } from 'solid-icons/fi';
import { Show } from 'solid-js';

/**
 * Footer - Actions for the compare checklist view
 * @param {Object} props
 * @param {Function} props.onBack
 * @param {Function} props.onSave
 * @param {boolean} props.allAnswered
 * @param {boolean} props.saving
 * @returns {JSX.Element}
 */
export default function Footer(props) {
  return (
    <div class='flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6'>
      <button
        onClick={() => props.onBack()}
        class='flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-gray-700 shadow transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none'
      >
        <FiArrowLeft class='h-4 w-4' />
        Back to Questions
      </button>

      <button
        onClick={() => props.onSave()}
        disabled={!props.allAnswered || props.saving}
        class={`flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors focus:outline-none ${
          props.allAnswered && !props.saving ?
            'bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
          : 'cursor-not-allowed bg-gray-300 text-gray-500'
        } `}
      >
        <Show when={!props.saving} fallback='Saving...'>
          <AiOutlineCheck class='h-4 w-4' />
          Save Reconciled Checklist
        </Show>
      </button>
    </div>
  );
}
