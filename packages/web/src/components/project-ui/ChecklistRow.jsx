/**
 * ChecklistRow component - Displays a single checklist in a study
 */

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
            {props.checklist.type || 'AMSTAR2'} Checklist
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
          <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='2'
              d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
