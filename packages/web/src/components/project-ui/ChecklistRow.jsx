''; /**
 * ChecklistRow component - Displays a single checklist in a study
 */

import { FiTrash2 } from 'solid-icons/fi';
import { getChecklistMetadata } from '@/checklist-registry';

export default function ChecklistRow(props) {
  // Get status badge styling
  const getStatusStyle = status => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div class='p-4 transition-colors flex items-center justify-between group hover:bg-gray-50'>
      <div class='flex-1'>
        <div class='flex items-center gap-3'>
          <h4 class='text-gray-900 font-medium'>
            {getChecklistMetadata(props.checklist.type)?.name || 'AMSTAR2'} Checklist
          </h4>
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(props.checklist.status)}`}
          >
            {props.checklist.status || 'pending'}
          </span>
        </div>
      </div>

      <div class='flex items-center gap-2'>
        <button
          onClick={e => {
            e.stopPropagation();
            props.onOpen();
          }}
          class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
        >
          Open
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            props.onDelete?.();
          }}
          class='p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100'
          title='Delete Checklist'
        >
          <FiTrash2 class='w-4 h-4' />
        </button>
      </div>
    </div>
  );
}
