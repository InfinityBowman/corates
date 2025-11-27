/**
 * ChecklistRow component - Displays a single checklist in a review
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
    <div class='p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group'>
      <div class='flex-1'>
        <div class='flex items-center gap-3'>
          <h4 class='text-gray-900 font-medium'>{props.checklist.type || 'AMSTAR2'} Checklist</h4>
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(props.checklist.status)}`}
          >
            {props.checklist.status || 'pending'}
          </span>
        </div>
        <p class='text-gray-500 text-sm mt-1'>
          Assigned to:{' '}
          {props.getAssigneeName ? props.getAssigneeName(props.checklist.assignedTo) : 'Unassigned'}
        </p>
      </div>
      <button
        onClick={() => props.onOpen()}
        class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
      >
        Open
      </button>
    </div>
  );
}
