/**
 * CompletedChecklistRow - row for a reconciled/consensus checklist
 */

import { Show } from 'solid-js';

export default function CompletedChecklistRow(props) {
  const title = () => props.checklist?.title || `${props.checklist?.type || 'AMSTAR2'} Checklist`;

  return (
    <div class='flex items-center justify-between p-4 transition-colors hover:bg-gray-50'>
      <div class='flex-1'>
        <div class='flex items-center gap-3'>
          <h4 class='font-medium text-gray-900'>{title()}</h4>
          <Show when={props.checklist?.status}>
            <span class='inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'>
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
          class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
        >
          Open
        </button>
      </div>
    </div>
  );
}
