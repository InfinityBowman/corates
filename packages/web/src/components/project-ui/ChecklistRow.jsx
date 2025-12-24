''; /**
 * ChecklistRow component - Displays a single checklist in a study
 */

import { FiTrash2 } from 'solid-icons/fi';
import { getChecklistMetadata } from '@/checklist-registry';
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status.js';

export default function ChecklistRow(props) {

  return (
    <div class='group flex items-center justify-between p-4 transition-colors hover:bg-gray-50'>
      <div class='flex-1'>
        <div class='flex items-center gap-3'>
          <h4 class='font-medium text-gray-900'>
            {getChecklistMetadata(props.checklist.type)?.name || 'AMSTAR2'} Checklist
          </h4>
          <span
            class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(props.checklist.status)}`}
          >
            {getStatusLabel(props.checklist.status)}
          </span>
        </div>
      </div>

      <div class='flex items-center gap-2'>
        <button
          onClick={e => {
            e.stopPropagation();
            props.onOpen();
          }}
          class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
        >
          Open
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            props.onDelete?.();
          }}
          class='rounded-lg p-2 text-gray-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600'
          title='Delete Checklist'
        >
          <FiTrash2 class='h-4 w-4' />
        </button>
      </div>
    </div>
  );
}
