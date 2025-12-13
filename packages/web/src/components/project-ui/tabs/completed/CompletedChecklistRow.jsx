/**
 * CompletedChecklistRow - row for a reconciled/consensus checklist
 */

import { Show } from 'solid-js';

export default function CompletedChecklistRow(props) {
  const title = () => props.checklist?.title || `${props.checklist?.type || 'AMSTAR2'} Checklist`;

  return (
    <div class='p-4 transition-colors flex items-center justify-between hover:bg-gray-50'>
      <div class='flex-1'>
        <div class='flex items-center gap-3'>
          <h4 class='text-gray-900 font-medium'>{title()}</h4>
          <Show when={props.checklist?.status}>
            <span class='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
              {props.checklist.status}
            </span>
          </Show>
        </div>
      </div>

      <div class='flex items-center gap-2'>
        <button
          onClick={e => {
            e.stopPropagation();
            props.onOpen?.();
          }}
          class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
        >
          Open
        </button>
      </div>
    </div>
  );
}
